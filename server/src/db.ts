import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.resolve(__dirname, './photos.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY (album_id) REFERENCES albums (id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'guest',
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS master_passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const albumColumns = db.prepare(`PRAGMA table_info(albums)`).all() as { name: string }[];
const hasPasswordColumn = albumColumns.some((column) => column.name === 'password_hash');
if (!hasPasswordColumn) {
  db.exec('ALTER TABLE albums ADD COLUMN password_hash TEXT');
}

const userColumns = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
const hasRoleColumn = userColumns.some((column) => column.name === 'role');
if (!hasRoleColumn) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'guest'");
}

const photoColumns = db.prepare(`PRAGMA table_info(photos)`).all() as { name: string }[];
const hasMetadataColumn = photoColumns.some((column) => column.name === 'metadata');
if (!hasMetadataColumn) {
  db.exec("ALTER TABLE photos ADD COLUMN metadata TEXT");
}

export default db;
