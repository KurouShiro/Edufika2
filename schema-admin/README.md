# Edufika Schema Admin (Python GUI)

Desktop tool to inspect and adjust the PostgreSQL schema for Edufika, with:
- Database connection testing
- Schema browser (tables + columns)
- Migration preview
- Apply pending migrations
- Rollback last migration (requires `.down.sql`)
- Custom SQL dry-run/execute

## 1) Quick Start (Development)

From `schema-admin`:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

`requirements.txt` uses `psycopg[binary]` (v3) so Windows installs should use prebuilt wheels (no Visual C++ build tools needed).

Default DB URL:
- `postgres://postgres:postgres@localhost:5432/edufika`

Default migration directory:
- `..\edufika-session-api\src\db\migrations`

## 2) Migration Convention

This GUI discovers files in your migration directory:
- Up migration: `001_init.sql`
- Optional down migration: `001_init.down.sql`

Rollback button behavior:
- Reads latest applied migration from `schema_admin_migration_history`
- Executes matching `*.down.sql`
- Removes row from migration history

If the matching `.down.sql` file does not exist, rollback is blocked.

## 3) Dry-Run Modes

- `Dry-Run Pending`: executes pending migrations in a transaction, then rolls back.
- `Dry-Run Rollback`: executes rollback SQL in a transaction, then rolls back.
- `Dry-Run SQL`: executes custom SQL in a transaction, then rolls back.

This helps validate SQL safely before commit.

## 4) Build EXE with PyInstaller

From `schema-admin`:

```powershell
.\build.ps1
```

Output:
- `schema-admin\dist\EdufikaSchemaAdmin.exe`

Optional clean build:

```powershell
.\build.ps1 -Clean
```

## 4.1) One-Click Launcher from Project Root

From project root (`Edufika2`):

```powershell
.\launch-schema-admin.cmd
```

This will:
- Build `schema-admin\dist\EdufikaSchemaAdmin.exe` if needed
- Launch the EXE automatically

Force a clean rebuild before launch:

```powershell
.\launch-schema-admin.cmd -CleanBuild
```

## 5) Safety Notes

- Use a DB account with limited privileges for daily operations.
- Keep production schema changes migration-driven.
- Always run dry-run first, then execute.
