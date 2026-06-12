const fetch = global.fetch || require('node-fetch')

const LNBITS_URL = process.env.LNBITS_URL
const LNBITS_API_KEY = process.env.LNBITS_API_KEY

const PLACEHOLDER_VALUES = ['your_invoice_key_here', 'your_key', '', undefined, null]
const isConfigured = !!(LNBITS_URL && LNBITS_API_KEY && !PLACEHOLDER_VALUES.includes(LNBITS_API_KEY))

function randomHex(len = 32) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
}

async function createInvoice({ amountSats, memo, webhookUrl }) {
  if (!isConfigured) {
    console.warn('LNBITS not configured (or using placeholder key) — using local mock invoice for development')
    return {
      payment_request: `lnbc1mock${randomHex(40)}`,
      payment_hash: randomHex(64),
      checking_id: randomHex(32)
    }
  }

  const base = LNBITS_URL.replace(/\/$/, '')
  const url = `${base}/api/v1/payments`
  const body = {
    out: false,
    amount: amountSats,
    memo,
    webhook: webhookUrl
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': LNBITS_API_KEY
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LNbits create invoice failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data
}

async function getPayment(paymentHash) {
  if (!isConfigured) {
    console.warn('LNBITS not configured — returning mocked payment state')
    return { paid: false }
  }

  const url = `${LNBITS_URL.replace(/\/$/, '')}/api/v1/payments/${paymentHash}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Api-Key': LNBITS_API_KEY }
  })
  if (!res.ok) throw new Error(`LNbits getPayment failed: ${res.status}`)
  return res.json()
}

module.exports = { createInvoice, getPayment }
