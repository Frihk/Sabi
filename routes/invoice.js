const express = require('express')
const router = express.Router()
const tando = require('../services/tando')
const mavapay = require('../services/mavapay')
const creds = require('../services/credentials')
const db = require('../database/adapter')
const QRCode = require('qrcode')

const { rateLimiter } = require('../lib/middleware')

const SATS_PER_KES = parseFloat(process.env.SATS_PER_KES || '0.35')

function getWebhookUrl(req) {
  if (process.env.NGROK_URL) return `${process.env.NGROK_URL.replace(/\/$/, '')}/api/webhook/payment`
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || 3001}`
  const protocol = req.headers['x-forwarded-proto'] || 'http'
  return `${protocol}://${host}/api/webhook/payment`
}