import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectRedis } from "./middleware/redisCache";
import { requestTracing } from "./middleware/requestTracing";
import healthRoutes from "./routes/health";
import proposalRoutes from "./routes/proposals";
import {
  notFoundHandler,
  globalErrorHandler,
} from "./middleware/errorHandler";

// ---------------------------------------------------------------------------
// Environment variable validation
// ---------------------------------------------------------------------------

interface EnvConfig {
  PORT: string;
  REDIS_URL: string;
  ALLOWED_ORIGINS: string;
}

function validateEnv(): EnvConfig {
  const required: Array<keyof Pick<EnvConfig, "REDIS_URL">> = ["REDIS_URL"];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      "[startup] Missing required environment variables:\n" +
        missing.map((k) => `  • ${k}`).join("\n") +
        "\n\nSet these variables before starting the server. " +
        "See .env.example for reference."
    );
    process.exit(1);
  }

  return {
    PORT: process.env.PORT ?? "3001",
    REDIS_URL: process.env.REDIS_URL!,
    // Default to localhost dev origin; production sets this to the real domain.
    ALLOWED_ORIGINS:
      process.env.ALLOWED_ORIGINS ?? "http://localhost:5173",
  };
}

const env = validateEnv();

// ---------------------------------------------------------------------------
// CORS configuration (#32)
// ---------------------------------------------------------------------------

const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (curl, server-to-server, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id", "X-Cache"],
  credentials: true,
  // Tells browsers to cache the preflight response for 10 minutes
  maxAge: 600,
};

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();

// Security headers — must come before routes
app.use(helmet());

// Handle preflight OPTIONS for all routes
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

app.use(requestTracing);
app.use(express.json());

// Health and readiness probes — mounted BEFORE rate-limiting and auth so
// load balancers and orchestrators can always reach them without credentials.
app.use("/", healthRoutes);

app.use("/api", proposalRoutes);

// Catch unmatched routes — must come after all real route registrations.
app.use(notFoundHandler);

// Global error handler — must be the very last middleware registered.
app.use(globalErrorHandler);

const PORT = parseInt(env.PORT, 10);

// connectRedis now degrades gracefully on failure (#38) — the server always
// starts regardless of whether Redis is reachable.
connectRedis(env.REDIS_URL).then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});

export default app;
