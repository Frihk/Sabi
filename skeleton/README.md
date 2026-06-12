# SabiCredit ⚡

> **Portable, cryptographically verified credit reputation for Kenyan farmers — powered by the Bitcoin Lightning Network.**

---

## The Problem

A smallholder farmer in Kisii has repaid 3 Apollo Agriculture loans on time, contributed to a SACCO for 18 months, and never missed a chama payment. But none of that history is visible to any new lender. Every time they need a bigger loan, they start from zero — no proof, no trust, no leverage.

**Why?** Repayment history is trapped inside each lender's private database. Apollo knows about Apollo loans. The SACCO knows about SACCO contributions. The farmer owns nothing.

Kenya has over 7 million smallholder farmers. The majority are locked out of affordable credit not because they are bad borrowers — but because they cannot prove they are good ones.

---

## The Solution

SabiCredit turns every Lightning Network loan repayment into a **portable, cryptographically verified credit credential** that the farmer owns, controls, and can share with any lender via a QR code.

- Farmer repays any loan through the app using Lightning
- The Lightning payment preimage — a mathematically unforgeable proof — is captured automatically
- Proofs stack into a **Credit Passport** stored on the farmer's phone
- Any lender scans the QR and instantly sees verified repayment history
- No credit bureau. No middleman. No waiting.

---

## How It Works

### The Core Insight — Lightning Preimages as Proof

Lightning payments use a cryptographic lock-and-key mechanism:

1. When an invoice is created, a secret `preimage` is generated
2. The invoice contains `payment_hash = SHA256(preimage)`
3. When the farmer pays, the Lightning network releases the `preimage` to settle the payment
4. That `preimage` is mathematically unforgeable — it only exists if the payment fully settled

```js
// Any lender can verify a credential in 3 lines
const hash = SHA256(credential.preimage)
const valid = (hash === credential.payment_hash)
console.log(valid ? "✓ Payment verified" : "✗ Invalid credential")
```

This is the foundation of the Credit Passport — not a database entry someone can edit, but a cryptographic fact.

---

### Payment Flow

```
Farmer taps "Repay KES 4,500 to Apollo"
        ↓
SabiCredit calls LNbits API → creates Lightning invoice
        ↓
Farmer scans QR with any Lightning wallet (Tando, Phoenix, WoS)
        ↓
Lightning settles — two things happen simultaneously:
        ↓                              ↓
[Track A — Reputation]         [Track B — Money movement]
LNbits fires webhook            Tando converts sats → KES
to SabiCredit backend           Lender receives M-Pesa
preimage captured               SabiCredit never touches money
credential entry saved
farmer score updates
```

**SabiCredit never touches money.** It only captures proofs. The payment flows through Lightning → Tando → M-Pesa independently.

---

### The Credit Passport

Each repayment generates a credential entry:

```json
{
  "farmer_id": "jmwangi_kisii",
  "proofs": [
    {
      "lender": "Apollo Agriculture",
      "amount_kes": 4500,
      "date": "2026-06-08",
      "payment_hash": "a3f9bc72e1d4...",
      "preimage": "7c2e91fa83b0...",
      "on_time": true
    },
    {
      "lender": "Kisii SACCO",
      "amount_kes": 2000,
      "date": "2026-05-01",
      "payment_hash": "d84f1c39e720...",
      "preimage": "4b9a72cd1e38...",
      "on_time": true
    }
  ],
  "score": 742,
  "loans_repaid": 5,
  "defaults": 0
}
```

This JSON is base64-encoded into a QR code. The farmer carries it on their phone. Any lender scans it and verifies each entry independently using the preimage check above.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Farmer's Phone                       │
│              SabiCredit Mobile App (React Native)        │
│   Home · Repay · Credit Passport · Share QR              │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API calls
┌───────────────────────▼─────────────────────────────────┐
│                 SabiCredit Backend (Node.js)              │
│  POST /invoice    — create Lightning invoice              │
│  POST /webhook    — receive payment confirmation          │
│  GET  /passport/:id — return farmer credential            │
│  GET  /verify     — lender verification endpoint          │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
┌──────────▼──────────┐    ┌──────────▼──────────────────┐
│       LNbits         │    │         Tando               │
│  Hosted Lightning    │    │  Lightning → M-Pesa offramp  │
│  wallet + API        │    │  Lender receives KES         │
│  Fires webhook on    │    │  (independent of SabiCredit) │
│  payment settled     │    └─────────────────────────────┘
└─────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile app | React Native | Cross-platform, single codebase |
| Backend | Node.js + Express | Fast to build, webhook-friendly |
| Database | SQLite (hackathon) / PostgreSQL (prod) | Simple credential storage |
| Lightning | LNbits hosted API | No node to run, free, webhook support |
| Offramp | Tando | Lightning → KES → M-Pesa for Kenyan lenders |
| QR generation | `qrcode` npm package | Encode farmer passport as shareable QR |
| Credential verification | Node.js `crypto` SHA256 | Preimage verification, 3 lines of code |

---

## Getting Started

### Prerequisites

