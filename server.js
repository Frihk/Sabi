require('dotenv').config()
const express = require('express')
const path = require('path')

const invoiceRouter = require('./routes/invoice')
const webhookRouter = require('./routes/webhook')
const passportRouter = require('./routes/passport')
const verifyRouter = require('./routes/verify')
const farmersRouter = require('./routes/farmers')
const adminRouter = require('./routes/admin')
const { init } = require('./database/adapter')
const poller = require('./services/poller')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/invoice', invoiceRouter)
app.use('/api/webhook', webhookRouter)
app.use('/api/passport', passportRouter)
app.use('/api/verify', verifyRouter)   // POST / (raw preimage)  +  GET /:id (server-side by proof id)
app.use('/api/farmers', farmersRouter)
app.use('/api/admin', adminRouter)

// Disable caching for static files in dev so JS/CSS changes apply immediately
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  }
}))

/ initialize DB (adapter.init may be async)
;(async () => {
  try {
    const maybe = init()
    if (maybe && typeof maybe.then === 'function') await maybe
    poller.start()
  } catch (e) {
    console.error('DB init failed', e)
    process.exit(1)
  }
})()

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Server error' })
})

const server = app.listen(PORT, () => {
  console.log(`Sabi running on port ${PORT}`)
})

server.on('error', err => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} in use — stop the other process or set PORT env var.`)
    process.exit(1)
  }
  console.error('Server error', err)
  process.exit(1)
})
