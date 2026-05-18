# Sheets

A mobile-first personal expense tracker. Open the app on your phone, authenticate with Face ID, log an expense — it lands in a Google Sheet a moment later. No passwords, no login form, no usernames.

## What's interesting about it

I wanted to find out how far you can push **"zero secrets in the frontend"** for a real app. The static page is fully public — anyone can fetch its source — yet it has no exploitable credentials, because every backend call requires a WebAuthn signature from a passkey bound to the device's hardware Secure Enclave.

A few decisions worth highlighting:

- **Three independent auth layers.** A passkey signature unlocks a short-lived JWT, which unlocks a server-to-server shared secret with the data layer. Compromising any single layer doesn't get you in.
- **Stateless WebAuthn challenges.** Challenges are HMAC-signed tokens passed through the client rather than stored in KV — half the round-trips and no replay-by-stale-state risk.
- **Single static HTML file, no build step.** ES modules from a CDN, vanilla JS. Mobile-first PWA installable to the home screen, with `localStorage` caching and proactive JWT refresh so long-open tabs never dump you back to the lock screen.
- **iOS user-activation chain preserved end-to-end.** No `prompt()` / `setTimeout` between a tap and the WebAuthn ceremony — a subtle constraint that silently breaks WebAuthn on iOS Safari if violated.

## Stack

- **Cloudflare Pages** — static frontend
- **Cloudflare Workers** — auth gateway and API proxy (WebAuthn, JWT, CORS)
- **SimpleWebAuthn** — WebAuthn server primitives
- **Google Apps Script** — backend, bound to a Google Sheet used as the datastore
- Vanilla JS + Web Crypto API on the client; no framework, no bundler

## Architecture

```
┌──────────────────┐   HTTPS + short-lived JWT   ┌────────────────────────┐
│ Browser (Face ID)│ ──────────────────────────▶ │ Cloudflare Worker      │
│ static HTML      │                              │  • WebAuthn ceremonies │
│ no secrets       │                              │  • JWT issuance        │
└──────────────────┘                              │  • Encrypted secrets   │
                                                  └─────────┬──────────────┘
                                                            │ server-to-server
                                                            ▼
                                                  ┌────────────────────────┐
                                                  │ Apps Script ↔ Sheet    │
                                                  └────────────────────────┘
```

The frontend holds nothing sensitive. The Worker is the trust boundary — it owns the only credential that can reach the data layer, and it only issues sessions in exchange for a fresh, signed passkey challenge.

## Status

This is a personal project — single user, single deployment. The code is here mostly to share the design and serve as a reference for anyone building something similar. The WebAuthn ceremonies, stateless challenge pattern, and "Worker as the only trust boundary" architecture are reusable independently of the Apps Script backend.

## License

MIT.
