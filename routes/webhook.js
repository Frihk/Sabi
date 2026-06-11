const express = require('express')
const router = express.Router()
const creds = require('../services/credentials')
const db = require('../database/adapter')
const crypto = require('crypto')

function randomHex(len = 32) {
  return crypto.randomBytes(len).toString('hex')
}