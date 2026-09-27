use std::{env, time::Duration};

use anyhow::{Context, Result};
use axum::{extract::State, routing::get, Json, Router};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool};
use tokio::{net::TcpListener, time::sleep};
use tracing::{error, info, warn};

// ---------------------------------------------------------------------------
// Config & environment variable validation
// ---------------------------------------------------------------------------

struct Config {
    database_url: String,
    horizon_url: String,
    contract_id: String,
    poll_interval: Duration,
    backend_url: Option<String>,
}

/// Required environment variables that must be set before the indexer starts.
const REQUIRED_ENV_VARS: &[(&str, &str)] = &[
    ("DATABASE_URL", "PostgreSQL connection string, e.g. postgres://user@localhost/votechain (supply the password via DATABASE_PASSWORD_FILE)"),
    ("CONTRACT_ID", "Deployed VoteChain governance contract address (C...)"),
];

/// Validates all required environment variables up-front and returns a
/// descriptive error listing every missing variable, rather than failing on
/// the first missing one with a cryptic message.
///
/// # Errors
/// Returns an error if any required variable is absent or empty, with a
/// human-readable list of what is missing and where to find reference values.
fn validate_env() -> Result<()> {
    let missing: Vec<(&str, &str)> = REQUIRED_ENV_VARS
        .iter()
        .filter(|(key, _)| env::var(key).map(|v| v.is_empty()).unwrap_or(true))
        .cloned()
        .collect();

    if !missing.is_empty() {
        let details = missing
            .iter()
            .map(|(key, desc)| format!("  • {key}\n      {desc}"))
            .collect::<Vec<_>>()
            .join("\n");
        anyhow::bail!(
            "Indexer startup failed — missing required environment variables:\n\n\
             {details}\n\n\
             Set these variables before starting the indexer.\n\
             See .env.example for reference values."
        );
    }
    Ok(())
}

/// Validates the format of a PostgreSQL connection string and, if
/// `password_file` is set, injects the password read from that file.
///
/// Error messages never include the URL itself, so credentials cannot leak
/// into logs.
fn resolve_database_url(raw: &str, password_file: Option<&str>) -> Result<String> {
    let mut url = url::Url::parse(raw)
        .map_err(|_| anyhow::anyhow!("DATABASE_URL is not a valid URL (value redacted)"))?;
    if !matches!(url.scheme(), "postgres" | "postgresql") {
        anyhow::bail!("DATABASE_URL must use the postgres:// or postgresql:// scheme");
    }
    if url.host_str().map(str::is_empty).unwrap_or(true) {
        anyhow::bail!("DATABASE_URL must include a host");
    }
    if let Some(path) = password_file.filter(|p| !p.is_empty()) {
        if url.password().is_some() {
            anyhow::bail!("DATABASE_URL must not embed a password when DATABASE_PASSWORD_FILE is set");
        }
        let password = std::fs::read_to_string(path)
            .context("failed to read DATABASE_PASSWORD_FILE")?;
        let password = password.trim_end_matches(['\n', '\r']);
        if password.is_empty() {
            anyhow::bail!("DATABASE_PASSWORD_FILE is empty");
        }
        url.set_password(Some(password))
            .map_err(|_| anyhow::anyhow!("DATABASE_URL cannot carry a password"))?;
    }
    Ok(url.into())
}

impl Config {
    fn from_env() -> Result<Self> {
        // Validate all required vars first so the operator sees every missing
        // variable in a single error, not one at a time.
        validate_env()?;

        let database_url = resolve_database_url(
            &env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            env::var("DATABASE_PASSWORD_FILE").ok().as_deref(),
        )?;
        // Scrub credentials from the process environment so they are not
        // exposed via /proc/self/environ to anything that inspects it later.
        env::remove_var("DATABASE_URL");
        env::remove_var("DATABASE_PASSWORD_FILE");

        Ok(Self {
            database_url,
            horizon_url: env::var("HORIZON_URL")
                .unwrap_or_else(|_| "https://horizon-testnet.stellar.org".into()),
            contract_id: env::var("CONTRACT_ID").context("CONTRACT_ID must be set")?,
            poll_interval: Duration::from_secs(
                env::var("POLL_INTERVAL_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(3),
            ),
            backend_url: env::var("BACKEND_URL").ok(),
        })
    }
}

// ---------------------------------------------------------------------------
// Horizon response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct HorizonEventsPage {
    #[serde(rename = "_embedded")]
    embedded: Embedded,
}

