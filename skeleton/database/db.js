const sqlite3 = require('sqlite3').verbose()
const path = require('path')

// Use DATABASE_URL from env or default to sabicredit.db in the parent directory
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '..', 'sabicredit.db')

let db = null

/**
 * Initializes the database and creates tables if they don't exist.
 * Returns a promise that resolves when the database is ready.
 */
function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Could not connect to database', err)
        return reject(err)
      }

      db.serialize(() => {
        // Farmers table: core reputation data
        db.run(`CREATE TABLE IF NOT EXISTS farmers (
          id TEXT PRIMARY KEY,
          name TEXT,
          county TEXT,
          score INTEGER DEFAULT 300,
          loans_repaid INTEGER DEFAULT 0,
          defaults INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

        // Invoices table: pending payments
        db.run(`CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payment_request TEXT,
          payment_hash TEXT UNIQUE,
          farmer_id TEXT,
          lender TEXT,
          amount_kes REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

        // Proofs table: completed payments (the Credit Passport entries)
        db.run(`CREATE TABLE IF NOT EXISTS proofs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          farmer_id TEXT,
          lender TEXT,
          amount_kes REAL,
          payment_hash TEXT UNIQUE,
          preimage_encrypted TEXT,
          memo TEXT,
          on_time INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

        // Webhook logs: for debugging and audit
        db.run(`CREATE TABLE IF NOT EXISTS webhook_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT,
          payload TEXT,
          received_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

        resolve(db)
      })
    })
  })
}

/**
 * Returns the active database instance.
 * Throws if init() hasn't been called.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.')
  }
  return db
}

module.exports = {
  init,
  getDb
}
