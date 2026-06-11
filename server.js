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

