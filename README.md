# Sheets

A mobile-first personal expense tracker. Open the app on your phone, authenticate with Face ID, log an expense — done. No passwords, no login form, no usernames.

## What's interesting about it

The static website contains no embedded credentials. Passkey authentication issues a session JSON Web Token (JWT) for browser requests.
Apple Shortcuts uses a separate capture key that can only add expenses.

A few decisions worth highlighting:

- **Worker access control.** Browser requests require a passkey session. Wallet captures require a separate, revocable key. Only the Worker accesses D1.
- **Stateless WebAuthn challenges.** Challenges are HMAC-signed tokens passed through the client rather than stored in KV — half the round-trips and no replay-by-stale-state risk.
- **Preact + Vite frontend.** Signals share component state. TanStack Query refreshes server data when the app returns to the foreground.
- **iOS user-activation chain preserved end-to-end.** No `prompt()` / `setTimeout` between a tap and the WebAuthn ceremony — a subtle constraint that silently breaks WebAuthn on iOS Safari if violated.

## Stack

- **Cloudflare Pages** — Preact + Vite frontend (`web/`)
- **Cloudflare Workers** — auth gateway and API (WebAuthn, JWT, CORS, all business logic)
- **Cloudflare D1** — SQLite datastore for transactions, faturas, rules, settings
- **SimpleWebAuthn** — WebAuthn server primitives

## Architecture

```
┌──────────────────┐   HTTPS + session JWT      ┌────────────────────────┐
│ Browser (Face ID)│ ──────────────────────────▶ │ Cloudflare Worker      │
│ Preact PWA       │                              │  • WebAuthn ceremonies │
│ no secrets       │                              │  • JWT issuance        │
└──────────────────┘                              │  • API + business logic│
                                                  └─────────┬──────────────┘
                                                            │ D1 binding
                                                            ▼
                                                  ┌────────────────────────┐
                                                  │ Cloudflare D1 (SQLite) │
                                                  └────────────────────────┘
```

The Worker controls database access. Browser sessions require a signed passkey challenge.
Runtime session tokens and newly issued capture keys are private, even though the static website contains no credentials.

## Wallet capture

Apple Shortcuts can submit Wallet amounts and merchant names without opening Gastos.
The Worker applies existing merchant rules and saves each purchase directly into `transactions`.
Captures use `Itaú Latam Pass`, the São Paulo receipt date, and a visible ⚡ marker.
Unknown merchants use `Outro`.

Config contains key creation, revocation, and iPhone setup instructions.
The basic automation sends only amount and merchant. The Worker generates the capture identifier.
Separate requests create separate entries. Clients can supply a UUID to prevent duplicate retries.
The capture key cannot read history or edit expenses.
CSV and PDF imports show possible duplicates with equal values or descriptions in the same fatura.
The user decides which incoming rows to remove.

See [Wallet setup and request contract](WALLET_SETUP.md) for setup, deployment, and limitations.

## Status

This is a personal project — single user, single deployment. The code is here mostly to share the design and serve as a reference for anyone building something similar. The WebAuthn ceremonies, stateless challenge pattern, and "Worker as the only trust boundary" architecture are reusable.

## License

MIT.
