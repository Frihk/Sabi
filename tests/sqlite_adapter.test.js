const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const fs = require('fs')
const db = require('../database/db')
const adapter = require('../database/sqlite_adapter')

test('SQLite Adapter', async (t) => {
  const testDbPath = path.join(__dirname, 'adapter_test.db')
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  process.env.DATABASE_URL = testDbPath
  await db.init()

  await t.test('Farmer operations', async () => {
    const farmerId = 'test_farmer'
    await adapter.createFarmerIfNotExists({ id: farmerId, name: 'Test Farmer', county: 'Kisumu' })
    
    const farmer = await adapter.getFarmer(farmerId)
    assert.strictEqual(farmer.id, farmerId)
    assert.strictEqual(farmer.name, 'Test Farmer')
    
    await adapter.updateFarmer(farmerId, { name: 'Updated Name' })
    const updated = await adapter.getFarmer(farmerId)
    assert.strictEqual(updated.name, 'Updated Name')
    
    await adapter.updateFarmerAggregates(farmerId, 500, 2)
    const aggregated = await adapter.getFarmer(farmerId)
    assert.strictEqual(aggregated.score, 500)
    assert.strictEqual(aggregated.loans_repaid, 2)
  })

  await t.test('Invoice operations', async () => {
    const hash = 'test_hash'
    await adapter.insertInvoice({
      payment_request: 'lnbc...',
      payment_hash: hash,
      farmer_id: 'test_farmer',
      lender: 'Test Lender',
      amount_kes: 1000
    })
    
    const invoice = await adapter.getInvoiceByHash(hash)
    assert.strictEqual(invoice.payment_hash, hash)
    assert.strictEqual(invoice.amount_kes, 1000)
  })

  await t.test('Proof operations', async () => {
    const hash = 'proof_hash'
    await adapter.insertProof({
      farmer_id: 'test_farmer',
      lender: 'Test Lender',
      amount_kes: 1000,
      payment_hash: hash,
      preimage_encrypted: 'encrypted_preimage',
      memo: 'test memo'
    })
    
    const proofs = await adapter.getProofsByFarmer('test_farmer')
    assert.strictEqual(proofs.length, 1)
    assert.strictEqual(proofs[0].payment_hash, hash)
    
    const proof = await adapter.getProofByHash(hash)
    assert.ok(proof)
    
    const proofById = await adapter.getProofById(proof.id)
    assert.strictEqual(proofById.payment_hash, hash)
  })

  await t.test('Passport aggregation', async () => {
    const passport = await adapter.getPassport('test_farmer')
    assert.strictEqual(passport.id, 'test_farmer')
    assert.ok(Array.isArray(passport.proofs))
    assert.strictEqual(passport.proofs.length, 1)
  })

  await t.test('Webhook logging', async () => {
    await adapter.logWebhook('test_event', { foo: 'bar' })
    const state = await adapter.load()
    assert.ok(state.webhook_logs.length >= 1)
  })
})
