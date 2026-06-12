/**
 * services/mavapay.js
 *
 * MavaPay integration for fiat-to-Lightning payment trigger.
 *
 * Flow:
 *   1. Sabi gets Lightning invoice from Tando (which will convert it back and pay the lender)
 *   2. Sabi triggers MavaPay quote with KESCENT -> BTCSAT, autopayout: true,
 *      beneficiary: Tando's lnInvoice, and the farmer's phoneNumber.
 *   3. MavaPay triggers M-Pesa STK push prompt on farmer's phone.
 *   4. Farmer enters PIN -> payment completes -> MavaPay pays Tando's Lightning invoice.
 *   5. Tando receives the payment, pays the lender in KES, and fires Sabi's webhook.
 */

const fetch = global.fetch || require('node-fetch')

const MAVAPAY_API_KEY = process.env.MAVAPAY_API_KEY
const MAVAPAY_ENV = process.env.MAVAPAY_ENV || 'staging'

const BASE_URL = MAVAPAY_ENV === 'production'
  ? 'https://api.mavapay.co/api/v1'
  : 'https://staging.api.mavapay.co/api/v1'

const PLACEHOLDER_VALUES = ['your_mavapay_api_key_here', '', undefined, null]
const isConfigured = !!(MAVAPAY_API_KEY && !PLACEHOLDER_VALUES.includes(MAVAPAY_API_KEY))

/**
 * Trigger an M-Pesa STK Push prompt via MavaPay to pay a Lightning invoice.
 *
 * @param {object} params
 * @param {number} params.amountKes   - KES amount (e.g. 4500)
 * @param {number} params.amountSats  - Sats amount matching the Tando invoice
 * @param {string} params.lnInvoice   - Tando's Lightning invoice to pay
 * @param {string} params.phoneNumber - Farmer's phone number (+254...)
 */
async function triggerStkPush({ amountKes, amountSats, lnInvoice, phoneNumber }) {
  if (!isConfigured) {
    console.warn('[mavapay] Not configured — returning mock STK Push response')
    return {
      success: true,
      stkTriggered: true,
      orderId: `MP-MOCK-${Date.now()}`,
      amountKes,
      phoneNumber,
      message: `M-Pesa STK Push prompt sent to ${phoneNumber}. Please input your PIN on your phone.`
    }
  }

  const res = await fetch(`${BASE_URL}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': MAVAPAY_API_KEY
    },
    body: JSON.stringify({
      amount: amountSats.toString(),
      sourceCurrency: 'KES',
      targetCurrency: 'BTCSAT',
      paymentMethod: 'MOBILEMONEY', // M-Pesa
      paymentCurrency: 'BTCSAT',
      autopayout: true,
      beneficiary: {
        lnInvoice: lnInvoice
      },
      // Pass phone number for STK Push initiation
      phoneNumber: phoneNumber,
      metadata: {
        phoneNumber: phoneNumber
      }
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MavaPay STK Push trigger failed: ${res.status} ${text}`)
  }

  const json = await res.json()
  const d = json.data || json

  return {
    success: true,
    stkTriggered: true,
    orderId: d.orderId || d.id,
    amountKes: Math.round(d.amountInSourceCurrency / 100) || amountKes,
    phoneNumber: phoneNumber,
    message: `M-Pesa STK Push prompt sent to ${phoneNumber}. Please input your PIN.`
  }
}

/**
 * Simulate the completion of an STK push payment in staging/development.
 * This simulates the farmer successfully entering their PIN, leading to the payment of Tando's invoice.
 */
async function simulateStkPayment(orderId, amountKes) {
  if (!isConfigured) {
    console.warn('[mavapay] Not configured — skipping simulation API call')
    return { simulated: true, mock: true }
  }

  const res = await fetch(`${BASE_URL}/simulation/pay-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': MAVAPAY_API_KEY
    },
    body: JSON.stringify({
      currency: 'KES',
      quoteId: orderId,
      amount: amountKes * 100 // cents
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MavaPay simulation failed: ${res.status} ${text}`)
  }

  return res.json()
}

module.exports = { triggerStkPush, simulateStkPayment, isConfigured }
