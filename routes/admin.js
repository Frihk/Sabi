const express = require('express')
const router = express.Router()
const creds = require('../services/credentials')
const db = require('../database/adapter')
const { hasKey, decrypt } = require('../lib/crypto')

function checkAdmin(req, res) {
  const token = process.env.ADMIN_TOKEN
  const header = req.headers['x-admin-token']
  if (!token) return false
  return header === token
}

// Admin: simulate payment (creates proof) — requires ADMIN_TOKEN header
router.post('/simulate_payment', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ error: 'admin token required' })
  const { farmer_id = 'jmwangi_kisii', lender = 'AdminSim', amount_kes = 100 } = req.body
  // generate preimage+hash
  const crypto = require('crypto')
  const preimage = crypto.randomBytes(16).toString('hex')
  const payment_hash = crypto.createHash('sha256').update(preimage).digest('hex')
  creds.saveProof({ farmer_id, lender, amount_kes, payment_hash, preimage, memo: `${lender}-${farmer_id}-${new Date().toISOString().slice(0,10)}` })
  res.json({ ok: true, farmer_id, lender, amount_kes, payment_hash })
})
