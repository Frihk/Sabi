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
router.post('/simulate_payment', async (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ error: 'admin token required' })
  const { farmer_id = 'jmwangi_kisii', lender = 'AdminSim', amount_kes = 100 } = req.body
  // generate preimage+hash
  const crypto = require('crypto')
  const preimage = crypto.randomBytes(16).toString('hex')
  const payment_hash = crypto.createHash('sha256').update(preimage).digest('hex')
  
  await creds.saveProof({ 
    farmer_id, 
    lender, 
    amount_kes, 
    payment_hash, 
    preimage, 
    memo: `${lender}-${farmer_id}-${new Date().toISOString().slice(0,10)}` 
  })
  
  res.json({ ok: true, farmer_id, lender, amount_kes, payment_hash })
})

// Admin: decrypt a proof's preimage by id (requires ADMIN_TOKEN and PREIMAGE_KEY set)
router.get('/decrypt/:id', async (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ error: 'admin token required' })
  const proof = await db.getProofById(req.params.id)
  if (!proof) return res.status(404).json({ error: 'proof not found' })
  if (!proof.preimage_encrypted) return res.status(404).json({ error: 'no encrypted preimage stored' })
  if (!hasKey()) return res.status(500).json({ error: 'PREIMAGE_KEY not configured on server' })
  const plain = decrypt(proof.preimage_encrypted)
  if (!plain) return res.status(500).json({ error: 'decryption failed' })
  res.json({ id: proof.id, preimage: plain })
})

module.exports = router