#[derive(Deserialize)]
struct Embedded {
    records: Vec<HorizonEvent>,
}

#[derive(Deserialize)]
struct HorizonEvent {
    ledger: u64,
    transaction_hash: String,
    #[serde(rename = "contract_id")]
    contract_id: String,
    topic: Vec<Value>,
    value: Value,
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async fn last_ledger(pool: &PgPool, contract_id: &str) -> Result<u64> {
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT last_ledger FROM indexer_cursor WHERE contract_id = $1")
            .bind(contract_id)
            .fetch_optional(pool)
            .await?;
    Ok(row.map(|(l,)| l as u64).unwrap_or(0))
}

async fn save_cursor(pool: &PgPool, contract_id: &str, ledger: u64) -> Result<()> {
    sqlx::query(
        "INSERT INTO indexer_cursor (contract_id, last_ledger)
         VALUES ($1, $2)
         ON CONFLICT (contract_id) DO UPDATE SET last_ledger = EXCLUDED.last_ledger",
    )
    .bind(contract_id)
    .bind(ledger as i64)
    .execute(pool)
    .await?;
    Ok(())
}

async fn insert_event(pool: &PgPool, ev: &HorizonEvent, topic: &str) -> Result<()> {
    let proposal_id: Option<i64> = ev.topic.get(1).and_then(|v| v.as_i64());
    sqlx::query(
        "INSERT INTO contract_events
             (ledger_seq, tx_hash, contract_id, topic, proposal_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING",
    )
    .bind(ev.ledger as i64)
    .bind(&ev.transaction_hash)
    .bind(&ev.contract_id)
    .bind(topic)
    .bind(proposal_id)
    .bind(&ev.value)
    .execute(pool)
    .await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Cache invalidation helper
// ---------------------------------------------------------------------------

/// Fire-and-forget POST to the backend cache invalidation endpoint.
/// Errors are logged as warnings and never propagate to the caller.
async fn call_invalidate(client: &Client, backend_url: &str, proposal_id: Option<i64>) {
    let url = format!("{}/api/proposals/invalidate", backend_url);
    let body = match proposal_id {
        Some(id) => serde_json::json!({ "id": id }),
        None => serde_json::json!({}),
    };
    match client
        .post(&url)
        .json(&body)
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            info!(proposal_id, "cache invalidated via backend");
        }
        Ok(resp) => {
            warn!(status = %resp.status(), "cache invalidation returned non-2xx");
        }
        Err(e) => {
            warn!("cache invalidation request failed: {e:#}");
        }
    }
}

// ---------------------------------------------------------------------------
// Ingestion loop
// ---------------------------------------------------------------------------

async fn ingest(pool: PgPool, cfg: Config) {
    let client = Client::new();
    loop {
        match poll_once(&client, &pool, &cfg).await {
            Ok(count) => {
                if count > 0 {
                    info!(count, "ingested events");
                }
            }
            Err(e) => error!("poll error: {e:#}"),
        }
        sleep(cfg.poll_interval).await;
    }
}

async fn poll_once(client: &Client, pool: &PgPool, cfg: &Config) -> Result<usize> {
    let cursor = last_ledger(pool, &cfg.contract_id).await?;

    let url = format!(
        "{}/contracts/{}/events?cursor={}&limit=200&order=asc",
        cfg.horizon_url, cfg.contract_id, cursor
    );

    let page: HorizonEventsPage = client
        .get(&url)
        .timeout(Duration::from_secs(10))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let records = page.embedded.records;
    if records.is_empty() {
        return Ok(0);
    }

    let mut max_ledger = cursor;
    let mut count = 0;

    for ev in &records {
        let topic = ev
            .topic
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        match topic {
            "init" | "created" | "vote" | "final" | "executed" | "cancelled" | "qupdate"
            | "admxfer" | "paused" | "unpaused" | "durationupdate" => {
                insert_event(pool, ev, topic).await?;
                count += 1;

                // Invalidate the backend Redis cache for events that change proposal state.
                if matches!(topic, "created" | "vote" | "final" | "executed" | "cancelled") {
                    if let Some(ref backend_url) = cfg.backend_url {
                        let proposal_id: Option<i64> = ev.topic.get(1).and_then(|v| v.as_i64());
                        let client = client.clone();
                        let backend_url = backend_url.clone();
                        tokio::spawn(async move {
                            call_invalidate(&client, &backend_url, proposal_id).await;
                        });
                    }
                }
            }
            other => warn!(other, "unknown event topic — skipping"),
        }

        if ev.ledger > max_ledger {
            max_ledger = ev.ledger;
        }
    }

    save_cursor(pool, &cfg.contract_id, max_ledger).await?;
    Ok(count)
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

#[derive(Serialize, sqlx::FromRow)]
struct EventRow {
    id: i64,
    ledger_seq: i64,
    tx_hash: String,
    topic: String,
    proposal_id: Option<i64>,
    payload: Value,
    ingested_at: chrono::DateTime<chrono::Utc>,
}

async fn list_events(State(pool): State<PgPool>) -> Json<Vec<EventRow>> {
    let rows = sqlx::query_as::<_, EventRow>(
        "SELECT id, ledger_seq, tx_hash, topic, proposal_id, payload, ingested_at
         FROM contract_events ORDER BY ledger_seq DESC LIMIT 100",
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(rows)
}

async fn list_proposal_events(
    State(pool): State<PgPool>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Json<Vec<EventRow>> {
    let rows = sqlx::query_as::<_, EventRow>(
        "SELECT id, ledger_seq, tx_hash, topic, proposal_id, payload, ingested_at
         FROM contract_events WHERE proposal_id = $1 ORDER BY ledger_seq ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(rows)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let cfg = Config::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&cfg.database_url)
        .await
        .context("connect to postgres")?;

    // Run database migrations using sqlx's built-in migration runner.
    //
    // sqlx::migrate!() embeds all *.sql files from the migrations/ directory
    // at compile time, tracks which have been applied in the _sqlx_migrations
    // table, and applies only unapplied migrations in version order.  This
    // replaces the previous sqlx::raw_sql approach which re-executed the full
    // schema on every startup and could not handle incremental schema changes
    // without data loss risk.
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("run database migrations")?;

    info!("database migrations applied successfully");

    // Spawn ingestion loop
    let ingest_pool = pool.clone();
    tokio::spawn(async move { ingest(ingest_pool, cfg).await });

    // REST API
    let app = Router::new()
        .route("/events", get(list_events))
        .route("/events/proposals/{id}", get(list_proposal_events))
        .with_state(pool);

    let addr = "0.0.0.0:4000";
    let listener = TcpListener::bind(addr).await?;
    info!("VoteChain indexer API on {addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg(test)]
mod database_url_tests {
    use super::resolve_database_url;

    #[test]
    fn rejects_non_postgres_scheme() {
        assert!(resolve_database_url("mysql://u@h/db", None).is_err());
    }

    #[test]
    fn rejects_garbage_without_echoing_it() {
        let err = resolve_database_url("not a url secret123", None).unwrap_err();
        assert!(!err.to_string().contains("secret123"));
    }

    #[test]
    fn injects_password_from_file() {
        let path = std::env::temp_dir().join("votechain_db_pw_test");
        std::fs::write(&path, "s3cret\n").unwrap();
        let url = resolve_database_url("postgres://user@localhost/votechain", path.to_str()).unwrap();
        assert_eq!(url, "postgres://user:s3cret@localhost/votechain");
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn rejects_embedded_password_with_password_file() {
        assert!(resolve_database_url("postgres://u:p@localhost/db", Some("/nonexistent")).is_err());
    }
}
