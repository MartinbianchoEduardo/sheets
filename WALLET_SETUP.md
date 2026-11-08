# Apple Wallet capture

Wallet capture saves purchases directly into the existing transactions table.
It uses merchant rules in their configured order, with `Outro` as the fallback.
Every capture uses the configured card named `Itaú Latam Pass`.
If that card no longer exists, the server rejects the capture.

The server uses its receipt time for `created_at` and the São Paulo calendar date for `data`.
History shows an automation symbol and the receipt time.
The app refreshes its data when it returns to the foreground.

## Configure the iPhone

1. Open Gastos and sign in.
2. Open Config, then Apple Wallet · Atalhos.
3. Select `conectar Atalhos`.
4. Copy the authorization value and endpoint from this section.
5. Open Shortcuts and create a Wallet / Transaction automation for the Itaú card.
6. Enable immediate execution.
7. If available, enable permission to run while locked.
8. Extract `Amount` from the transaction input.
9. Extract `Merchant` from the same input.
10. Add `Generate UUID` and retain its output for `event_id`.
11. Add `Get Contents of URL` with the endpoint from Gastos.
12. Select `POST`.
13. Add the `Authorization` header with the complete copied value, including `Bearer `.
14. Add the `Content-Type` header with `application/json`.
15. Select a JSON request body.
16. Add `amount` with the extracted amount in reais.
17. Add `description` with the extracted merchant.
18. Add `event_id` with the generated UUID.
19. Read `ok` from the response.
20. If `ok` is true, show a success notification.
21. If `ok` is false, show the returned error.

Action names depend on the language and iOS version.
The automation uses structured Wallet fields, not free-text bank notifications.
The input must contain the separate amount and merchant properties, not the complete transaction object.
The user must create and authorize the automation on the iPhone.

## Request contract

`POST /capture/wallet` accepts a capture key in the bearer authorization header.

```json
{
  "event_id": "3f46fa21-5b4e-4a10-bd67-07ef7fce60dc",
  "description": "LOJA EXEMPLO",
  "amount": "42,90",
  "currency": "BRL"
}
```

`currency` is optional and defaults to BRL. Other currency codes are rejected.
`amount` accepts a positive number or a decimal string in reais.
Examples include `42.90`, `"42,90"`, and `"R$ 1.234,56"`.
Empty, malformed, negative, and zero amounts are rejected.
`description` accepts up to 200 characters after whitespace trimming.
`event_id` must be a UUID generated once for each capture.
The body limit is 4,096 bytes.

A successful request returns:

```json
{"ok":true,"saved":true,"duplicate":false}
```

A repeated identifier returns `duplicate: true` without another insertion.
The identifier remains reserved after deletion, so a retry cannot restore an expense.
Two runs with different identifiers remain separate captures, even when their values match.

`401` means the capture key is missing, invalid, or revoked.
`400` means the fields or configured card are invalid.
`413` means the body exceeds the size limit.

## Access

The existing passkey session protects these management endpoints:

- `POST /api/capture/status` returns connection status and the default card name.
- `POST /api/capture/rotate` replaces the key and returns the new value once.
- `POST /api/capture/revoke` disables capture.

The capture key only authorizes `/capture/wallet`.
It cannot read history, edit transactions, or change settings.
The server stores its SHA-256 hash in the existing settings row.
The website only shows a new key after an authenticated request.
The key is absent from static files and browser persistent storage.
Key responses use `Cache-Control: no-store`.

If you replace the key, update the shortcut with its new value.
Do not share a shortcut that contains the key.

## Import matching

CSV and PDF previews flag existing entries with an equal value or normalized description in the same resolved fatura.
Description comparison ignores case and repeated whitespace.
If a row has no resolved fatura, matching uses its date instead.
Deleted entries do not appear as matches.
The preview shows matching entries, their cards, dates, values, and automation markers.
Equal values or descriptions within the import file also produce warnings.

Warnings do not delete or merge entries.
If an expense already exists, remove the incoming row with its × button before confirmation.
The existing exact duplicate flag remains available.

## Limits

The first version requires an internet connection and has no offline queue.
Shortcuts can stop on a network error before it reads the response.
An automatic success notification appears only after the server acknowledges the capture.
Wallet can miss an event or omit transaction details.
The app cannot recover an event that never reaches the shortcut.

Capture does not distinguish approved and declined payments.
Delete an accidental expense through the existing History editor.
Installment counts are not inferred from Wallet data.
Only a real purchase can check the complete phone flow.

## Deployment

Apply migration `0007_wallet_capture.sql` before deploying the Worker:

```sh
cd gastos-auth
npx wrangler d1 execute gastos-db --remote --file=migrations/0007_wallet_capture.sql
cd ..
npm run deploy
```

The migration adds columns to `transactions` and `settings`, plus a unique capture identifier index.
It does not create a database or an inbox table.

## References

- [Apple Wallet transaction triggers](https://support.apple.com/en-mide/guide/shortcuts/apd65c67538a/ios)
- [Shortcuts network requests](https://support.apple.com/lt-lt/guide/shortcuts/apd58d46713f/10.0/ios/27)
- [Reported Wallet trigger timeouts](https://developer.apple.com/forums/thread/765516)
