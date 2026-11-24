import Database from 'better-sqlite3';
import type { ReadResult } from './schema.js';

export interface ScanRecord {
  id: number;
  createdAt: string;
  model: string;
  result: ReadResult;
  thumbnail: string | null;
}

export interface HistoryStore {
  insert(scan: { model: string; result: ReadResult; thumbnail: string | null }): ScanRecord;
  list(limit?: number): ScanRecord[];
  remove(id: number): boolean;
  close(): void;
}

interface Row {
  id: number;
  created_at: string;
  model: string;
  result_json: string;
  thumbnail: string | null;
}

export function openHistory(path: string): HistoryStore {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    model TEXT NOT NULL,
    result_json TEXT NOT NULL,
    thumbnail TEXT
  )`);
  const insertStmt = db.prepare(
    'INSERT INTO scans (created_at, model, result_json, thumbnail) VALUES (?, ?, ?, ?)',
  );
  const listStmt = db.prepare('SELECT * FROM scans ORDER BY id DESC LIMIT ?');
  const deleteStmt = db.prepare('DELETE FROM scans WHERE id = ?');

  const toRecord = (row: Row): ScanRecord => ({
    id: row.id,
    createdAt: row.created_at,
    model: row.model,
    result: JSON.parse(row.result_json) as ReadResult,
    thumbnail: row.thumbnail,
  });

  return {
    insert({ model, result, thumbnail }) {
      const createdAt = new Date().toISOString();
      const info = insertStmt.run(createdAt, model, JSON.stringify(result), thumbnail);
      return { id: Number(info.lastInsertRowid), createdAt, model, result, thumbnail };
    },
    list(limit = 30) {
      return (listStmt.all(limit) as Row[]).map(toRecord);
    },
    remove(id) {
      return deleteStmt.run(id).changes > 0;
    },
    close() {
      db.close();
    },
  };
}
