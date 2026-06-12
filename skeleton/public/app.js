const DEFAULT_FARMER_ID = 'jmwangi_kisii'
const CACHE_PREFIX = 'sabicredit:passport:'

const elements = {
  connectionStatus: document.querySelector('#connectionStatus'),
  farmerId: document.querySelector('#farmerId'),
  loadPassport: document.querySelector('#loadPassport'),
  farmerName: document.querySelector('#farmerName'),
  scoreValue: document.querySelector('#scoreValue'),
  loansRepaid: document.querySelector('#loansRepaid'),
  defaultsCount: document.querySelector('#defaultsCount'),
  proofsCount: document.querySelector('#proofsCount'),
  proofList: document.querySelector('#proofList'),
  syncMessage: document.querySelector('#syncMessage')
}

registerServiceWorker()
updateConnectionStatus()
window.addEventListener('online', updateConnectionStatus)
window.addEventListener('offline', updateConnectionStatus)

elements.loadPassport.addEventListener('click', () => {
  loadPassport(elements.farmerId.value.trim() || DEFAULT_FARMER_ID)
})

loadPassport(elements.farmerId.value.trim() || DEFAULT_FARMER_ID)

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  try {
    await navigator.serviceWorker.register('/service-worker.js')
  } catch (error) {
    console.warn('Service worker registration failed', error)
  }
}

function updateConnectionStatus() {
  const online = navigator.onLine
  elements.connectionStatus.textContent = online ? 'Online' : 'Offline'
  elements.connectionStatus.dataset.state = online ? 'online' : 'offline'
}

async function loadPassport(farmerId) {
  setMessage('Loading passport...')

  try {
    const response = await fetch(`/api/passport/${encodeURIComponent(farmerId)}`)
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`)
    }

    const passport = await response.json()
    savePassport(farmerId, passport)
    renderPassport(passport, false)
  } catch (error) {
    const cached = readPassport(farmerId)
    if (cached) {
      renderPassport(cached, true)
      return
    }

    renderEmptyState(farmerId)
  }
}

function savePassport(farmerId, passport) {
  localStorage.setItem(`${CACHE_PREFIX}${farmerId}`, JSON.stringify({
    savedAt: new Date().toISOString(),
    passport
  }))
}

function readPassport(farmerId) {
  const raw = localStorage.getItem(`${CACHE_PREFIX}${farmerId}`)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

function renderPassport(data, fromCache) {
  const passport = data.passport || data
  const savedAt = data.savedAt ? new Date(data.savedAt) : null
  const farmer = passport.farmer || passport
  const proofs = passport.proofs || []

  elements.farmerName.textContent = farmer.name || farmer.id || 'Saved passport'
  elements.scoreValue.textContent = valueOrDash(farmer.score || passport.score)
  elements.loansRepaid.textContent = valueOrDash(farmer.loans_repaid || passport.loans_repaid)
  elements.defaultsCount.textContent = valueOrDash(farmer.defaults || passport.defaults)
  elements.proofsCount.textContent = proofs.length

  elements.proofList.innerHTML = ''
  if (proofs.length === 0) {
    elements.proofList.appendChild(emptyProofItem('No repayment proofs saved yet.'))
  } else {
    proofs.slice(0, 10).forEach(proof => elements.proofList.appendChild(renderProof(proof)))
  }

  if (fromCache) {
    const stamp = savedAt ? ` Last synced ${savedAt.toLocaleString()}.` : ''
    setMessage(`Showing saved data because the network is unavailable.${stamp}`)
  } else {
    setMessage('Passport synced and saved for offline use.')
  }
}

function renderProof(proof) {
  const item = document.createElement('li')
  item.className = 'proof-item'

  const title = document.createElement('strong')
  title.textContent = proof.lender || 'Unknown lender'

  const detail = document.createElement('span')
  const amount = proof.amount_kes ? `KES ${proof.amount_kes}` : 'Amount unavailable'
  const date = proof.created_at || proof.date || 'Date unavailable'
  detail.textContent = `${amount} · ${date}`

  item.append(title, detail)
  return item
}

function emptyProofItem(message) {
  const item = document.createElement('li')
  item.className = 'proof-item muted'
  item.textContent = message
  return item
}

function renderEmptyState(farmerId) {
  elements.farmerName.textContent = farmerId
  elements.scoreValue.textContent = '--'
  elements.loansRepaid.textContent = '--'
  elements.defaultsCount.textContent = '--'
  elements.proofsCount.textContent = '--'
  elements.proofList.innerHTML = ''
  elements.proofList.appendChild(emptyProofItem('Connect to the internet once to save this passport for offline use.'))
  setMessage('No saved passport found on this device.')
}

function setMessage(message) {
  elements.syncMessage.textContent = message
}

function valueOrDash(value) {
  return value === undefined || value === null ? '--' : value
}
