const $ = sel => document.querySelector(sel)
const PASSPORT_CACHE_PREFIX = 'sabicredit:passport:'
const PASSPORT_QR_CACHE_PREFIX = 'sabicredit:passportQr:'
const PAYMENT_QUEUE_KEY = 'sabicredit:paymentQueue'
const DEFAULT_FARMER_ID = 'jmwangi_kisii'
const NETWORK_TIMEOUT_MS = 8000

registerServiceWorker()
bindConnectivitySync()

function show(id) {
  document.querySelectorAll('#views > *').forEach(d => d.classList.add('hidden'))
  const el = document.getElementById(id)
  if (el) el.classList.remove('hidden')
}

function setPwaStatus(message) {
  const status = $('#pwaStatus')
  if (status) status.innerText = message ? ` • ${message}` : ''
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function bindConnectivitySync() {
  window.addEventListener('online', () => {
    setPwaStatus('online — syncing')
    syncQueuedPayments()
  })

  window.addEventListener('offline', () => {
    setPwaStatus('offline — using saved data')
  })
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    setPwaStatus('offline install not supported')
    return
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js')
      setPwaStatus(registration.active ? 'offline ready' : 'offline installing')
      syncQueuedPayments()
    } catch (error) {
      setPwaStatus('offline setup failed')
    }
  })
}

function normalizePassport(data, requestedId = DEFAULT_FARMER_ID) {
  const farmer = data && data.farmer ? data.farmer : data || {}
  return {
    ...data,
    farmer,
    farmer_id: farmer.id || data.farmer_id || requestedId,
    name: farmer.name || data.name || farmer.id || requestedId,
    county: farmer.county || data.county || '',
    score: Number(farmer.score ?? data.score ?? 0),
    loans_repaid: Number(farmer.loans_repaid ?? data.loans_repaid ?? 0),
    defaults: Number(farmer.defaults ?? data.defaults ?? 0),
    proofs: Array.isArray(data && data.proofs) ? data.proofs : []
  }
}

function renderSummary(passport) {
  $('#name').innerText = passport.name || passport.farmer_id
  $('#score').innerText = passport.score || 0
  $('#loans').innerText = passport.loans_repaid || 0
  $('#defaults').innerText = passport.defaults || 0
}

function cachePassport(id, data) {
  try {
    localStorage.setItem(`${PASSPORT_CACHE_PREFIX}${id}`, JSON.stringify({
      saved_at: new Date().toISOString(),
      data
    }))
  } catch (error) {}
}

