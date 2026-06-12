const db = require('../database/adapter')
const { calculateScore } = require('./scoring')
const { hasKey, encrypt } = require('../lib/crypto')

async function createInvoiceRecord({ payment_request, payment_hash, farmer_id, lender, amount_kes }) {
  return await db.insertInvoice({ payment_request, payment_hash, farmer_id, lender, amount_kes })
}

async function saveProof({ farmer_id, lender, amount_kes, payment_hash, preimage, memo }) {
  let preimage_encrypted = null
  if (preimage) {
    if (hasKey()) {
      preimage_encrypted = encrypt(preimage)
    } else {
      // store raw preimage only if no key available (dev mode)
      preimage_encrypted = null
    }
  }
  
  await db.insertProof({ farmer_id, lender, amount_kes, payment_hash, preimage_encrypted, memo, on_time: 1 })
  
  // update aggregates
  const [proofs, farmer] = await Promise.all([
    db.getProofsByFarmer(farmer_id),
    db.getFarmer(farmer_id)
  ])
  
  const defaults = farmer ? (farmer.defaults || 0) : 0
  const score = calculateScore(proofs || [], defaults)
  
  await db.updateFarmerAggregates(farmer_id, score, (proofs || []).length)
}

async function getPassport(farmer_id) {
  return await db.getPassport(farmer_id)
}

async function getFarmer(farmer_id) {
  return await db.getFarmer(farmer_id)
}

async function createFarmerIfNotExists({ id, name, county }) {
  return await db.createFarmerIfNotExists({ id, name, county })
}

module.exports = {
  createInvoiceRecord,
  saveProof,
  getPassport,
  getFarmer,
  createFarmerIfNotExists
}
