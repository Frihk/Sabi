const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const db = require('../database/adapter')
const { hasKey, decrypt } = require('../lib/crypto')

// Verify a credential by raw preimage + payment_hash (lender receives these out-of-band)
// Lightning preimages are hex byte arrays — must decode as hex, NOT utf8
router.post('/', (req, res) => {
  try {
    const { preimage, payment_hash } = req.body
    if (!preimage || !payment_hash) return res.status(400).json({ error: 'preimage and payment_hash required' })
    const hash = crypto.createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
    const valid = hash === payment_hash
    res.json({ valid, message: valid ? 'Payment verified — SHA256(preimage) matches payment_hash' : 'Invalid credential' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
