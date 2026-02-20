import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { dbPool } from "./pool";

async function run(): Promise<void> {
  const client = await dbPool.connect();
  try {
    const dialect = (process.env.DB_DIALECT || "mysql").toLowerCase();
    const migrationsDir = dialect === "postgres"
      ? path.join(__dirname, "migrations")
      : path.join(__dirname, "migrations", "mysql");

    if (dialect === "postgres") {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id BIGSERIAL PRIMARY KEY,
          filename TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } else {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )
      `);
    }

    const appliedResult = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations`
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql") && !file.endsWith(".down.sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping migration (already applied): ${file}`);
        continue;
      }

      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
      console.log(`Applied migration: ${file}`);
    }
  } finally {
    client.release();
    await dbPool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed", err);
  process.exitCode = 1;
});
