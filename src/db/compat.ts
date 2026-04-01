/**
 * Compatibility wrapper around node-sqlite3-wasm that provides the same API
 * shape as better-sqlite3. This allows all downstream code to use the familiar
 * db.prepare(sql).run(...args) pattern without changes.
 */
import sqlite3 from "node-sqlite3-wasm";
const WasmDatabase = sqlite3.Database;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface PreparedStatement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface Database {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  close(): void;
  transaction<T>(fn: () => T): () => T;
}

function wrapParams(params: unknown[]): any {
  if (params.length === 0) return undefined;
  if (params.length === 1) return [params[0]];
  return params;
}

export function openDatabase(filePath: string): Database {
  const raw = new WasmDatabase(filePath);

  // Foreign keys are enabled by default in node-sqlite3-wasm
  raw.exec("PRAGMA busy_timeout = 5000");
  raw.exec("PRAGMA journal_mode = WAL");

  const db: Database = {
    prepare(sql: string): PreparedStatement {
      return {
        run(...params: unknown[]): RunResult {
          return raw.run(sql, wrapParams(params)) as RunResult;
        },
        get(...params: unknown[]): unknown {
          return raw.get(sql, wrapParams(params));
        },
        all(...params: unknown[]): unknown[] {
          return raw.all(sql, wrapParams(params));
        },
      };
    },

    exec(sql: string): void {
      raw.exec(sql);
    },

    close(): void {
      raw.close();
    },

    transaction<T>(fn: () => T): () => T {
      return () => {
        raw.exec("BEGIN");
        try {
          const result = fn();
          raw.exec("COMMIT");
          return result;
        } catch (err) {
          raw.exec("ROLLBACK");
          throw err;
        }
      };
    },
  };

  return db;
}
