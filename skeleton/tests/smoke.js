const TEST_URL = process.env.TEST_URL || 'http://localhost:4000'
const fetch = global.fetch || require('node-fetch')
const timeout = ms => new Promise(res => setTimeout(res, ms))

async function fetchJson(path, opts = {}) {
  const res = await fetch(TEST_URL + path, opts)
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch(e) { data = text }
  return { status: res.status, data }
}

async function run() {
  console.log('Smoke tests against', TEST_URL)
  try {
    // 1) GET passport (seeded)
    let r = await fetchJson('/api/passport/jmwangi_kisii')
    console.log('GET /api/passport/jmwangi_kisii', r.status)
    if (r.status !== 200) throw new Error('passport fetch failed')

    // 2) call sim webhook to create a proof
    r = await fetchJson('/api/webhook/sim', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ farmer_id: 'jmwangi_kisii', lender: 'SmokeTest', amount_kes: 123 }) })
    console.log('POST /api/webhook/sim', r.status)
    if (r.status !== 200 || !r.data || !r.data.result) throw new Error('sim webhook failed')

    // wait briefly for writes
    await timeout(200)

    // 3) verify the passport now has at least one proof
    r = await fetchJson('/api/passport/jmwangi_kisii')
    console.log('GET /api/passport (after sim)', r.status)
    if (r.status !== 200) throw new Error('passport fetch failed after sim')
    const proofs = (r.data && r.data.proofs) || []
    console.log('Proofs count:', proofs.length)
    if (proofs.length < 1) throw new Error('no proofs recorded')

    // 4) create invoice (uses LNbits mock when not configured)
    r = await fetchJson('/api/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-farmer-token': 'sabi_farmer_default_token'
      },
      body: JSON.stringify({ farmer_id: 'jmwangi_kisii', lender: 'SmokeTest', amount_kes: 50 })
    })
    console.log('POST /api/invoice', r.status)
    if (r.status !== 200) throw new Error('invoice creation failed')
    if (!r.data || !r.data.payment_request) throw new Error('no payment_request returned')

    // 5) profile save
    r = await fetchJson('/api/farmers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-farmer-token': 'sabi_farmer_default_token'
      },
      body: JSON.stringify({ id: 'smokefarmer', name: 'Smoke Farmer', county: 'Test' })
    })
    console.log('POST /api/farmers create', r.status)
    if (r.status !== 201) throw new Error('create farmer failed')

    r = await fetchJson('/api/farmers/smokefarmer', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-farmer-token': 'sabi_farmer_default_token'
      },
      body: JSON.stringify({ name: 'Smoke Farmer 2', county: 'Test2' })
    })
    console.log('PUT /api/farmers/smokefarmer', r.status)
    if (r.status !== 200) throw new Error('update farmer failed')

    console.log('\nSMOKE TESTS PASSED')
    process.exit(0)
  } catch (err) {
    console.error('SMOKE TESTS FAILED:', err.message)
    process.exit(2)
  }
}

run()
