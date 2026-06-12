require('dotenv').config()
const fetch = require('node-fetch')

async function testEndpoint(name, url) {
  try {
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
    console.log(`[${name}] Status: ${res.status}, Response: ${text}`)
  } catch (err) {
    console.log(`[${name}] Error: ${err.message}`)
  }
}

async function run() {
  const key = process.env.MAVAPAY_API_KEY
  console.log(`Testing key: ${key ? key.slice(0, 6) + '...' : 'none'}`)
  console.log('Testing Staging...')
  await testEndpoint('Staging', 'https://staging.api.mavapay.co/api/v1/quote')
  console.log('Testing Production...')
  await testEndpoint('Production', 'https://api.mavapay.co/api/v1/quote')
}

run()
