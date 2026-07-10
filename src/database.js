const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

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
          .then(() => seedBibleData())
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
          if (err) return reject(err);
          
          // 5. Bible Favorites Table
          db.run(`
            CREATE TABLE IF NOT EXISTS bible_favorites (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              translation TEXT NOT NULL,
              book_name TEXT NOT NULL,
              chapter INTEGER NOT NULL,
              start_verse INTEGER NOT NULL,
              end_verse INTEGER NOT NULL,
              label TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) return reject(err);
            
            // 6. Bible History Table
            db.run(`
              CREATE TABLE IF NOT EXISTS bible_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                translation TEXT NOT NULL,
                book_name TEXT NOT NULL,
                chapter INTEGER NOT NULL,
                start_verse INTEGER NOT NULL,
                end_verse INTEGER NOT NULL,
                viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
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

const BIBLE_BOOKS_ORDER = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
  'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

function seedBibleData() {
  return new Promise((resolve, reject) => {
    let bibleDataDir = path.join(__dirname, '..', 'bible-data');
    if (!fs.existsSync(bibleDataDir)) {
      bibleDataDir = path.join(app.getAppPath(), 'bible-data');
    }
    
    if (!fs.existsSync(bibleDataDir)) {
      console.warn('Warning: bible-data directory not found. Skipping seeding.');
      return resolve();
    }
    
    const translations = ['KJV', 'ASV', 'NIV', 'MBBTAG'];
    
    const checkAndSeed = async () => {
      for (const trans of translations) {
        await new Promise((resTrans, rejTrans) => {
          db.get('SELECT COUNT(*) as count FROM bibles WHERE translation = ?', [trans], (err, row) => {
            if (err) return rejTrans(err);
            if (row && row.count > 0) {
              console.log(`Translation ${trans} is already seeded.`);
              return resTrans();
            }
            
            const transDir = path.join(bibleDataDir, trans);
            if (!fs.existsSync(transDir)) {
              console.warn(`Translation dir not found for ${trans}, skipping.`);
              return resTrans();
            }
            
            console.log(`Seeding translation ${trans} from local files...`);
            
            if (trans === 'MBBTAG') {
              const xmlPath = path.join(transDir, 'Tagalog2005Bible.xml');
              if (!fs.existsSync(xmlPath)) {
                console.warn(`Tagalog2005Bible.xml not found in ${transDir}, skipping.`);
                return resTrans();
              }
              
              db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                try {
                  const stmt = db.prepare(`
                    INSERT INTO bibles (translation, book_number, book_name, chapter, verse, text) 
                    VALUES (?, ?, ?, ?, ?, ?)
                  `);
                  
                  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
                  let currentBookNum = 1;
                  let currentBookName = BIBLE_BOOKS_ORDER[0];
                  let currentChapterNum = 1;
                  
                  const lines = xmlContent.split('\n');
                  lines.forEach(line => {
                    const bookMatch = line.match(/<book\s+number="(\d+)"/i);
                    if (bookMatch) {
                      currentBookNum = parseInt(bookMatch[1]);
                      currentBookName = BIBLE_BOOKS_ORDER[currentBookNum - 1] || `Book ${currentBookNum}`;
                      return;
                    }
                    
                    const chapterMatch = line.match(/<chapter\s+number="(\d+)"/i);
                    if (chapterMatch) {
                      currentChapterNum = parseInt(chapterMatch[1]);
                      return;
                    }
                    
                    const verseMatch = line.match(/<verse\s+number="(\d+)">(.*?)<\/verse>/i);
                    if (verseMatch) {
                      const verseNum = parseInt(verseMatch[1]);
                      const text = verseMatch[2].trim()
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&apos;/g, "'");
                      stmt.run([trans, currentBookNum, currentBookName, currentChapterNum, verseNum, text]);
                    }
                  });
                  
                  stmt.finalize((errFinal) => {
                    if (errFinal) {
                      db.run('ROLLBACK');
                      rejTrans(errFinal);
                    } else {
                      db.run('COMMIT', (errCommit) => {
                        if (errCommit) rejTrans(errCommit);
                        else {
                          console.log(`Translation ${trans} seeded successfully.`);
                          resTrans();
                        }
                      });
                    }
                  });
                  
                } catch (e) {
                  db.run('ROLLBACK');
                  rejTrans(e);
                }
              });
              return;
            }
            
            const files = fs.readdirSync(transDir);
            
            db.serialize(() => {
              db.run('BEGIN TRANSACTION');
              try {
                const stmt = db.prepare(`
                  INSERT INTO bibles (translation, book_number, book_name, chapter, verse, text) 
                  VALUES (?, ?, ?, ?, ?, ?)
                `);
                
                files.forEach(file => {
                  if (!file.endsWith('.json')) return;
                  try {
                    const raw = fs.readFileSync(path.join(transDir, file), 'utf8');
                    const bookData = JSON.parse(raw);
                    if (!bookData || !bookData.book || !bookData.chapters) return;
                    
                    let bookName = bookData.book;
                    const matchedBook = BIBLE_BOOKS_ORDER.find(b => b.replace(/\s+/g, '').toLowerCase() === bookName.replace(/\s+/g, '').toLowerCase());
                    if (matchedBook) {
                      bookName = matchedBook;
                    }
                    
                    const bookIndex = BIBLE_BOOKS_ORDER.indexOf(bookName) + 1;
                    
                    bookData.chapters.forEach(ch => {
                      if (!ch.verses) return;
                      ch.verses.forEach(v => {
                        stmt.run([trans, bookIndex, bookName, ch.chapter, v.verse, v.text]);
                      });
                    });
                  } catch (e) {
                    console.error(`Error parsing book file ${file} for translation ${trans}:`, e);
                  }
                });
                
                stmt.finalize((errFinal) => {
                  if (errFinal) {
                    db.run('ROLLBACK');
                    rejTrans(errFinal);
                  } else {
                    db.run('COMMIT', (errCommit) => {
                      if (errCommit) rejTrans(errCommit);
                      else {
                        console.log(`Translation ${trans} seeded successfully.`);
                        resTrans();
                      }
                    });
                  }
                });
              } catch (e) {
                db.run('ROLLBACK');
                rejTrans(e);
              }
            });
          });
        });
      }
    };
    
    checkAndSeed()
      .then(() => resolve())
      .catch(err => reject(err));
  });
}

