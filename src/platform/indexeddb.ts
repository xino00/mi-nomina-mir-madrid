import type { HistoryRow, PayrollStore, StateRow, StoreTransaction } from './store';

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error('No se pudo acceder a los datos de la vista previa.'));
  });
}

/** Browser-only preview data; this database is never used by the Android app. */
export class IndexedDbStore implements PayrollStore {
  private database?: Promise<IDBDatabase>;

  constructor(private readonly name = 'mi-nomina-browser-preview-v1', private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    if (!this.database) this.database = new Promise((resolve, reject) => {
      const operation = this.factory.open(this.name, 1);
      operation.onupgradeneeded = () => {
        operation.result.createObjectStore('state', { keyPath: 'id' });
        operation.result.createObjectStore('history', { keyPath: 'revision' });
      };
      operation.onsuccess = () => {
        operation.result.onversionchange = () => operation.result.close();
        resolve(operation.result);
      };
      operation.onerror = () => reject(operation.error ?? new Error('No se pudo abrir la base de datos.'));
      operation.onblocked = () => reject(new Error('Cierra otras pestañas de la vista previa para abrir los datos.'));
    });
    return this.database;
  }

  async transaction<T>(work: (transaction: StoreTransaction) => Promise<T>): Promise<T> {
    const database = await this.open();
    const transaction = database.transaction(['state', 'history'], 'readwrite');
    const completion = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Se ha cancelado el guardado. Los datos anteriores se conservan.'));
      transaction.onerror = () => { /* The abort event reports the transaction failure. */ };
    });
    // Attach a rejection handler immediately; work can fail before completion is awaited.
    void completion.catch(() => undefined);
    const state = transaction.objectStore('state'), history = transaction.objectStore('history');
    const adapter: StoreTransaction = {
      getState: () => request(state.get(1)) as Promise<StateRow | undefined>,
      putState: async row => { await request(state.put(row)); },
      getHistory: revision => request(history.get(revision)) as Promise<HistoryRow | undefined>,
      history: async () => (await request(history.getAll()) as HistoryRow[]).sort((a, b) => b.revision - a.revision),
      putHistory: async row => { await request(history.put(row)); },
      retainHistory: async limit => {
        const keys = await request(history.getAllKeys());
        for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await request(history.delete(key));
      },
    };
    try {
      const result = await work(adapter);
      await completion;
      return result;
    } catch (error) {
      try { transaction.abort(); } catch { /* Already aborted or completed. */ }
      await completion.catch(() => undefined);
      throw error;
    }
  }
}
