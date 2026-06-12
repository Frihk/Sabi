const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const fs = require('fs')
const adapter = require('../database/adapter')

test('Main Adapter Facade', async (t) => {
  const testDbPath = path.join(__dirname, 'facade_test.db')
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  process.env.DATABASE_URL = testDbPath

  await t.test('should expose init and core methods', async () => {
    assert.strictEqual(typeof adapter.init, 'function')
    assert.strictEqual(typeof adapter.getFarmer, 'function')
    assert.strictEqual(typeof adapter.insertProof, 'function')
    
    await adapter.init()
    const dbInstance = adapter.getDb()
    assert.ok(dbInstance)
  })

  await t.test('should proxy methods to sqlite_adapter', async () => {
    const id = 'facade_farmer'
    await adapter.createFarmerIfNotExists({ id })
    const farmer = await adapter.getFarmer(id)
    assert.strictEqual(farmer.id, id)
  })
})
