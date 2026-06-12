const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PORT || 4000)
const PUBLIC_DIR = path.join(__dirname, 'public')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8'
}

const demoPassport = {
  farmer: {
    id: 'jmwangi_kisii',
    name: 'Jane Mwangi',
    county: 'Kisii',
    score: 742,
    loans_repaid: 5,
    defaults: 0
  },
  proofs: [
    {
      lender: 'Apollo Agriculture',
      amount_kes: 4500,
      date: '2026-06-08',
      payment_hash: 'a3f9bc72e1d4',
      on_time: true
    },
    {
      lender: 'Kisii SACCO',
      amount_kes: 2000,
      date: '2026-05-01',
      payment_hash: 'd84f1c39e720',
      on_time: true
    }
  ]
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname.startsWith('/api/passport/')) {
    sendJson(res, passportFor(url.pathname.replace('/api/passport/', '')))
    return
  }

  if (url.pathname === '/api/health') {
    sendJson(res, { ok: true })
    return
  }

  serveStatic(url.pathname, res)
})

server.listen(PORT, () => {
  console.log(`SabiCredit PWA running at http://localhost:${PORT}`)
})

function passportFor(rawId) {
  const id = decodeURIComponent(rawId || demoPassport.farmer.id)
  return {
    ...demoPassport,
    farmer: {
      ...demoPassport.farmer,
      id
    }
  }
}

function serveStatic(urlPath, res) {
  const safePath = normalizePath(urlPath)
  const filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath)

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, fallback) => {
        if (fallbackError) {
          sendText(res, 404, 'Not found')
          return
        }

        sendContent(res, 'text/html; charset=utf-8', fallback)
      })
      return
    }

    const contentType = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream'
    sendContent(res, contentType, content)
  })
}

function normalizePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0])
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '')
  return safePath.replace(/^[/\\]/, '')
}

function sendJson(res, payload) {
  sendContent(res, 'application/json; charset=utf-8', JSON.stringify(payload))
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(text)
}

function sendContent(res, contentType, content) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': contentType.includes('text/html') ? 'no-cache' : 'public, max-age=3600'
  })
  res.end(content)
}
