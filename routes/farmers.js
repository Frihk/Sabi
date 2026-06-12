const express = require('express')
const router = express.Router()
const db = require('../database/adapter')
const { authenticateFarmer } = require('../lib/middleware')

router.post('/', authenticateFarmer, async (req, res) => {
  try {
    const { id, name, county } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    await db.createFarmerIfNotExists({ id, name, county })
    const farmer = await db.getFarmer(id)
    res.status(201).json(farmer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const farmer = await db.getFarmer(req.params.id)
    if (!farmer) return res.status(404).json({ error: 'farmer not found' })
    res.json(farmer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', authenticateFarmer, async (req, res) => {
  try {
    const id = req.params.id
    const fields = {}
    if (req.body.name) fields.name = req.body.name
    if (req.body.county) fields.county = req.body.county
    if (req.body.defaults !== undefined) fields.defaults = Number(req.body.defaults)
    
    await db.updateFarmer(id, fields)
    const farmer = await db.getFarmer(id)
    if (!farmer) return res.status(404).json({ error: 'farmer not found' })
    res.json(farmer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
