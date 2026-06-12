#!/usr/bin/env bash
set -euo pipefail
URL=${1:-http://localhost:4000/api/webhook/payment}
SECRET_HEADER=""
if [ -n "${WEBHOOK_SECRET-}" ]; then
  SECRET_HEADER="-H X-Webhook-Secret:${WEBHOOK_SECRET}"
fi
cat <<EOF | xargs -0 -I{} sh -c "curl -s -X POST ${URL} -H 'Content-Type: application/json' ${SECRET_HEADER} -d '{}' -w '\nHTTP_STATUS:%{http_code}\n'"
{
  "payment_hash": "${RANDOM}${RANDOM}${RANDOM}",
  "preimage": "${RANDOM}${RANDOM}",
  "amount": 450000,
  "memo": "ScriptLender-jmwangi_kisii-$(date +%F)"
}
EOF
