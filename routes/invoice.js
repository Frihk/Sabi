const express = require('express')
const router = express.Router()
const tando = require('../services/tando')
const mavapay = require('../services/mavapay')
const creds = require('../services/credentials')
const db = require('../database/adapter')
const QRCode = require('qrcode')

const { rateLimiter } = require('../lib/middleware')

const SATS_PER_KES = parseFloat(process.env.SATS_PER_KES || '0.35')

function getWebhookUrl(req) {
  if (process.env.NGROK_URL) return `${process.env.NGROK_URL.replace(/\/$/, '')}/api/webhook/payment`
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || 3001}`
  const protocol = req.headers['x-forwarded-proto'] || 'http'
  return `${protocol}://${host}/api/webhook/payment`
}

// POST /api/invoice — create a Lightning invoice (rate limited to 5 per minute)
router.post('/', rateLimiter(5, 60000), async (req, res, next) => {
  try {
    const { farmer_id, lender, amount_kes, phone_number } = req.body
    if (!farmer_id || !lender || !amount_kes) {
      return res.status(400).json({ error: 'farmer_id, lender, amount_kes required' })
    }

    const sats = Math.max(1, Math.round(Number(amount_kes) * SATS_PER_KES))
    const memo = `${lender}-${farmer_id}-${new Date().toISOString().slice(0, 10)}`
    const webhookUrl = getWebhookUrl(req)

    // 1. Generate Lightning Invoice via Tando
    const data = await tando.createInvoice({ amountSats: sats, amountKes: Number(amount_kes), lender, memo, webhookUrl })

    const payment_request = data.payment_request || data.bolt11 || data.payreq || null
    const payment_hash    = data.payment_hash   || data.checking_id || data.r_hash || null

    if (!payment_request) return res.status(502).json({ error: 'Tando did not return a payment request' })

    creds.createInvoiceRecord({ payment_request, payment_hash, farmer_id, lender, amount_kes })

    const proofs = db.getProofsByFarmer(farmer_id) || []
    const proof_count = proofs.length

    const qr_code = await QRCode.toDataURL(payment_request)

    // 2. If phone number is supplied, trigger MavaPay STK Push
    let mavapay_quote = null
    if (phone_number && phone_number.trim() !== '') {
      try {
        mavapay_quote = await mavapay.triggerStkPush({
          amountKes: Number(amount_kes),
          amountSats: sats,
          lnInvoice: payment_request,
          phoneNumber: phone_number.trim()
        })
      } catch (err) {
        console.error('[mavapay] STK push trigger failed:', err.message)
        // We do not fail the request entirely, just report the error so they can pay manually via QR
        mavapay_quote = { error: 'STK push failed: ' + err.message }
      }
    }

    res.json({ payment_request, payment_hash, qr_code, proof_count, mavapay_quote })
  } catch (err) {
    next(err)
  }
})

// GET /api/invoice/status/:payment_hash
// Returns whether this invoice has been settled (i.e. a proof exists for this hash)
router.get('/status/:payment_hash', (req, res) => {
  try {
    const { payment_hash } = req.params
    // Look for a saved proof matching this payment hash
    const state = typeof db.load === 'function' ? db.load() : null
    const proofs = state ? (state.proofs || []) : []
    const proof = proofs.find(p => p.payment_hash === payment_hash)

    if (proof) {
      return res.json({
        status: 'paid',
        farmer_id: proof.farmer_id,
        lender: proof.lender,
        amount_kes: proof.amount_kes,
        proof_id: proof.id,
        on_time: !!proof.on_time
      })
    }

    // Check if the invoice exists at all
    const invoices = state ? (state.invoices || []) : []
    const invoice = invoices.find(i => i.payment_hash === payment_hash)
    if (!invoice) return res.status(404).json({ status: 'not_found' })

    res.json({ status: 'pending' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
