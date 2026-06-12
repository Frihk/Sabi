const $ = sel => document.querySelector(sel)

function show(id) {
  document.querySelectorAll('#views > *').forEach(d => d.classList.add('hidden'))
  const el = document.getElementById(id)
  if (el) el.classList.remove('hidden')
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
    const r = await fetch(`/api/passport/${encodeURIComponent(farmer_id)}`)
    const d = await r.json()
    if (d && !d.error) {
      $('#name').innerText = d.name || d.farmer_id
      $('#score').innerText = d.score || 0
      $('#loans').innerText = d.loans_repaid || 0
      $('#defaults').innerText = d.defaults || 0
    }
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

document.getElementById('createInvoice').onclick = async () => {
  const farmer_id = $('#repay_farmer_id').value.trim()
  const lender    = $('#repay_lender').value
  const amount_kes = Number($('#repay_amount').value)
  const phone_number = $('#repay_phone').value.trim()
  if (!farmer_id) return ($('#invoiceArea').innerText = 'Enter a Farmer ID first')

  stopPolling()
  $('#invoiceArea').innerText = 'Creating invoice…'

  try {
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-farmer-token': 'sabi_farmer_default_token'
      },
      body: JSON.stringify({ farmer_id, lender, amount_kes, phone_number })
    })
    const data = await res.json()
    if (data.error) return ($('#invoiceArea').innerText = 'Error: ' + data.error)

    const { payment_request, payment_hash, qr_code, proof_count, mavapay_quote } = data
    const baseProofCount = typeof proof_count === 'number' ? proof_count : 0

    let stkMessageHtml = ''
    if (mavapay_quote) {
      if (mavapay_quote.error) {
        stkMessageHtml = `
          <div class="stk-info" style="border: 1px solid var(--accent-danger); background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; margin-bottom: 12px;">
            <strong style="color: var(--accent-danger);">❌ M-Pesa STK Push Failed</strong>
            <div class="small muted">${mavapay_quote.error}</div>
            <div class="small mt">Please scan the Lightning QR code below to pay manually.</div>
          </div>`
      } else {
        stkMessageHtml = `
          <div class="stk-info" style="border: 1px solid var(--accent-success); background: rgba(16, 185, 129, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 12px; text-align: left;">
            <strong style="color: var(--accent-success); display: block; margin-bottom: 4px;">📲 M-Pesa Prompt Triggered</strong>
            <div>A payment prompt has been sent to <strong>${phone_number}</strong>.</div>
            <div class="small muted mt">Please check your phone, enter your M-Pesa PIN, and confirm.</div>
          </div>`
      }
    }

    $('#invoiceArea').innerHTML = `
      ${stkMessageHtml}
      <div style="text-align:center;margin-bottom:12px">
        <img src="${qr_code}" alt="Lightning QR" style="max-width:220px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.2)"/>
      </div>
      <div class="invoice-meta">
        <div><strong>KES ${amount_kes}</strong> → ${lender}</div>
        <div class="muted small" style="word-break:break-all;margin-top:4px;font-family:monospace">${payment_request}</div>
      </div>
      <div id="invoiceStatusText" class="status-pulse">⏳ Waiting for payment…</div>
      <div style="margin-top:10px">
        <button id="simPayBtn" class="secondary">⚡ Simulate M-Pesa / STK Payment (Dev)</button>
      </div>`

    // Dev simulate button — fires the sim webhook
    document.getElementById('simPayBtn').onclick = async () => {
      const btn = document.getElementById('simPayBtn')
      btn.disabled = true
      btn.innerText = 'Simulating…'
      try {
        await fetch('/api/webhook/sim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ farmer_id, lender, amount_kes })
        })
        const el = document.getElementById('invoiceStatusText')
        if (el) el.innerText = '⏳ Confirming payment…'
        
        // Execute status check immediately to bypass interval delay!
        await checkStatus(payment_hash, farmer_id, lender, amount_kes, baseProofCount)
      } catch (e) {
        const el = document.getElementById('invoiceStatusText')
        if (el) el.innerText = 'Sim failed: ' + e.message
      }
    }

    startPolling(payment_hash, farmer_id, lender, amount_kes, baseProofCount)

  } catch (err) {
    $('#invoiceArea').innerText = 'Error creating invoice: ' + err.message
  }
}

// ─── Passport ────────────────────────────────────────────────────────────────

document.getElementById('loadPassport').onclick = async () => {
  const id = $('#passport_id').value
  $('#passportArea').innerText = 'Loading...'
  try {
    const res = await fetch(`/api/passport/${encodeURIComponent(id)}`)
    const data = await res.json()
    if (data.error) return ($('#passportArea').innerText = 'Error: ' + data.error)
    $('#name').innerText = data.name || data.farmer_id
    $('#score').innerText = data.score || 0
    $('#loans').innerText = data.loans_repaid || 0
    $('#defaults').innerText = data.defaults || 0
    const html = data.proofs.map(p =>
      `<div class="proof-item">
        <div>
          <strong style="color: var(--text-primary); font-size: 15px;">${p.lender}</strong>
          <div class="muted small" style="margin-top: 4px;">Date: ${p.date}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: var(--accent); font-family: var(--font-mono);">KES ${p.amount_kes}</div>
          <div class="small" style="color: ${p.on_time ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-weight: 500; margin-top: 4px;">
            ${p.on_time ? '⚡ Repaid On-Time' : '⚠️ Late / Overdue'}
          </div>
        </div>
      </div>`
    ).join('')
    $('#passportArea').innerHTML = html || '<div>No proofs yet</div>'
  } catch (err) {
    $('#passportArea').innerText = 'Error loading passport'
  }
}

document.getElementById('passportQR').onclick = async () => {
  const id = $('#passport_id').value
  $('#passportQRArea').innerText = 'Generating QR...'
  const res = await fetch(`/api/passport/${encodeURIComponent(id)}/qr`)
  const data = await res.json()
  if (data.qr) {
    $('#passportQRArea').innerHTML = `<img src="${data.qr}"/>`
  } else $('#passportQRArea').innerText = 'No QR'
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
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preimage: p.preimage, payment_hash: p.payment_hash })
      })
      return { ...(await res.json()), fallback: true }
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

fetch('/api/passport/jmwangi_kisii').then(r => r.json()).then(data => {
  if (data && !data.error) {
    $('#name').innerText = data.name || data.farmer_id
    $('#score').innerText = data.score || 0
    $('#loans').innerText = data.loans_repaid || 0
    $('#defaults').innerText = data.defaults || 0
  }
}).catch(() => {})

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
