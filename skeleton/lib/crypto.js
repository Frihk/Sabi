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

function encrypt(text) {
  const key = getKeyBuffer()
  if (!key || key.length < 32) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key.slice(0,32), iv)
  const encrypted = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decrypt(enc) {
  const key = getKeyBuffer()
  if (!key || key.length < 32) return null
  try {
    const data = Buffer.from(enc, 'base64')
    const iv = data.slice(0,12)
    const tag = data.slice(12,28)
    const encrypted = data.slice(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key.slice(0,32), iv)
    decipher.setAuthTag(tag)
    const out = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return out.toString('utf8')
  } catch (e) {
    return null
  }
}

module.exports = { hasKey, encrypt, decrypt }
