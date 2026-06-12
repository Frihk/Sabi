# Webhook testing (ngrok + LNbits)

This document explains how to test LNbits webhooks locally using ngrok, and how to simulate a webhook POST to the local server for end-to-end testing.

Prerequisites
- `ngrok` installed (https://ngrok.com)
- `npm install` dependencies and the dev server running (see README)

1) Start the app locally (example uses port 4000):

```bash
PORT=4000 npm run dev
```

2) Start ngrok to expose port 4000:

```bash
ngrok http 4000
# note the https forwarding URL printed by ngrok, e.g. https://abcd1234.ngrok.io
```

3) Configure LNbits webhook
- In your LNbits invoice/webhook settings, set the webhook URL to:

  `https://<your-ngrok-subdomain>.ngrok.io/api/webhook/payment`

- Optionally set a `WEBHOOK_SECRET` in your LNbits configuration and also in your local `.env`.

4) Environment variables (example `.env`):

```
LNBITS_URL=https://your-lnbits-host
LNBITS_API_KEY=your_api_key
NGROK_URL=https://your-ngrok-subdomain.ngrok.io
WEBHOOK_SECRET=some-secret-if-you-set-it-in-lnbits
PORT=4000
```

5) Simulate a webhook POST (local test)

If you don't want to configure LNbits yet, you can simulate the webhook with curl. The server expects JSON with fields like `payment_hash`, `preimage`, `amount`, and `memo`. The route is `POST /api/webhook/payment`.

Example payload (amount is an integer; the app divides `amount / 1000` to get `amount_kes`):

```bash
curl -s -X POST http://localhost:4000/api/webhook/payment \
  -H "Content-Type: application/json" \
  -d '{
    "payment_hash": "a1b2c3d4e5f6...",
    "preimage": "deadbeef...",
    "amount": 450000,
    "memo": "TestLender-jmwangi_kisii-2026-06-11"
  }' | jq
```

- If you set `WEBHOOK_SECRET` in your `.env`, include the header `X-Webhook-Secret: <your-secret>` in the curl request, or add `?secret=<your-secret>` to the URL.

-
- Helper scripts
- Start ngrok (requires `ngrok` installed):

```bash
./scripts/start-ngrok.sh 4000
# then copy the https forwarding URL into your LNbits webhook config or set NGROK_URL
```

- Simulate a webhook using the helper script (honors `WEBHOOK_SECRET` env var if set):

```bash
./scripts/sim-webhook.sh http://localhost:4000/api/webhook/payment
```

6) Verify results
- The webhook handler logs the webhook and saves a proof for the farmer (if the memo contains the farmer id). Check `sabi.json` for new `webhook_logs` and `proofs`.

7) Troubleshooting
- If the webhook returns `403`, confirm the `X-Webhook-Secret` header matches `WEBHOOK_SECRET`.
- If no proof appears, ensure the memo follows `lender-farmerid-YYYY-MM-DD` and that `payment_hash` and `preimage` are present.

That's it — use ngrok + LNbits to test live webhooks, or use the curl example to simulate webhooks locally.
