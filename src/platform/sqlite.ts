import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { HistoryRow, PayrollStore, StateRow, StoreTransaction } from './store';

const connection = new SQLiteConnection(CapacitorSQLite);
const databaseName = 'mi_nomina';

/** All operations use the repository queue; every mutation has one native transaction. */
export class NativeSqliteStore implements PayrollStore {
  private database?: Promise<SQLiteDBConnection>;

  private open(): Promise<SQLiteDBConnection> {
    if (!this.database) this.database = (async () => {
      const consistent = await connection.checkConnectionsConsistency();
      const existing = await connection.isConnection(databaseName, false);
      const database = consistent.result && existing.result
        ? await connection.retrieveConnection(databaseName, false)
        : await connection.createConnection(databaseName, false, 'no-encryption', 1, false);
      await database.open();
      // Plugin 8.1.1 does not set user_version merely from createConnection(version).
      // Read and initialize the schema atomically; never downgrade a future database.
      await database.beginTransaction();
      try {
        const metadata = await database.query('PRAGMA user_version');
        const version = metadata.values?.[0]?.user_version;
        if (version !== 0 && version !== 1) throw new Error('Esta versión de los datos requiere una aplicación compatible. Se han conservado sin cambios.');
        await database.execute(`
          CREATE TABLE IF NOT EXISTS payroll_state (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS payroll_history (revision INTEGER PRIMARY KEY, payload TEXT NOT NULL, saved_at TEXT NOT NULL, reason TEXT NOT NULL);
          ${version === 0 ? 'PRAGMA user_version = 1;' : ''}
        `, false);
        await database.commitTransaction();
      } catch (error) {
        await database.rollbackTransaction().catch(() => undefined);
        throw error;
      }
      return database;
    })();
    return this.database;
  }

  async transaction<T>(work: (transaction: StoreTransaction) => Promise<T>): Promise<T> {
    const database = await this.open();
    await database.beginTransaction();
    const adapter: StoreTransaction = {
      getState: async () => {
        const result = await database.query('SELECT id, payload, revision, updated_at AS updatedAt FROM payroll_state WHERE id = 1');
        return result.values?.[0] as StateRow | undefined;
      },
      putState: async row => {
        await database.run('INSERT INTO payroll_state (id,payload,revision,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=excluded.revision, updated_at=excluded.updated_at', [row.payload, row.revision, row.updatedAt], false);
      },
      getHistory: async revision => {
        const result = await database.query('SELECT revision,payload,saved_at AS savedAt,reason FROM payroll_history WHERE revision = ?', [revision]);
        return result.values?.[0] as HistoryRow | undefined;
      },
      history: async () => {
        const result = await database.query('SELECT revision,payload,saved_at AS savedAt,reason FROM payroll_history ORDER BY revision DESC');
        return (result.values ?? []) as HistoryRow[];
      },
      putHistory: async row => {
        await database.run('INSERT INTO payroll_history (revision,payload,saved_at,reason) VALUES (?,?,?,?)', [row.revision, row.payload, row.savedAt, row.reason], false);
      },
      retainHistory: async limit => {
        await database.run('DELETE FROM payroll_history WHERE revision NOT IN (SELECT revision FROM payroll_history ORDER BY revision DESC LIMIT ?)', [limit], false);
      },
    };
    try {
      const result = await work(adapter);
      await database.commitTransaction();
      return result;
    } catch (error) {
      // Never delete/reset a database when parsing or saving fails.
      await database.rollbackTransaction().catch(() => undefined);
      throw error;
    }
  }
}
