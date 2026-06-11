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
    db.logWebhook('payment', payload)

    const { payment_hash, preimage, amount, memo } = payload
    const { lender, farmer_id } = parseMemo(memo)
    const amount_kes = amount ? (Number(amount) / 1000) : null

    let saved = false
    if (payment_hash && preimage && farmer_id) {
      creds.createFarmerIfNotExists({ id: farmer_id })
      creds.saveProof({ farmer_id, lender, amount_kes, payment_hash, preimage, memo })
      saved = true
    }

    return { ok: true, saved, farmer_id, lender, amount_kes }
  } catch (err) {
    throw err
  }
}