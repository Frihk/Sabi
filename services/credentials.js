const db = require('../database/adapter')
const { calculateScore } = require('./scoring')
const { hasKey, encrypt } = require('../lib/crypto')

function createInvoiceRecord({ payment_request, payment_hash, farmer_id, lender, amount_kes }) {
  db.insertInvoice({ payment_request, payment_hash, farmer_id, lender, amount_kes })
}

function saveProof({ farmer_id, lender, amount_kes, payment_hash, preimage, memo }) {
  let preimage_encrypted = null
  if (preimage) {
    if (hasKey()) {
      preimage_encrypted = encrypt(preimage)
    } else {
      // store raw preimage only if no key available (dev mode)
      preimage_encrypted = null
    }
  }
  db.insertProof({ farmer_id, lender, amount_kes, payment_hash, preimage_encrypted, memo, on_time: 1 })
  // update aggregates
  const proofs = db.getProofsByFarmer(farmer_id)
  const farmer = db.getFarmer(farmer_id) || { defaults: 0 }
  const score = calculateScore(proofs, farmer.defaults || 0)
  db.updateFarmerAggregates(farmer_id, score, proofs.length)
}

function getPassport(farmer_id) {
  return db.getPassport(farmer_id)
}

function getFarmer(farmer_id) {
  return db.getFarmer(farmer_id)
}

function createFarmerIfNotExists({ id, name, county }) {
  db.createFarmerIfNotExists({ id, name, county })
}

module.exports = {
  createInvoiceRecord,
  saveProof,
  getPassport,
  getFarmer,
  createFarmerIfNotExists
}
