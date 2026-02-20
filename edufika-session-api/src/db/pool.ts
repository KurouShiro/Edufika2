import "dotenv/config";
import mysql, { PoolConnection, ResultSetHeader } from "mysql2/promise";

type QueryParams = ReadonlyArray<unknown>;

export type DbQueryResult<T> = {
  rows: T[];
  rowCount: number;
  affectedRows?: number;
  insertId?: number;
};

export interface DbClient {
  query<T = unknown>(sql: string, params?: QueryParams): Promise<DbQueryResult<T>>;
  release(): void;
}

function parseDatabaseUrl(raw: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const url = new URL(raw);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use mysql:// or mariadb://");
  }

  const database = url.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }

  return {
    host: url.hostname,
    port: Number.parseInt(url.port || "3306", 10),
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

function convertPgPlaceholders(sql: string, params: QueryParams): { sql: string; params: unknown[] } {
  const ordered: unknown[] = [];
  const rewrittenSql = sql.replace(/\$([0-9]+)/g, (_fullMatch, indexText: string) => {
    const index = Number.parseInt(indexText, 10) - 1;
    const value = params[index];
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "NULL";
      }
      ordered.push(...value);
      return value.map(() => "?").join(", ");
    }
    ordered.push(value);
    return "?";
  });

  return { sql: rewrittenSql, params: ordered };
}

class MySqlClient implements DbClient {
  constructor(private readonly connection: PoolConnection) {}

  async query<T = unknown>(sql: string, params: QueryParams = []): Promise<DbQueryResult<T>> {
    const converted = convertPgPlaceholders(sql, params);
    const [result] = await this.connection.query(converted.sql, converted.params);

    if (Array.isArray(result)) {
      return {
        rows: result as T[],
        rowCount: result.length,
      };
    }

    const queryResult = result as ResultSetHeader;
    return {
      rows: [],
      rowCount: queryResult.affectedRows ?? 0,
      affectedRows: queryResult.affectedRows ?? 0,
      insertId: queryResult.insertId ?? 0,
    };
  }

  release(): void {
    this.connection.release();
  }
}

class MySqlPool {
  private readonly pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    const parsed = parseDatabaseUrl(connectionString);
    this.pool = mysql.createPool({
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      multipleStatements: true,
      timezone: "Z",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }

  async connect(): Promise<DbClient> {
    const connection = await this.pool.getConnection();
    return new MySqlClient(connection);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export const dbPool = new MySqlPool();
