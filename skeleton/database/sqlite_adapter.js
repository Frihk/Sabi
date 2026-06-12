const { getDb } = require('./db')

/**
 * Helper to run a command (INSERT, UPDATE, DELETE) and return a promise.
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

/**
 * Helper to get a single row from a query.
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

/**
 * Helper to get all rows from a query.
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

const adapter = {
  // --- Farmers ---

  async getFarmer(id) {
    return get('SELECT * FROM farmers WHERE id = ?', [id])
  },

  async createFarmerIfNotExists({ id, name = '', county = '' }) {
    return run(
      'INSERT OR IGNORE INTO farmers (id, name, county, score, loans_repaid, defaults) VALUES (?, ?, ?, 300, 0, 0)',
      [id, name, county]
    )
  },

  async updateFarmer(id, { name, county }) {
    return run(
      'UPDATE farmers SET name = COALESCE(?, name), county = COALESCE(?, county) WHERE id = ?',
      [name, county, id]
    )
  },

  async updateFarmerAggregates(id, score, loans_repaid) {
    return run(
      'UPDATE farmers SET score = ?, loans_repaid = ? WHERE id = ?',
      [score, loans_repaid, id]
    )
  },

  // --- Invoices ---

  async insertInvoice({ payment_request, payment_hash, farmer_id, lender, amount_kes }) {
    return run(
      'INSERT INTO invoices (payment_request, payment_hash, farmer_id, lender, amount_kes) VALUES (?, ?, ?, ?, ?)',
      [payment_request, payment_hash, farmer_id, lender, amount_kes]
    )
  },

  async getInvoiceByHash(payment_hash) {
    return get('SELECT * FROM invoices WHERE payment_hash = ?', [payment_hash])
  },

  // --- Proofs ---

  async insertProof({ farmer_id, lender, amount_kes, payment_hash, preimage_encrypted, memo, on_time = 1 }) {
    return run(
      'INSERT INTO proofs (farmer_id, lender, amount_kes, payment_hash, preimage_encrypted, memo, on_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [farmer_id, lender, amount_kes, payment_hash, preimage_encrypted, memo, on_time]
    )
  },

  async getProofsByFarmer(farmer_id) {
    return all('SELECT * FROM proofs WHERE farmer_id = ? ORDER BY created_at DESC', [farmer_id])
  },

  async getProofByHash(payment_hash) {
    return get('SELECT * FROM proofs WHERE payment_hash = ?', [payment_hash])
  },

  // --- Aggregated Views ---

  async getPassport(farmer_id) {
    const farmer = await this.getFarmer(farmer_id)
    if (!farmer) return null

    const proofs = await this.getProofsByFarmer(farmer_id)
    return {
      ...farmer,
      proofs: proofs || []
    }
  },

  // --- Webhooks & Logging ---

  async logWebhook(event_type, payload) {
    return run(
      'INSERT INTO webhook_logs (event_type, payload) VALUES (?, ?)',
      [event_type, typeof payload === 'string' ? payload : JSON.stringify(payload)]
    )
  },

  // --- Generic Data Load (for compatibility or migration) ---
  
  async load() {
    const [farmers, proofs, invoices, webhook_logs] = await Promise.all([
      all('SELECT * FROM farmers'),
      all('SELECT * FROM proofs'),
      all('SELECT * FROM invoices'),
      all('SELECT * FROM webhook_logs')
    ])
    return { farmers, proofs, invoices, webhook_logs }
  }
}

module.exports = adapter