function loadCachedPassport(id) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${PASSPORT_CACHE_PREFIX}${id}`) || 'null')
    return cached && cached.data ? normalizePassport(cached.data, id) : null
  } catch (error) {
    return null
  }
}

function cachePassportQr(id, qr) {
  try {
    localStorage.setItem(`${PASSPORT_QR_CACHE_PREFIX}${id}`, qr)
  } catch (error) {}
}

function loadCachedPassportQr(id) {
  try {
    return localStorage.getItem(`${PASSPORT_QR_CACHE_PREFIX}${id}`)
  } catch (error) {
    return null
  }
}

async function fetchPassport(id) {
  const res = await fetchWithTimeout(`/api/passport/${encodeURIComponent(id)}`)
  const data = await res.json()

  if (!res.ok || data.error || data.offline) {
    throw new Error(data.error || data.message || 'Passport unavailable')
  }

  const passport = normalizePassport(data, id)
  cachePassport(id, passport)
  return passport
}

async function fetchWithTimeout(url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function getPaymentQueue() {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_QUEUE_KEY) || '[]')
  } catch (error) {
    return []
  }
}

function savePaymentQueue(queue) {
  try {
    localStorage.setItem(PAYMENT_QUEUE_KEY, JSON.stringify(queue))
  } catch (error) {}
}

function queuePaymentIntent(payload, reason = 'Waiting for network') {
  const queue = getPaymentQueue()
  const item = {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...payload,
    created_at: new Date().toISOString(),
    status: 'queued',
    reason
  }

  queue.unshift(item)
  savePaymentQueue(queue)
  return item
}

function updateQueuedPayment(id, patch) {
  const queue = getPaymentQueue()
  const next = queue.map(item => item.id === id ? { ...item, ...patch } : item)
  savePaymentQueue(next)
  return next.find(item => item.id === id)
}

async function createInvoiceOnline({ farmer_id, lender, amount_kes, phone_number }) {
  const res = await fetchWithTimeout('/api/invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-farmer-token': 'sabi_farmer_default_token'
    },
    body: JSON.stringify({ farmer_id, lender, amount_kes, phone_number })
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || 'Invoice creation failed')
  return data
}

async function syncQueuedPayments() {
  if (!navigator.onLine) return

  const queued = getPaymentQueue().filter(item => item.status === 'queued' || item.status === 'sync_failed')
  if (!queued.length) {
    setPwaStatus('online')
    return
  }

  for (const item of queued) {
    try {
      updateQueuedPayment(item.id, { status: 'syncing', reason: 'Creating invoice online…' })
      const data = await createInvoiceOnline(item)
      updateQueuedPayment(item.id, {
        status: 'invoice_created',
        reason: 'Prompt sent. Payment still needs simulation confirmation.',
        synced_at: new Date().toISOString(),
        invoice: data
      })
    } catch (error) {
      updateQueuedPayment(item.id, {
        status: 'sync_failed',
        reason: error.message || 'Sync failed'
      })
    }
  }

  const remaining = getPaymentQueue().filter(item => item.status === 'queued' || item.status === 'sync_failed')
  setPwaStatus(remaining.length ? `${remaining.length} payment${remaining.length === 1 ? '' : 's'} waiting` : 'synced')
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function verifyProofOffline(proof) {
  if (!proof.preimage || !proof.payment_hash || !crypto.subtle) {
    return null
  }

  const hash = await sha256Hex(proof.preimage)
  const expected = String(proof.payment_hash).toLowerCase()
  const valid = hash === expected

  return {
    valid,
    message: valid ? 'Verified offline with SHA-256 preimage check' : 'Offline hash check failed',
    lender: proof.lender,
    amount_kes: proof.amount_kes,
    date: proof.date,
    fallback: true
  }
}

// attach nav buttons (header) by data-target
document.querySelectorAll('.navbtn').forEach(btn => {
  const target = btn.dataset.target
  if (target) btn.addEventListener('click', () => show(target))
})

// attach other buttons safely (may be present in multiple views)
const attach = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn) }
attach('toRepay', () => show('repay'))
attach('toPassport', () => show('passport'))
attach('toProfile', () => show('profile'))
attach('toScanner', () => show('scanner'))
attach('backFromRepay', () => { stopPolling(); show('home') })
attach('backFromPassport', () => show('home'))
attach('backFromScanner', () => show('home'))
attach('backFromProfile', () => show('home'))

// ─── Invoice + Payment Polling ─────────────────────────────────────────────

let _pollTimer = null

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
}

async function refreshHomeScore(farmer_id) {
  try {
    const passport = await fetchPassport(farmer_id)
    renderSummary(passport)
  } catch (e) {}
}

function renderPaid(farmer_id, lender, amount_kes) {
  $('#invoiceArea').innerHTML = `
    <div class="paid-banner">
      <div style="font-size:2.2rem">⚡✅</div>
      <strong>Payment received!</strong>
      <div>KES ${amount_kes} to <em>${lender}</em> — proof saved to your credit passport.</div>
      <button id="viewPassportBtn" class="primary" style="margin-top:12px">View Credit Passport →</button>
    </div>`
  attach('viewPassportBtn', () => {
    $('#passport_id').value = farmer_id
    show('passport')
    document.getElementById('loadPassport').click()
  })
  refreshHomeScore(farmer_id)
}

async function checkStatus(payment_hash, farmer_id, lender, amount_kes, baseProofCount) {
  try {
    // 1. Check if specific invoice hash was paid
    const r = await fetch(`/api/invoice/status/${encodeURIComponent(payment_hash)}`)
    const d = await r.json()
    if (d.status === 'paid') {
      stopPolling()
      renderPaid(farmer_id, d.lender || lender, d.amount_kes || amount_kes)
      return true
    }

    // 2. Check if proof count increased (sim mode fallback)
    if (baseProofCount >= 0) {
      const pr = await fetch(`/api/passport/${encodeURIComponent(farmer_id)}`)
      const pd = await pr.json()
      if (pd && pd.proofs && pd.proofs.length > baseProofCount) {
        stopPolling()
        renderPaid(farmer_id, lender, amount_kes)
        return true
      }
    }
  } catch (e) {}
  return false
}

function startPolling(payment_hash, farmer_id, lender, amount_kes, baseProofCount) {
  stopPolling()
  let attempts = 0
  const MAX = 120 // 3 min max (120 * 1.5s)

  _pollTimer = setInterval(async () => {
    attempts++
    const isPaid = await checkStatus(payment_hash, farmer_id, lender, amount_kes, baseProofCount)
    if (isPaid) return

    const el = document.getElementById('invoiceStatusText')
    if (!el) return stopPolling()

    if (attempts >= MAX) {
      stopPolling()
      el.innerText = '⏱ Timed out — webhook may still arrive. Check your passport later.'
    } else {
      el.innerText = `⏳ Waiting for payment… (${Math.round(attempts * 1.5)}s)`
    }
  }, 1500)
}

function renderInvoice(data, { farmer_id, lender, amount_kes, phone_number }) {
  const { payment_request, payment_hash, qr_code, proof_count, mavapay_quote } = data
  const baseProofCount = typeof proof_count === 'number' ? proof_count : 0

  let promptMessageHtml = ''
  if (mavapay_quote) {
    promptMessageHtml = `
      <div class="prompt-info" style="border: 1px solid var(--accent-success); background: rgba(16, 185, 129, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 12px; text-align: left;">
        <strong style="color: var(--accent-success); display: block; margin-bottom: 4px;">Payment Prompt Sent</strong>
        <div>A simulated payment prompt has been sent to <strong>${escapeHtml(mavapay_quote.phoneNumber || phone_number)}</strong>.</div>
        <div class="small muted mt">Complete the simulation below to save this repayment to the credit passport.</div>
      </div>`
  }

  $('#invoiceArea').innerHTML = `
    ${promptMessageHtml}
    <div style="text-align:center;margin-bottom:12px">
      <img src="${qr_code}" alt="Lightning QR" style="max-width:220px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.2)"/>
    </div>
    <div class="invoice-meta">
      <div><strong>KES ${escapeHtml(amount_kes)}</strong> → ${escapeHtml(lender)}</div>
      <div class="muted small" style="word-break:break-all;margin-top:4px;font-family:monospace">${escapeHtml(payment_request)}</div>
    </div>
    <div id="invoiceStatusText" class="status-pulse">⏳ Waiting for payment…</div>
    <div style="margin-top:10px">
      <button id="simPayBtn" class="secondary">Complete Simulation and Save</button>
    </div>`

  document.getElementById('simPayBtn').onclick = async () => {
    const btn = document.getElementById('simPayBtn')
    btn.disabled = true
    btn.innerText = 'Saving…'
    try {
      await fetchWithTimeout('/api/webhook/sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmer_id, lender, amount_kes })
      })
      const el = document.getElementById('invoiceStatusText')
      if (el) el.innerText = 'Saving repayment proof…'
      await checkStatus(payment_hash, farmer_id, lender, amount_kes, baseProofCount)
    } catch (e) {
      const el = document.getElementById('invoiceStatusText')
      if (el) el.innerText = 'Simulation failed: ' + e.message
    }
  }

  startPolling(payment_hash, farmer_id, lender, amount_kes, baseProofCount)
}

function renderQueuedPayment(item) {
  $('#invoiceArea').innerHTML = `
    <div class="paid-banner">
      <div style="font-size:2.2rem">📦</div>
      <strong>Saved locally</strong>
      <div>
        KES ${escapeHtml(item.amount_kes)} to <em>${escapeHtml(item.lender)}</em> is queued on this device.
        SabiCredit will create the payment request when the connection is back.
      </div>
      <div class="small muted mt">${escapeHtml(item.reason || 'Waiting for network')}</div>
      <button id="syncNowBtn" class="primary" style="margin-top:12px">Try sync now</button>
    </div>`

  attach('syncNowBtn', async () => {
    $('#syncNowBtn').disabled = true
    $('#syncNowBtn').innerText = 'Syncing…'
    await syncQueuedPayments()
    const updated = getPaymentQueue().find(payment => payment.id === item.id)
    if (updated && updated.invoice) {
      renderInvoice(updated.invoice, updated)
      return
    }
    renderQueuedPayment(updated || item)
  })
}

document.getElementById('createInvoice').onclick = async () => {
  const farmer_id = $('#repay_farmer_id').value.trim()
  const lender    = $('#repay_lender').value
  const amount_kes = Number($('#repay_amount').value)
  const phone_number = $('#repay_phone').value.trim()
  if (!farmer_id) return ($('#invoiceArea').innerText = 'Enter a Farmer ID first')
  if (!amount_kes || amount_kes < 1) return ($('#invoiceArea').innerText = 'Enter a valid amount')

  stopPolling()
  const payload = { farmer_id, lender, amount_kes, phone_number }

  if (!navigator.onLine) {
    renderQueuedPayment(queuePaymentIntent(payload, 'Device is offline'))
    return
  }

  $('#invoiceArea').innerText = 'Sending simulated prompt…'
  try {
    renderInvoice(await createInvoiceOnline(payload), payload)
  } catch (err) {
    renderQueuedPayment(queuePaymentIntent(payload, err.name === 'AbortError' ? 'Network is too slow; saved for retry' : err.message))
  }
}

// ─── Passport ────────────────────────────────────────────────────────────────

function renderProofHistory(passport, options = {}) {
  renderSummary(passport)

  const notice = options.notice ? `
    <div class="paid-banner">
      <strong>${escapeHtml(options.notice.title)}</strong>
      <div>${escapeHtml(options.notice.body)}</div>
    </div>` : ''

  const proofsHtml = passport.proofs.map(p =>
    `<div class="proof-item">
      <div>
        <strong style="color: var(--text-primary); font-size: 15px;">${escapeHtml(p.lender)}</strong>
        <div class="muted small" style="margin-top: 4px;">Date: ${escapeHtml(p.date || 'Saved locally')}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: 700; color: var(--accent); font-family: var(--font-mono);">KES ${escapeHtml(p.amount_kes)}</div>
        <div class="small" style="color: ${p.on_time ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-weight: 500; margin-top: 4px;">
          ${p.on_time ? '⚡ Repaid On-Time' : '⚠️ Late / Overdue'}
        </div>
      </div>
    </div>`
  ).join('') || '<div>No proofs saved yet</div>'

  $('#passportArea').innerHTML = `${notice}${proofsHtml}${renderQueuedHistory(passport.farmer_id)}`
}

function renderQueuedHistory(farmerId) {
  const items = getPaymentQueue().filter(item => item.farmer_id === farmerId)
  if (!items.length) return ''

  return `
    <div class="mt">
      <h4>Saved payment attempts</h4>
      ${items.map(item => `
        <div class="proof-item" style="border-left: 4px solid var(--accent-warning);">
          <div>
            <strong style="color: var(--text-primary); font-size: 15px;">${escapeHtml(item.lender)}</strong>
            <div class="muted small" style="margin-top: 4px;">${escapeHtml(item.status)} · ${escapeHtml(item.reason || '')}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: var(--accent); font-family: var(--font-mono);">KES ${escapeHtml(item.amount_kes)}</div>
            <div class="small muted" style="margin-top: 4px;">${escapeHtml(new Date(item.created_at).toLocaleString())}</div>
          </div>
        </div>`
      ).join('')}
    </div>`
}

function shareablePassport(passport) {
  return {
    type: 'sabicredit.passport.history',
    exported_at: new Date().toISOString(),
    farmer: passport.farmer || {
      id: passport.farmer_id,
      name: passport.name,
      county: passport.county,
      score: passport.score,
      loans_repaid: passport.loans_repaid,
      defaults: passport.defaults
    },
    proofs: passport.proofs,
    pending_payments: getPaymentQueue().filter(item => item.farmer_id === passport.farmer_id)
  }
}

function renderOfflineShare(passport, message = 'Shareable history is available offline.') {
  const json = JSON.stringify(shareablePassport(passport), null, 2)
  $('#passportQRArea').innerHTML = `
    <div class="paid-banner">
      <strong>Offline share</strong>
      <div>${escapeHtml(message)}</div>
    </div>
    <textarea id="sharePassportText" rows="10" readonly>${escapeHtml(json)}</textarea>
    <div class="controls mt">
      <button id="copyPassportShare" class="primary">Copy history</button>
      <button id="nativePassportShare" class="secondary">Share</button>
    </div>`

  attach('copyPassportShare', async () => {
    try {
      await navigator.clipboard.writeText(json)
      $('#copyPassportShare').innerText = 'Copied ✓'
    } catch (error) {
      $('#copyPassportShare').innerText = 'Select text to copy'
    }
  })

  attach('nativePassportShare', async () => {
    if (!navigator.share) {
      $('#nativePassportShare').innerText = 'Use copy instead'
      return
    }

    try {
      await navigator.share({
        title: `${passport.name || passport.farmer_id} SabiCredit history`,
        text: json
      })
    } catch (error) {}
  })
}

function renderQrShare(id, qr, passport, message = 'Scan to share this SabiCredit history.') {
  $('#passportQRArea').innerHTML = `
    <img src="${qr}" alt="SabiCredit history QR"/>
    <div class="muted small mt">${escapeHtml(message)}</div>
    <div class="controls mt">
      <button id="showTextHistory" class="secondary">Show copyable history</button>
    </div>`
  attach('showTextHistory', () => renderOfflineShare(passport, 'Copyable history also works on slow or offline networks.'))
  cachePassportQr(id, qr)
}

document.getElementById('loadPassport').onclick = async () => {
  const id = $('#passport_id').value.trim() || DEFAULT_FARMER_ID
  const cached = loadCachedPassport(id)

  if (cached) {
    renderProofHistory(cached, {
      notice: {
        title: 'Saved passport',
        body: 'Showing local history immediately. Fresh data will replace it if the network responds.'
      }
    })
  } else {
    $('#passportArea').innerText = 'Loading...'
  }

  try {
    renderProofHistory(await fetchPassport(id))
  } catch (err) {
    if (!cached) {
      $('#passportArea').innerText = 'No saved history yet. Connect once to save this passport on the device.'
    }
  }
}

document.getElementById('passportQR').onclick = async () => {
  const id = $('#passport_id').value.trim() || DEFAULT_FARMER_ID
  const cached = loadCachedPassport(id)
  const cachedQr = loadCachedPassportQr(id)
  $('#passportQRArea').innerText = 'Preparing history...'

  if (!navigator.onLine && cachedQr && cached) {
    renderQrShare(id, cachedQr, cached, 'Offline QR from the last saved share.')
    return
  }

  if (!navigator.onLine && cached) {
    renderOfflineShare(cached)
    return
  }

  try {
    const fresh = await fetchPassport(id)
    const res = await fetchWithTimeout(`/api/passport/${encodeURIComponent(id)}/qr`)
    const data = await res.json()
    if (data.qr) {
      renderQrShare(id, data.qr, fresh)
      return
    }
    renderOfflineShare(fresh, 'QR was unavailable, but copyable history is ready.')
  } catch (error) {
    if (cached) {
      renderOfflineShare(cached, 'Network is unavailable or slow, so this is the saved local history.')
      return
    }
    $('#passportQRArea').innerText = 'No saved history yet. Connect once before sharing offline.'
  }
}

// ─── Lender Scanner ───────────────────────────────────────────────────────────

document.getElementById('verifyPassport').onclick = async () => {
  const text = $('#scanner_input').value
  let obj
  try { obj = JSON.parse(text) } catch (e) { return ($('#scannerResult').innerText = 'Invalid JSON') }
  const proofs = obj.proofs || []
  if (!proofs.length) return ($('#scannerResult').innerText = 'No proofs in passport')
  $('#scannerResult').innerHTML = 'Verifying...'

  const results = await Promise.all(proofs.map(async (p, i) => {
    // Preferred: server-side verify by proof_id (no raw preimage needed client-side)
    if (p.proof_id) {
      try {
        const res = await fetch(`/api/verify/${encodeURIComponent(p.proof_id)}`)
        return { ...(await res.json()), fallback: false }
      } catch (e) {
        return { valid: false, message: 'Network error', fallback: false }
      }
    }
    // Fallback: raw preimage in passport JSON
    if (p.preimage && p.payment_hash) {
      const offlineResult = await verifyProofOffline(p)
      if (offlineResult) return offlineResult

      try {
        const res = await fetchWithTimeout('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preimage: p.preimage, payment_hash: p.payment_hash })
        })
        return { ...(await res.json()), fallback: true }
      } catch (e) {
        return { valid: null, message: 'Cannot verify on this device while offline', fallback: true }
      }
    }
    return { valid: null, message: 'No proof_id or raw preimage — cannot verify', fallback: true }
  }))

  $('#scannerResult').innerHTML = results.map((r, i) => {
    const isSuccess = r.valid === true
    const isError = r.valid === false
    const statusColor = isSuccess ? 'var(--accent-success)' : isError ? 'var(--accent-danger)' : 'var(--accent-warning)'
    const icon = isSuccess ? '✅ Verified' : isError ? '❌ Invalid' : '⚠️ Warning'
    const detail = [r.lender, r.amount_kes ? `KES ${r.amount_kes}` : '', r.date].filter(Boolean).join(' · ')

    return `
      <div class="proof-item" style="border-left: 4px solid ${statusColor};">
        <div>
          <strong style="color: ${statusColor}; font-size: 14px;">${icon} (Proof ${i + 1})</strong>
          <div class="muted small" style="margin-top: 4px;">${detail || 'Unrecognized Proof'}</div>
        </div>
        <div style="text-align: right; max-width: 250px;">
          <div class="small" style="color: var(--text-primary); font-weight: 500;">${r.message || ''}</div>
        </div>
      </div>`
  }).join('')
}

// ─── Initial home load ────────────────────────────────────────────────────────

fetchPassport(DEFAULT_FARMER_ID)
  .then(renderSummary)
  .catch(() => {
    const cached = loadCachedPassport(DEFAULT_FARMER_ID)
    if (cached) renderSummary(cached)
  })

// ─── Profile ──────────────────────────────────────────────────────────────────

document.getElementById('saveProfile').onclick = async () => {
  const id     = $('#profile_id').value.trim()
  const name   = $('#profile_name').value.trim()
  const county = $('#profile_county').value.trim()
  if (!id) return ($('#profileMsg').innerText = 'ID required')
  $('#profileMsg').innerText = 'Saving...'
  try {
    await fetch('/api/farmers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-farmer-token': 'sabi_farmer_default_token'
      },
      body: JSON.stringify({ id, name, county })
    })
  } catch (e) {}
  try {
    const res = await fetch(`/api/farmers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-farmer-token': 'sabi_farmer_default_token'
      },
      body: JSON.stringify({ name, county })
    })
    const data = await res.json()
    if (data && !data.error) {
      $('#profileMsg').innerText = 'Saved ✓'
      $('#name').innerText = data.name || data.id
    } else {
      $('#profileMsg').innerText = 'Save failed'
    }
  } catch (err) {
    $('#profileMsg').innerText = 'Save error'
  }
}

document.getElementById('profile_id').addEventListener('change', async (e) => {
  const id = e.target.value
  try {
    const res = await fetch(`/api/farmers/${encodeURIComponent(id)}`)
    const data = await res.json()
    if (!data.error) {
      $('#profile_name').value = data.name || ''
      $('#profile_county').value = data.county || ''
    }
  } catch (e) {}
})
