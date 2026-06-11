const express = require('express')
const router = express.Router()
const QRCode = require('qrcode')
const creds = require('../services/credentials')

router.get('/:farmer_id', (req, res) => {
  try {
    const farmer_id = req.params.farmer_id
    const passport = creds.getPassport(farmer_id)
    if (!passport) return res.status(404).json({ error: 'farmer not found' })
    res.json(passport)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})