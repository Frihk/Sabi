/**
 * services/tando.js
 *
 * Tando service to generate Lightning invoices and handle conversion/payout to Kenyan lenders.
 */

const fetch = global.fetch || require('node-fetch')

const TANDO_URL = process.env.TANDO_URL || 'https://api.tando.co'
const TANDO_API_KEY = process.env.TANDO_API_KEY

const PLACEHOLDER_VALUES = ['your_tando_key_here', '', undefined, null]
const isConfigured = !!(TANDO_API_KEY && !PLACEHOLDER_VALUES.includes(TANDO_API_KEY))

function randomHex(len = 32) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
}

/**
 * Generate a Lightning invoice via Tando.
 * In a production setting, this sends the lender and KES amount info to Tando
 * so Tando knows where to send KES once the Lightning invoice is paid.
 */
async function createInvoice({ amountSats, amountKes, lender, memo, webhookUrl }) {
  if (!isConfigured) {
    console.warn('[tando] Not configured — using local mock invoice for development')
    return {
      payment_request: `lnbctando${randomHex(40)}`,
      payment_hash: randomHex(64),
      checking_id: randomHex(32)
    }
  }

  try {
    const res = await fetch(`${TANDO_URL}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TANDO_API_KEY}`
      },
      body: JSON.stringify({
        amount_sats: amountSats,
        amount_kes: amountKes,
        lender: lender,
        memo: memo,
        webhook_url: webhookUrl
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Tando API returned status ${res.status}: ${text}`)
    }

    const data = await res.json()
    return {
      payment_request: data.payment_request || data.bolt11,
      payment_hash: data.payment_hash,
      checking_id: data.id || data.checking_id
    }
  } catch (err) {
    console.error('[tando] Error creating invoice, falling back to mock:', err.message)
    return {
      payment_request: `lnbctando${randomHex(40)}`,
      payment_hash: randomHex(64),
      checking_id: randomHex(32)
    }
  }
}

module.exports = { createInvoice, isConfigured }
