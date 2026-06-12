const TEST_URL = process.env.TEST_URL || 'http://localhost:4000'
const fetch = global.fetch || require('node-fetch')

async function fetchText(path, opts = {}) {
  const res = await fetch(TEST_URL + path, opts)
  const text = await res.text()
  return { status: res.status, text, contentType: res.headers.get('content-type') || '' }
}

async function fetchJson(path, opts = {}) {
  const { status, text, contentType } = await fetchText(path, opts)
  let data
  try { data = JSON.parse(text) } catch(e) { data = text }
  return { status, data, contentType }
}

async function run() {
  console.log('PWA smoke tests against', TEST_URL)
  try {
    let r = await fetchText('/')
    console.log('GET /', r.status)
    if (r.status !== 200 || !r.text.includes('manifest.webmanifest')) {
      throw new Error('app shell failed')
    }

    r = await fetchJson('/manifest.webmanifest')
    console.log('GET /manifest.webmanifest', r.status)
    if (r.status !== 200 || r.data.name !== 'SabiCredit') {
      throw new Error('manifest failed')
    }

    r = await fetchText('/service-worker.js')
    console.log('GET /service-worker.js', r.status)
    if (r.status !== 200 || !r.text.includes('self.addEventListener')) {
      throw new Error('service worker failed')
    }

    r = await fetchText('/offline.html')
    console.log('GET /offline.html', r.status)
    if (r.status !== 200 || !r.text.includes('Offline mode')) {
      throw new Error('offline page failed')
    }

    r = await fetchJson('/api/passport/jmwangi_kisii')
    console.log('GET /api/passport/jmwangi_kisii', r.status)
    if (r.status !== 200 || !r.data || !r.data.farmer) {
      throw new Error('passport fetch failed')
    }

    const proofs = (r.data && r.data.proofs) || []
    console.log('Proofs count:', proofs.length)
    if (proofs.length < 1) throw new Error('no demo proofs returned')

    console.log('\nPWA SMOKE TESTS PASSED')
    process.exit(0)
  } catch (err) {
    console.error('PWA SMOKE TESTS FAILED:', err.message)
    process.exit(2)
  }
}

run()
