const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'monitoring.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

const setupDatabase = () => {
  db.serialize(() => {
    // Create the sites table
    db.run(`
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating sites table', err.message);
      } else {
        console.log('Sites table created or already exists.');
      }
    });

    // Create the logs table
    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        response_time INTEGER,
        details TEXT,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating logs table', err.message);
      } else {
        console.log('Logs table created or already exists.');
      }
    });
  });
};

module.exports = {
  db,
  setupDatabase
};
