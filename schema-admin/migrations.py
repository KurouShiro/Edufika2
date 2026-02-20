from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence

from psycopg import Connection as PgConnection

MIGRATION_TABLE = "schema_admin_migration_history"


@dataclass
class MigrationFile:
    name: str
    path: Path
    down_path: Path | None


def discover_migrations(migrations_dir: str) -> List[MigrationFile]:
    root = Path(migrations_dir).expanduser().resolve()
    if not root.exists():
        return []

    files = []
    for path in sorted(root.glob("*.sql")):
        if path.name.endswith(".down.sql"):
            continue
        down_candidate = path.with_name(path.stem + ".down.sql")
        files.append(
            MigrationFile(
                name=path.name,
                path=path,
                down_path=down_candidate if down_candidate.exists() else None,
            )
        )
    return files


def ensure_migration_table(conn: PgConnection) -> None:
    sql = f"""
    CREATE TABLE IF NOT EXISTS {MIGRATION_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        migration_name TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def get_applied_names(conn: PgConnection) -> List[str]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT migration_name FROM {MIGRATION_TABLE} ORDER BY applied_at, id")
        rows = cur.fetchall()
    return [str(row[0]) for row in rows]


def read_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def checksum(sql: str) -> str:
    return hashlib.sha256(sql.encode("utf-8")).hexdigest()


def pending_migrations(migrations: Sequence[MigrationFile], applied_names: Iterable[str]) -> List[MigrationFile]:
    applied = set(applied_names)
    return [migration for migration in migrations if migration.name not in applied]


def preview_pending_sql(conn: PgConnection, migrations: Sequence[MigrationFile]) -> str:
    ensure_migration_table(conn)
    pending = pending_migrations(migrations, get_applied_names(conn))
    if not pending:
        return "-- No pending migrations.\n"

    blocks: List[str] = []
    for migration in pending:
        blocks.append(f"-- {migration.name}")
        blocks.append(read_sql(migration.path).strip())
        blocks.append("")
    return "\n".join(blocks).rstrip() + "\n"


def apply_pending(conn: PgConnection, migrations: Sequence[MigrationFile], dry_run: bool) -> List[str]:
    ensure_migration_table(conn)
    applied = get_applied_names(conn)
    pending = pending_migrations(migrations, applied)
    applied_now: List[str] = []

    for migration in pending:
        sql = read_sql(migration.path)
        script_checksum = checksum(sql)
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                f"""
                INSERT INTO {MIGRATION_TABLE} (migration_name, checksum)
                VALUES (%s, %s)
                ON CONFLICT (migration_name) DO NOTHING
                """,
                (migration.name, script_checksum),
            )
        applied_now.append(migration.name)

    if dry_run:
        conn.rollback()
        return applied_now

    conn.commit()
    return applied_now


def rollback_last(conn: PgConnection, migrations: Sequence[MigrationFile], dry_run: bool) -> str:
    ensure_migration_table(conn)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT migration_name
            FROM {MIGRATION_TABLE}
            ORDER BY applied_at DESC, id DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("No applied migrations found in history table.")

    migration_name = str(row[0])
    lookup = {migration.name: migration for migration in migrations}
    migration = lookup.get(migration_name)
    if migration is None:
        raise ValueError(
            f"Cannot rollback {migration_name}: file not found in migration directory."
        )
    if migration.down_path is None:
        raise ValueError(
            f"Cannot rollback {migration_name}: missing '{migration.path.stem}.down.sql'."
        )

    down_sql = read_sql(migration.down_path)
    with conn.cursor() as cur:
        cur.execute(down_sql)
        cur.execute(
            f"DELETE FROM {MIGRATION_TABLE} WHERE migration_name = %s",
            (migration_name,),
        )

    if dry_run:
        conn.rollback()
    else:
        conn.commit()
    return migration_name