function getAvailableTranslations() {
  return new Promise((resolve, reject) => {
    db.all('SELECT DISTINCT translation FROM bibles ORDER BY translation', (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.translation));
    });
  });
}

function getBibleBooks(translation) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT DISTINCT book_name, book_number FROM bibles WHERE translation = ? ORDER BY book_number',
      [translation],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getBibleChapters(translation, bookName) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT DISTINCT chapter FROM bibles WHERE translation = ? AND book_name = ? ORDER BY chapter',
      [translation, bookName],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.chapter));
      }
    );
  });
}

function getBibleVerses(translation, bookName, chapter) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, verse, text FROM bibles WHERE translation = ? AND book_name = ? AND chapter = ? ORDER BY verse',
      [translation, bookName, chapter],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function searchBibleText(translation, keyword) {
  return new Promise((resolve, reject) => {
    const wildCard = `%${keyword}%`;
    db.all(
      `SELECT id, book_name, book_number, chapter, verse, text, translation
       FROM bibles 
       WHERE text LIKE ? AND translation = ?
       ORDER BY book_number, chapter, verse 
       LIMIT 100`,
      [wildCard, translation],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function addBibleFavorite(translation, bookName, chapter, startVerse, endVerse, label) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO bible_favorites (translation, book_name, chapter, start_verse, end_verse, label) VALUES (?, ?, ?, ?, ?, ?)',
      [translation, bookName, chapter, startVerse, endVerse, label || `${bookName} ${chapter}:${startVerse}-${endVerse}`],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function removeBibleFavorite(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM bible_favorites WHERE id = ?', [id], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function getBibleFavorites() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM bible_favorites ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addBibleHistory(translation, bookName, chapter, startVerse, endVerse) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM bible_history WHERE translation = ? AND book_name = ? AND chapter = ? AND start_verse = ? AND end_verse = ?',
      [translation, bookName, chapter, startVerse, endVerse],
      () => {
        db.run(
          'INSERT INTO bible_history (translation, book_name, chapter, start_verse, end_verse) VALUES (?, ?, ?, ?, ?)',
          [translation, bookName, chapter, startVerse, endVerse],
          function(err) {
            if (err) reject(err);
            else {
              db.run('DELETE FROM bible_history WHERE id NOT IN (SELECT id FROM bible_history ORDER BY viewed_at DESC LIMIT 50)');
              resolve({ id: this.lastID });
            }
          }
        );
      }
    );
  });
}

function getBibleHistory(limit = 30) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM bible_history ORDER BY viewed_at DESC LIMIT ?', [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function clearBibleHistory() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM bible_history', (err) => {
      if (err) reject(err);
      else resolve(true);
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
  importPlaylist,
  getAvailableTranslations,
  getBibleBooks,
  getBibleChapters,
  getBibleVerses,
  searchBibleText,
  addBibleFavorite,
  removeBibleFavorite,
  getBibleFavorites,
  addBibleHistory,
  getBibleHistory,
  clearBibleHistory
};
