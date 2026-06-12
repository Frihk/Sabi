# PWA Usage

SabiCredit has Progressive Web App support for weak or no internet.

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:4000
```

## What works offline

- The main app shell is cached by `service-worker.js`.
- The manifest lets supported browsers install the app.
- Recently loaded passport data is saved in `localStorage`.
- If the internet drops, the app shell opens from cache and the passport view falls back to the last saved passport.
- API `GET` responses are cached with a network-first strategy so fresh data wins when online.
- Repayment attempts made offline or on a slow connection are saved locally and retried when the device comes back online.
- Payment itself still requires network access because Lightning/M-Pesa invoice creation happens server-side.
- Account holders can show or copy their saved history offline from the **Passport → Share QR** flow.
- Lender scanner verification works offline for shared proofs that include a raw `preimage` and `payment_hash`.

## Install locally

1. Open `http://localhost:4000` in Chrome, Edge, or Android Chrome.
2. Wait until the footer says `offline ready` or `offline installing`.
3. Use the browser install prompt or menu option to install SabiCredit.

## Test offline mode

1. Start the server and open `http://localhost:4000`.
2. Load the default farmer passport once while online.
3. Open **Passport** and confirm the history renders.
4. Open browser dev tools.
5. Set Network to Offline.
6. Refresh the page.
7. The app should still open.
8. Open **Passport** and load `jmwangi_kisii`; it should show the saved offline passport.
9. Tap **Share QR**; copyable history should appear even without network.

## Test queued repayments

1. Set Network to Offline.
2. Open **Repay** and create a repayment.
3. The app should save the payment attempt locally instead of failing.
4. Set Network back to Online.
5. The footer should show syncing, then update the saved attempt after the server responds.

## Test slow network mode

1. Open browser dev tools.
2. Set Network throttling to a very slow profile.
3. Load a passport that was opened before.
4. The saved local history should render first while the app tries to refresh in the background.

## Smoke test

With the server running:

```bash
npm run smoke
```
