#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

function log(message) {
  process.stdout.write(`[postinstall] ${message}\n`);
}

if (process.env.SKIP_DUCKDB_REBUILD) {
  log("Skipping duckdb rebuild (SKIP_DUCKDB_REBUILD is set).");
  process.exit(0);
}

if (process.platform !== "linux") {
  log("Non-Linux platform detected; using prebuilt duckdb binary.");
  process.exit(0);
}

log("Rebuilding duckdb from source to ensure glibc compatibility...");

const result = spawnSync("npm", ["rebuild", "duckdb", "--build-from-source"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    npm_config_build_from_source: "true",
  },
});

if (result.status !== 0) {
  log("duckdb rebuild failed.");
  process.exit(result.status ?? 1);
}

log("duckdb rebuild completed.");
