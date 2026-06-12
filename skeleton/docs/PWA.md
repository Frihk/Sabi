# PWA Usage

SabiCredit now has basic Progressive Web App support for weak or no internet.

## Run locally

```bash
cd skeleton
npm run dev
```

Open:

```text
http://localhost:4000
```

## What works offline

- The main app shell is cached by `service-worker.js`.
- The manifest lets supported browsers install the app.
- Recently loaded passport data is saved in the browser.
- If the internet drops, the app can show the saved passport data.

## Test offline mode

1. Start the server and open `http://localhost:4000`.
2. Load the default farmer passport once while online.
3. Open browser dev tools.
4. Set Network to Offline.
5. Refresh the page.
6. The app should still open and show cached passport data.
