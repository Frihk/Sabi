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

async function payInvoice(bolt11) {
  if (!isConfigured) {
    console.warn('LNBITS not configured — mocking outgoing payment')
    return { success: true, payment_hash: 'mock-outgoing-hash' }
  }

  const base = LNBITS_URL.replace(/\/$/, '')
  const url = `${base}/api/v1/payments`
  const body = {
    out: true,
    bolt11: bolt11
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
    throw new Error(`LNbits pay invoice failed: ${res.status} ${text}`)
  }

  return res.json()
}

async function resolveLightningAddress(address, amountSats) {
  const parts = address.split('@')
  if (parts.length !== 2) {
    throw new Error(`Invalid Lightning Address format: ${address}`)
  }
  const username = parts[0]
  const domain = parts[1]

  const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${username}`
  const response = await fetch(lnurlpUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch LNURL metadata for ${address}: ${response.status}`)
  }
  const payParams = await response.json()
  
  const amountMsat = amountSats * 1000
  const callbackUrl = new URL(payParams.callback)
  callbackUrl.searchParams.set('amount', amountMsat.toString())

  const invoiceResponse = await fetch(callbackUrl.toString())
  if (!invoiceResponse.ok) {
    throw new Error(`Failed to fetch BOLT11 from callback for ${address}: ${invoiceResponse.status}`)
  }
  const invoiceData = await invoiceResponse.json()
  if (!invoiceData.pr) {
    throw new Error(`No BOLT11 invoice (pr) returned for ${address}`)
  }

  return invoiceData.pr
}

async function payoutLender({ lender, amountSats }) {
  if (!lender) return { skipped: true, reason: 'No lender specified' }

  const clean = lender.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  let destination = process.env[`LENDER_${clean}_DESTINATION`]
  if (!destination) {
    const firstWord = clean.split('_')[0]
    destination = process.env[`LENDER_${firstWord}_DESTINATION`]
  }

  if (!destination) {
    console.info(`[payout] No payout destination configured for lender: ${lender}`)
    return { skipped: true, reason: 'No destination configured' }
  }

  console.info(`[payout] Initiating automatic forward of ${amountSats} Sats to ${lender} at ${destination}`)

  try {
    let bolt11 = destination
    if (destination.includes('@')) {
      bolt11 = await resolveLightningAddress(destination, amountSats)
    }

    const result = await payInvoice(bolt11)
    console.info(`[payout] Successfully forwarded ${amountSats} Sats to ${lender}. Hash: ${result.payment_hash}`)
    return { success: true, payment_hash: result.payment_hash }
  } catch (err) {
    console.error(`[payout] Forwarding payment of ${amountSats} Sats to ${lender} failed:`, err.message)
    return { success: false, error: err.message }
  }
}

module.exports = { createInvoice, getPayment, payInvoice, resolveLightningAddress, payoutLender }
