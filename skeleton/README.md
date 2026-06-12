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
