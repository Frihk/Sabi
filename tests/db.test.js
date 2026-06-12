const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const fs = require('fs')
const db = require('../database/db')

test('Database Module', async (t) => {
  const testDbPath = path.join(__dirname, 'test.db')
  
  // Clean up before test
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
  }
  
  process.env.DATABASE_URL = testDbPath

  await t.test('should initialize the database and create tables', async () => {
    const instance = await db.init()
    assert.ok(instance, 'Database instance should be returned')
    
    // Check if tables exist
    const tables = await new Promise((resolve, reject) => {
      instance.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err)
        else resolve(rows.map(r => r.name))
      })
    })
    
    assert.ok(tables.includes('farmers'), 'farmers table should exist')
    assert.ok(tables.includes('invoices'), 'invoices table should exist')
    assert.ok(tables.includes('proofs'), 'proofs table should exist')
    assert.ok(tables.includes('webhook_logs'), 'webhook_logs table should exist')
  })

  await t.test('getDb should return the database instance', () => {
    const instance = db.getDb()
    assert.ok(instance, 'getDb should return an instance')
  })

  // Clean up after test
  if (fs.existsSync(testDbPath)) {
    // We need to close the db before unlinking, but our db.js doesn't expose a close method easily.
    // For unit tests, we can just leave it or handle it if we add a close method.
  }
})
