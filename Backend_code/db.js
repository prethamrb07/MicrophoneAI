import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'podcastai.db');

let db;

export function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initTables();
    }
    return db;
}

function initTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            hostAName TEXT NOT NULL,
            hostBName TEXT DEFAULT '',
            language TEXT DEFAULT 'en',
            joinCode TEXT UNIQUE NOT NULL,
            creatorId TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (creatorId) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transcript_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessionId TEXT NOT NULL,
            hostId TEXT NOT NULL,
            text TEXT NOT NULL,
            isFinal INTEGER DEFAULT 1,
            timestamp TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (sessionId) REFERENCES sessions(id)
        );
    `);
}
