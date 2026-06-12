const crypto = require('crypto')

const KEY = process.env.PREIMAGE_KEY || null

function hasKey() {
  return !!KEY
}

function getKeyBuffer() {
  // Expect PREIMAGE_KEY to be hex or base64; try hex first
  if (!KEY) return null
  try { return Buffer.from(KEY, 'hex') } catch (e) {}
  try { return Buffer.from(KEY, 'base64') } catch (e) {}
  return Buffer.from(KEY)
}
