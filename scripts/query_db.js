const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.env.APPDATA || (process.env.HOME || ''), 'WorshipFlow', 'worship.db');
console.log('Querying DB at:', dbPath);
const db = new sqlite3.Database(dbPath);
db.all('SELECT id, title, author FROM songs ORDER BY id DESC', (err, rows) => {
  if (err) {
    console.error('DB query error:', err);
    process.exit(1);
  }
  console.log('Songs:', rows);
  process.exit(0);
});
