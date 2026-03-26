import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type BindParams, type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";

type SqlParams = BindParams | undefined;

export class AppDatabase {
  constructor(
    private readonly db: SqlJsDatabase,
    private readonly dbPath: string
  ) {}

  exec(sql: string) {
    this.db.exec(sql);
    this.save();
  }

  queryAll<T extends Record<string, unknown>>(sql: string, params?: SqlParams): T[] {
    const statement = this.db.prepare(sql);
    if (params) {
      statement.bind(params);
    }

    const rows: T[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }
    statement.free();
    return rows;
  }

  queryOne<T extends Record<string, unknown>>(sql: string, params?: SqlParams): T | undefined {
    return this.queryAll<T>(sql, params)[0];
  }

  run(sql: string, params?: SqlParams) {
    this.db.run(sql, params);
    this.save();
  }

  transaction(callback: () => void) {
    this.db.run("BEGIN");
    try {
      callback();
      this.db.run("COMMIT");
      this.save();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(moduleDir, "..", "..");

const loadSqlJs = () => {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file: string) => path.join(workspaceRoot, "node_modules", "sql.js", "dist", file)
    });
  }
  return sqlJsPromise;
};

export const createDatabase = async (dbPath: string) => {
  const SQL = await loadSqlJs();
  const schemaPath = path.join(workspaceRoot, "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const fileBytes = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
  const db = new SQL.Database(fileBytes);
  const wrapped = new AppDatabase(db, dbPath);
  db.exec(schema);
  wrapped.save();
  return wrapped;
};
