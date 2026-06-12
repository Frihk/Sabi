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

// Verify a stored proof by its ID (server-side — lender only needs the proof ID, not the raw preimage)
router.get('/:id', async (req, res) => {
  try {
    const proof = await db.getProofById(req.params.id)
    if (!proof) return res.status(404).json({ error: 'proof not found' })

    if (!proof.preimage_encrypted) {
      return res.status(422).json({ error: 'preimage not stored for this proof (dev mode — no PREIMAGE_KEY set)' })
    }
    if (!hasKey()) {
      return res.status(500).json({ error: 'PREIMAGE_KEY not configured on server — cannot verify server-side' })
    }

    const preimage = decrypt(proof.preimage_encrypted)
    if (!preimage) return res.status(500).json({ error: 'decryption failed' })

    const hash = crypto.createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
    const valid = hash === proof.payment_hash

    res.json({
      valid,
      proof_id: proof.id,
      farmer_id: proof.farmer_id,
      lender: proof.lender,
      amount_kes: proof.amount_kes,
      date: (proof.created_at || '').slice(0, 10),
      on_time: !!proof.on_time,
      message: valid ? 'Payment verified — preimage matches payment_hash' : 'Invalid — preimage does not match'
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
