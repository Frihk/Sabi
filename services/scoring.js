function calculateScore(proofs = [], defaults = 0) {
  let score = 300
  for (const proof of proofs) {
    score += 60
    if (proof.on_time) score += 40
    if (proof.amount_kes > 10000) score += 20
  }
  score -= defaults * 150
  return Math.min(Math.max(score, 0), 1000)
}

module.exports = { calculateScore }
