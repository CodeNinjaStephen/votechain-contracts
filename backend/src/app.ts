// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import express from "express";
import path from "path";
import { connectRedis } from "./middleware/redisCache";
import healthRoutes from "./routes/health";
import proposalRoutes from "./routes/proposals";
import {
  notFoundHandler,
  globalErrorHandler,
} from "./middleware/errorHandler";

// ---------------------------------------------------------------------------
// Environment variable validation
// ---------------------------------------------------------------------------
// Validates required env vars at startup so the process fails fast with a
// clear diagnostic instead of a cryptic runtime panic later.

interface EnvConfig {
  PORT: string;
  REDIS_URL: string;
}

function validateEnv(): EnvConfig {
  const required: Array<keyof EnvConfig> = ["REDIS_URL"];
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
  };
}

const env = validateEnv();

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
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

const PORT = process.env.PORT ?? 3001;

connectRedis(env.REDIS_URL).then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});

export default app;
