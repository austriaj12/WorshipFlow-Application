const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

// Resolve database file path named worship.db inside user's local app data directory
const dbPath = path.join(app.getPath('userData'), 'worship.db');
console.log('Worship Database path:', dbPath);

let db = null;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite database:', err);
        return reject(err);
      }
      
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) return reject(err);
        createTables()
          .then(() => seedInitialData())
          .then(resolve)
          .catch(reject);
      });
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Songs Table (content_json stores structural section lists. [key] escaped as it is a SQL keyword)
      db.run(`
        CREATE TABLE IF NOT EXISTS songs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT,
          [key] TEXT,
          tempo TEXT,
          content_json TEXT NOT NULL
        )
      `);

      // 2. Bibles Table (Indexed for sub-millisecond lookup)
      db.run(`
        CREATE TABLE IF NOT EXISTS bibles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          translation TEXT NOT NULL, 
          book_number INTEGER NOT NULL,
          book_name TEXT NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          text TEXT NOT NULL
        )
      `);

      // Create index to optimize Bible queries
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_bibles_lookup 
        ON bibles (book_name, chapter, verse, translation)
      `);

      // 3. Playlist Table (Service Order list)
      db.run(`
        CREATE TABLE IF NOT EXISTS playlist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL, 
          song_id INTEGER,
          playlist_order INTEGER NOT NULL,
          FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) return reject(err);
        
        // 4. Media Table (Background images and video loop links)
        db.run(`
          CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            filepath TEXT NOT NULL
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}

function seedInitialData() {
  return new Promise((resolve, reject) => {
    console.log('Database initialized successfully.');
    resolve();
  });
}

// Database query functions wrapped in Promises
function getAllSongs() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, title, author, [key], tempo FROM songs ORDER BY title ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function searchSongs(query) {
  return new Promise((resolve, reject) => {
    const wildCard = `%${query}%`;
    db.all(
      'SELECT id, title, author, [key], tempo, content_json FROM songs WHERE title LIKE ? OR content_json LIKE ? ORDER BY title ASC',
      [wildCard, wildCard],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getSongWithContent(songId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM songs WHERE id = ?', [songId], (err, song) => {
      if (err) reject(err);
      else resolve(song);
    });
  });
}

function saveSong(id, title, author, key, tempo, contentJson) {
  return new Promise((resolve, reject) => {
    if (id) {
      // Update existing song (using escaped [key] column name)
      db.run(
        'UPDATE songs SET title = ?, author = ?, [key] = ?, tempo = ?, content_json = ? WHERE id = ?',
        [title, author, key, tempo, contentJson, id],
        function (err) {
          if (err) reject(err);
          else resolve({ id, title, author, key, tempo, content_json: contentJson });
        }
      );
    } else {
      // Insert new song (using escaped [key] column name)
      db.run(
        'INSERT INTO songs (title, author, [key], tempo, content_json) VALUES (?, ?, ?, ?, ?)',
        [title, author, key, tempo, contentJson],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, title, author, key, tempo, content_json: contentJson });
        }
      );
    }
  });
}

function deleteSong(songId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM songs WHERE id = ?', [songId], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function queryBible(translation, bookName, chapter, startVerse, endVerse) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT book_name, chapter, verse, text, translation 
       FROM bibles 
       WHERE book_name = ? AND chapter = ? AND translation = ? AND verse >= ? AND verse <= ? 
       ORDER BY verse ASC`,
      [bookName, chapter, translation, startVerse, endVerse],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getPlaylist() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM playlist ORDER BY playlist_order ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addToPlaylist(name, type, songId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COALESCE(MAX(playlist_order), 0) + 1 as next_order FROM playlist', (err, row) => {
      if (err) return reject(err);
      const nextOrder = row.next_order;
      db.run(
        'INSERT INTO playlist (name, type, song_id, playlist_order) VALUES (?, ?, ?, ?)',
        [name, type, songId, nextOrder],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, name, type, song_id: songId, playlist_order: nextOrder });
        }
      );
    });
  });
}

function removeFromPlaylist(playlistId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM playlist WHERE id = ?', [playlistId], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function updatePlaylistOrder(items) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare('UPDATE playlist SET playlist_order = ? WHERE id = ?');
      items.forEach((item, index) => {
        stmt.run([index + 1, item.id]);
      });
      stmt.finalize((err) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
    });
  });
}

function getMedia() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM media ORDER BY name ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function createMedia(name, type, filepath) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO media (name, type, filepath) VALUES (?, ?, ?)',
      [name, type, filepath],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, name, type, filepath });
      }
    );
  });
}

function deleteMedia(mediaId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM media WHERE id = ?', [mediaId], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function clearPlaylist() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM playlist', (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function importPlaylist(items) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id FROM songs', (err, rows) => {
      if (err) return reject(err);
      const validSongIds = new Set(rows.map(row => row.id));

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM playlist', (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          
          const stmt = db.prepare('INSERT INTO playlist (name, type, song_id, playlist_order) VALUES (?, ?, ?, ?)');
          items.forEach((item, index) => {
            let songId = item.song_id || (item.song_id === 0 ? 0 : null);
            if (songId !== null && !validSongIds.has(songId)) {
              songId = null;
            }
            stmt.run([item.name, item.type, songId, index + 1]);
          });
          
          stmt.finalize((err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve(true);
            });
          });
        });
      });
    });
  });
}

module.exports = {
  initDatabase,
  getAllSongs,
  searchSongs,
  getSongWithContent,
  saveSong,
  deleteSong,
  queryBible,
  getPlaylist,
  addToPlaylist,
  removeFromPlaylist,
  updatePlaylistOrder,
  getMedia,
  createMedia,
  deleteMedia,
  clearPlaylist,
  importPlaylist
};
