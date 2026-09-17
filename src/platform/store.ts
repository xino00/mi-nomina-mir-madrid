export type StateRow = { id: 1; payload: string; revision: number; updatedAt: string };
export type HistoryRow = { revision: number; payload: string; savedAt: string; reason: string };

export interface StoreTransaction {
  getState(): Promise<StateRow | undefined>;
  putState(row: StateRow): Promise<void>;
  getHistory(revision: number): Promise<HistoryRow | undefined>;
  history(): Promise<HistoryRow[]>;
  putHistory(row: HistoryRow): Promise<void>;
  retainHistory(limit: number): Promise<void>;
}

export interface PayrollStore {
  transaction<T>(work: (transaction: StoreTransaction) => Promise<T>): Promise<T>;
}
