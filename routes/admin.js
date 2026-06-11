const express = require('express')
const router = express.Router()
const creds = require('../services/credentials')
const db = require('../database/adapter')
const { hasKey, decrypt } = require('../lib/crypto')

function checkAdmin(req, res) {
  const token = process.env.ADMIN_TOKEN
  const header = req.headers['x-admin-token']
  if (!token) return false
  return header === token
}
