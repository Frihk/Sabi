/**
 * Payment poller — polls LNbits for pending invoices that may have settled
 * but whose webhook was missed (network drop, LNbits outage, etc.)
 *
 * Runs every POLL_INTERVAL_MS (default 30s) while the server is up.
 * Only active when LNBITS_URL and LNBITS_API_KEY are configured.
 */

const { getPayment } = require('./lnbits')
const creds = require('./credentials')
const db = require('../database/adapter')

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10)

let timer = null

async function pollPendingInvoices() {
  let pending
  let settledHashes
  try {
    // Fetch state from database
    const state = typeof db.load === 'function' ? await db.load() : null
    pending = state ? state.invoices : []
    settledHashes = new Set((state ? state.proofs : []).map(p => p.payment_hash))
  } catch (e) {
    console.warn('[poller] could not read database:', e.message)
    return
  }

  const toCheck = (pending || []).filter(inv => inv.payment_hash && !settledHashes.has(inv.payment_hash))

  if (!toCheck.length) return

  console.info(`[poller] checking ${toCheck.length} pending invoice(s)`)

  for (const inv of toCheck) {
    try {
      const result = await getPayment(inv.payment_hash)
      // LNbits returns { paid: true, details: { preimage, ... } } or similar
      const paid = result && (result.paid === true || result.details?.paid === true)
      const preimage = result?.details?.preimage || result?.preimage

      if (paid && preimage && inv.farmer_id) {
        console.info(`[poller] recovered missed payment for ${inv.farmer_id} — ${inv.payment_hash.slice(0, 12)}...`)
        creds.createFarmerIfNotExists({ id: inv.farmer_id })
        creds.saveProof({
          farmer_id: inv.farmer_id,
          lender: inv.lender || 'Unknown',
          amount_kes: inv.amount_kes,
          payment_hash: inv.payment_hash,
          preimage,
          memo: `${inv.lender || 'Unknown'}-${inv.farmer_id}-recovered`
        })
      }
    } catch (e) {
      // Don't crash the poller on a single failed check
      console.warn(`[poller] failed to check invoice ${inv.payment_hash?.slice(0, 12)}:`, e.message)
    }
  }
}

function start() {
  const LNBITS_URL = process.env.LNBITS_URL
  const LNBITS_API_KEY = process.env.LNBITS_API_KEY

  if (!LNBITS_URL || !LNBITS_API_KEY) {
    console.info('[poller] LNBITS not configured — polling disabled (mock/dev mode)')
    return
  }

  console.info(`[poller] started — checking for missed payments every ${POLL_INTERVAL_MS / 1000}s`)
  timer = setInterval(() => {
    pollPendingInvoices().catch(e => console.error('[poller] unhandled error:', e.message))
  }, POLL_INTERVAL_MS)

  // Don't block process exit
  if (timer.unref) timer.unref()
}

function stop() {
  if (timer) clearInterval(timer)
}

module.exports = { start, stop }
