require('dotenv').config()
const fetch = require('node-fetch')

async function testLNbits() {
  const url = `${process.env.LNBITS_URL}/api/v1/wallet`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': process.env.LNBITS_API_KEY }
    })
    const text = await res.text()
    console.log(`[LNbits Test] Status: ${res.status}, Response: ${text}`)
  } catch (err) {
    console.log(`[LNbits Test] Error: ${err.message}`)
  }
}

async function testMavaPay() {
  const isProd = process.env.MAVAPAY_ENV === 'production'
  const baseUrl = isProd ? 'https://api.mavapay.co/api/v1' : 'https://staging.api.mavapay.co/api/v1'
  const url = `${baseUrl}/quote`
  
  try {
    // Make a dummy request to check key validity
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.MAVAPAY_API_KEY
      },
      body: JSON.stringify({
        amount: "10",
        sourceCurrency: 'KESCENT',
        targetCurrency: 'BTCSAT',
        paymentMethod: 'MOBILEMONEY',
        paymentCurrency: 'BTCSAT',
        autopayout: true,
        beneficiary: { lnInvoice: "lnbc..." },
        phoneNumber: "+254790000000"
      })
    })
    const text = await res.text()
    console.log(`[MavaPay Test] Status: ${res.status}, Response: ${text}`)
  } catch (err) {
    console.log(`[MavaPay Test] Error: ${err.message}`)
  }
}

async function run() {
  console.log('Testing APIs using credentials in .env...')
  await testLNbits()
  await testMavaPay()
}

run()
