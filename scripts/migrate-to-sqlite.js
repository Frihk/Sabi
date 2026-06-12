const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const JSON_FILE = path.join(__dirname, '..', 'sabi.json')
const DB_FILE = path.join(__dirname, '..', 'sabi.db')

if (!fs.existsSync(JSON_FILE)) {
  console.error('sabi.json not found')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'))
const db = new sqlite3.Database(DB_FILE)

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS farmers (id TEXT PRIMARY KEY, name TEXT, county TEXT, score INTEGER, loans_repaid INTEGER, defaults INTEGER, created_at TEXT)`)
  db.run(`CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY, payment_request TEXT, payment_hash TEXT, farmer_id TEXT, lender TEXT, amount_kes REAL, created_at TEXT)`)
  db.run(`CREATE TABLE IF NOT EXISTS proofs (id INTEGER PRIMARY KEY, farmer_id TEXT, lender TEXT, amount_kes REAL, payment_hash TEXT, preimage_encrypted TEXT, memo TEXT, on_time INTEGER, created_at TEXT)`)
  db.run(`CREATE TABLE IF NOT EXISTS webhook_logs (id INTEGER PRIMARY KEY, event_type TEXT, payload TEXT, received_at TEXT)`)

  const insertFarmer = db.prepare('INSERT OR REPLACE INTO farmers (id,name,county,score,loans_repaid,defaults,created_at) VALUES (?,?,?,?,?,?,?)')
  (data.farmers || []).forEach(f => insertFarmer.run(f.id, f.name, f.county, f.score || 0, f.loans_repaid || 0, f.defaults || 0, f.created_at || new Date().toISOString()))
  insertFarmer.finalize()

  const insertInvoice = db.prepare('INSERT INTO invoices (id,payment_request,payment_hash,farmer_id,lender,amount_kes,created_at) VALUES (?,?,?,?,?,?,?)')
  ;(data.invoices || []).forEach(i => insertInvoice.run(i.id, i.payment_request || null, i.payment_hash || null, i.farmer_id || null, i.lender || null, i.amount_kes || null, i.created_at || new Date().toISOString()))
  insertInvoice.finalize()

  const insertProof = db.prepare('INSERT INTO proofs (id,farmer_id,lender,amount_kes,payment_hash,preimage_encrypted,memo,on_time,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  ;(data.proofs || []).forEach(p => insertProof.run(p.id, p.farmer_id || null, p.lender || null, p.amount_kes || null, p.payment_hash || null, p.preimage_encrypted || null, p.memo || null, p.on_time || 0, p.created_at || new Date().toISOString()))
  insertProof.finalize()

  const insertLog = db.prepare('INSERT INTO webhook_logs (id,event_type,payload,received_at) VALUES (?,?,?,?)')
  ;(data.webhook_logs || []).forEach(l => insertLog.run(l.id, l.event_type || 'payment', JSON.stringify(l.payload || {}), l.received_at || new Date().toISOString()))
  insertLog.finalize()

  console.log('Migration complete — wrote', DB_FILE)
})

db.close()