- Node.js v18+
- A free LNbits account at [lnbits.com](https://lnbits.com)
- ngrok (for local webhook testing)

### Installation

```bash
git clone https://github.com/odingaval/Sabi.git
cd Sabi
npm install
```

### Environment variables

Create a `.env` file in the root:

```env
LNBITS_URL=https://lnbits.com
LNBITS_API_KEY=your_invoice_key_here
WEBHOOK_SECRET=your_random_secret
PORT=3000
DATABASE_URL=./sabicredit.db
SATS_PER_KES=0.35
```

> Get your `LNBITS_API_KEY` from your LNbits wallet under **API info → Invoice/read key**

### Run the backend

```bash
npm run dev
```

### Expose webhook for local testing

```bash
ngrok http 3000
# Copy the https URL and set it as your webhook in LNbits
```

---

## API Reference

### Create a repayment invoice

```http
POST /api/invoice
Content-Type: application/json

{
  "farmer_id": "jmwangi_kisii",
  "lender": "Apollo Agriculture",
  "amount_kes": 4500
}
```

**Response:**
```json
{
  "payment_request": "lnbc450000n1p3xk...",
  "payment_hash": "a3f9bc72e1d4...",
  "qr_code": "data:image/png;base64,..."
}
```

---

### Webhook — payment confirmed (fired by LNbits)

```http
POST /api/webhook/payment
Content-Type: application/json

{
  "payment_hash": "a3f9bc72e1d4...",
  "preimage": "7c2e91fa83b0...",
  "amount": 450000,
  "memo": "apollo-jmwangi_kisii-2026-06-08"
}
```

SabiCredit catches this, extracts the preimage, saves the credential entry, and recalculates the farmer's score.

---

### Get farmer passport

```http
GET /api/passport/jmwangi_kisii
```

**Response:** Full credential JSON with all proofs and current score.

---

### Verify a credential (lender-side)

```http
POST /api/verify
Content-Type: application/json

{
  "preimage": "7c2e91fa83b0...",
  "payment_hash": "a3f9bc72e1d4..."
}
```

**Response:**
```json
{
  "valid": true,
  "message": "Payment verified — SHA256(preimage) matches payment_hash"
}
```

---

## Scoring Algorithm

The reputation score (0–1000) is calculated from verified proofs:

```js
function calculateScore(proofs) {
  let score = 300 // base score

  for (const proof of proofs) {
    score += 60                          // +60 per repaid loan
    if (proof.on_time) score += 40       // +40 bonus for on-time
    if (proof.amount_kes > 10000) score += 20  // +20 for larger loans
  }

  const defaultPenalty = defaults * 150  // -150 per default
  score -= defaultPenalty

  return Math.min(Math.max(score, 0), 1000) // clamp 0–1000
}
```

This is intentionally simple for the hackathon. Production would weight recency, lender diversity, and loan size progression.

---

## Screens

| Screen | User | Description |
|---|---|---|
| Home | Farmer | Reputation score, loans repaid, defaults, quick actions |
| Repay | Farmer | Select lender, enter amount, scan QR to pay via Lightning |
| Credit Passport | Farmer | All verified proofs, score history, share QR button |
| Lender Scanner | Lender | Scan farmer QR, see verified history, approve or decline |

---

## Relationship to Tando

SabiCredit and Tando are **complementary, not competing**:

| | Tando | SabiCredit |
|---|---|---|
| Core job | Move money (Lightning → KES) | Record proof (payment → credential) |
| Output | KES in M-Pesa | Signed credential on farmer's phone |
| Value over time | Static — same utility each use | Compounds — passport grows stronger with each repayment |
| Touches money | Yes | Never |

In the full flow: the farmer uses SabiCredit to initiate the repayment, pays via Tando, Tando delivers KES to the lender, and SabiCredit captures the proof. They each do one job well.

---

## Why Lightning — Not M-Pesa or Ethereum

| | M-Pesa | Ethereum | Lightning |
|---|---|---|---|
| Cryptographic proof | ✗ Safaricom holds the record | ✓ On-chain | ✓ Preimage |
| Speed | Minutes | 12 seconds | < 1 second |
| Cost | ~KES 30 per transaction | High gas fees | Near zero |
| Works for unbanked | ✓ | ✗ Requires crypto literacy | ✓ Via Tando |
| Proof is portable | ✗ | ✓ | ✓ |

Lightning is the only rail that gives you speed + near-zero fees + a portable cryptographic proof in a single transaction.

---

## Roadmap

### Hackathon MVP (2 days)
- [x] LNbits invoice creation
- [x] Webhook handler + preimage capture
- [x] Credential storage (SQLite)
- [x] QR generation for farmer passport
- [x] Lender verification screen

### Version 1.0
- [ ] React Native mobile app
- [ ] USSD fallback for feature phones
- [ ] Multi-lender onboarding flow
- [ ] Score history and trend graph
- [ ] Tando direct integration

### Version 2.0
- [ ] Lender API — accept SabiCredit credentials programmatically
- [ ] Offline credential verification (no internet needed)
- [ ] Cross-border support (Uganda, Tanzania)
- [ ] Open standard for Lightning credit credentials

---

## The Bigger Vision

SabiCredit is not trying to replace lenders. It is trying to give farmers the same information advantage that lenders currently have over them.

Today, Apollo knows everything about a farmer's repayment history. The farmer knows nothing about their own standing in Apollo's eyes. SabiCredit flips that. The farmer owns their history. They walk into any lender — Apollo, a SACCO, a chama, a new microfinance startup — and present proof. The lender competes for the farmer's business based on terms, not information asymmetry.

That is financial inclusion that compounds.

---

## Built At

This project was built at the **Bitcoin Lightning Network Bootcamp & Hackathon — Kisumu, Kenya, 2026**.

---

## License

MIT — build on it, fork it, deploy it for your community.

---

## Contributors
[Odinga Valery](https://github.com/odingaval)
[Daniel Keya](https://github.com/keyadaniel56)
[Brendan Francis](https://github.com/D3ITY-YODA)
[Michael Nyawade](https://github.com/Michael-Nyawade)
[Andrew Okutu](https://github.com/aokutu)
[Ian Kimani](https://github.com/Frihk)

> *"Sabi" means "know" in Swahili/Sheng. SabiCredit is about being known — owning your reputation, carrying your proof, and never starting from zero again.*
