const express = require('express')
const router = express.Router()
const creds = require('../services/credentials')
const db = require('../database/adapter')
const crypto = require('crypto')

function randomHex(len = 32) {
  return crypto.randomBytes(len).toString('hex')
}

function parseMemo(memo) {
  if (!memo) return { lender: null, farmer_id: null }
  const parts = memo.split('-')
  return { lender: parts[0] || null, farmer_id: parts[1] || null }
}

async function processPayment(payload) {
  try {
    await db.logWebhook('payment', payload)

    const { payment_hash, preimage, amount, memo } = payload
    const { lender, farmer_id } = parseMemo(memo)
    const amount_kes = amount ? (Number(amount) / 1000) : null

    let saved = false
    if (payment_hash && preimage && farmer_id) {
      await creds.createFarmerIfNotExists({ id: farmer_id })
      await creds.saveProof({ farmer_id, lender, amount_kes, payment_hash, preimage, memo })
      saved = true
    }

    return { ok: true, saved, farmer_id, lender, amount_kes }
  } catch (err) {
    throw err
  }
}

router.post('/payment', async (req, res) => {
  try {
    const secret = process.env.WEBHOOK_SECRET
    const headerSecret = req.headers['x-webhook-secret'] || req.query.secret
    if (secret && headerSecret && headerSecret !== secret) {
      console.warn('webhook rejected: invalid secret', { ip: req.ip })
      return res.status(403).json({ error: 'invalid webhook secret' })
    }

    const payload = req.body
    console.info('webhook received', { ip: req.ip, memo: payload && payload.memo })

    const result = await processPayment(payload)
    res.json(result)
  } catch (err) {
    console.error('webhook error', err)
    res.status(500).json({ error: 'webhook processing error', message: err.message })
  }
})

// Simulate a webhook locally: POST /api/webhook/sim with optional JSON body { farmer_id, lender, amount_kes }
router.post('/sim', async (req, res) => {
  try {
    const farmer_id = req.body.farmer_id || 'jmwangi_kisii'
    const lender = req.body.lender || 'SimLender'
    const amount_kes = Number(req.body.amount_kes || 1000)

    const preimage = randomHex(32)
    const payment_hash = crypto.createHash('sha256').update(preimage).digest('hex')
    const amount = Math.round(amount_kes * 1000)
    const memo = `${lender}-${farmer_id}-${new Date().toISOString().slice(0,10)}`

    const payload = { payment_hash, preimage, amount, memo }
    console.info('simulating webhook', { farmer_id, lender, amount_kes })

    const result = await processPayment(payload)
    res.json({ simulated: true, payload, result })
  } catch (err) {
    console.error('sim webhook error', err)
    res.status(500).json({ error: 'sim webhook failed', message: err.message })
  }
})

module.exports = router
