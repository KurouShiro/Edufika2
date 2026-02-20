from __future__ import annotations

from dataclasses import dataclass
from typing import List

import psycopg
from psycopg import Connection as PgConnection


@dataclass
class TableRef:
    schema: str
    name: str

    @property
    def label(self) -> str:
        return f"{self.schema}.{self.name}"


@dataclass
class ColumnInfo:
    name: str
    data_type: str
    is_nullable: bool
    default_value: str | None


def connect(db_url: str) -> PgConnection:
    return psycopg.connect(db_url)


def ping(db_url: str) -> str:
    with connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version()")
            row = cur.fetchone()
    return str(row[0]) if row else "unknown"


def list_tables(conn: PgConnection) -> List[TableRef]:
    sql = """
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    return [TableRef(schema=row[0], name=row[1]) for row in rows]


def list_columns(conn: PgConnection, table: TableRef) -> List[ColumnInfo]:
    sql = """
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = %s AND table_name = %s
    ORDER BY ordinal_position
    """
    with conn.cursor() as cur:
        cur.execute(sql, (table.schema, table.name))
        rows = cur.fetchall()
    return [
        ColumnInfo(
            name=row[0],
            data_type=row[1],
            is_nullable=str(row[2]).upper() == "YES",
            default_value=row[3],
        )
        for row in rows
    ]


def execute_script(conn: PgConnection, sql: str, dry_run: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(sql)
    if dry_run:
        conn.rollback()
    else:
        conn.commit()
