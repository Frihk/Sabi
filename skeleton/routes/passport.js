const express = require('express')
const router = express.Router()
const QRCode = require('qrcode')
const creds = require('../services/credentials')

function toPassportResponse(passport) {
  const { proofs = [], ...farmer } = passport
  return {
    farmer,
    proofs,
    farmer_id: farmer.id,
    name: farmer.name,
    county: farmer.county,
    score: farmer.score,
    loans_repaid: farmer.loans_repaid,
    defaults: farmer.defaults
  }
}

router.get('/:farmer_id', async (req, res) => {
  try {
    const farmer_id = req.params.farmer_id
    const passport = await creds.getPassport(farmer_id)
    if (!passport) return res.status(404).json({ error: 'farmer not found' })
    res.json(toPassportResponse(passport))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:farmer_id/qr', async (req, res) => {
  try {
    const farmer_id = req.params.farmer_id
    const passport = await creds.getPassport(farmer_id)
    if (!passport) return res.status(404).json({ error: 'farmer not found' })
    const json = JSON.stringify(toPassportResponse(passport))
    const qr = await QRCode.toDataURL(json)
    res.json({ qr })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
