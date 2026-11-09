# Apple Wallet capture

Wallet capture saves purchases directly into the existing transactions table.
It uses merchant rules in their configured order, with `Outro` as the fallback.
Every capture uses the configured card named `Itaú Latam Pass`.
If that card no longer exists, the server rejects the capture.

The server uses its receipt time for `created_at` and the São Paulo calendar date for `data`.
History shows an automation symbol and the receipt time.
The app refreshes its data when it returns to the foreground.

## What Apple documents

Apple documents a Transaction automation that runs when the selected Wallet card is tapped.
Apple does not publish a complete Wallet Transaction schema or guarantee its field types.
The Shortcuts variable editor shows the properties available on the device.
`Amount` and `Merchant` are reported property names, not a published JSON contract.
The input is a Shortcuts content object. It is not the JSON request that Gastos accepts.

The setup maps those two properties into the existing request fields.
It does not depend on an undocumented transaction identifier, currency property, date, or approval status.
The earlier instructions required `Generate UUID`. The current setup does not require that action or a third-party app.

## Configure the iPhone

These instructions use English action names with Portuguese equivalents.
Labels depend on the iOS version and language.
Apple documents the iOS 27 route through Edit → Automation.
Portuguese labels below are search aids, not a guarantee of exact translation.
The transaction variable can appear as `Transaction` or `Shortcut Input`.

### 1. Get the connection details

1. Open Gastos and sign in.
2. Open Config, then Apple Wallet · Atalhos.
3. Select `conectar Atalhos`.
4. If an active key is no longer available, select `gerar nova chave`.
5. Copy the authorization value, including `Bearer `.
6. Copy the endpoint from the same section.

A replacement key disables the previous key.
The key stays private in your automation.

### 2. Create the trigger on iOS 27

1. Open Shortcuts / Atalhos.
2. Create a shortcut named `Gastos Wallet`.
3. Tap Edit / Editar.
4. Tap Automation / Automação.
5. Select Transaction / Transação as the trigger.
6. Under When I tap, select the Itaú card that you use for purchases.
7. Keep any merchant filter unrestricted.
8. Configure the automation to run immediately, without confirmation.
9. Open the shortcut action editor.

Configure the trigger before selecting its variables in the request action.
This order gives the editor the transaction input context.
The run mode label can differ by language and version.

### 3. Add the request

1. Search for Get Contents of URL / Obter Conteúdo de URL.
2. Add that action.
3. Paste the Gastos endpoint into its URL field.
4. Expand the action options with the arrow or Show More / Mostrar Mais control.
5. Change Method / Método from GET to POST.
6. Open Headers / Cabeçalhos.
7. Add a header named `Authorization`.
8. Paste the complete authorization value into that header.
9. Set Request Body / Corpo da Solicitação to JSON.

Gastos parses the JSON body without requiring a `Content-Type` header.
A separate header is unnecessary for this endpoint.

### 4. Add the amount

1. Under the JSON body, tap Add New Field / Adicionar Novo Campo.
2. Choose Text / Texto.
3. Enter `amount` as the field name.
4. Tap the value cell.
5. Open Select Variable / Selecionar Variável, or the variable picker above the keyboard.
6. Select Transaction / Transação.
7. Tap the inserted transaction token.
8. Select its Amount property.

The Portuguese property label can differ. The amount property must represent the purchase value.
The value cell must contain a variable token, not the word `Amount`.
Gastos accepts numeric values and Brazilian decimal text, including `42,90` and `R$ 42,90`.

### 5. Add the merchant

1. Add another Text / Texto field to the same JSON body.
2. Enter `description` as the field name.
3. Open the variable picker in its value cell.
4. Select Transaction / Transação again.
5. Tap that transaction token.
6. Select its Merchant property.

The value cell must contain the merchant property token, not the word `Merchant`.
Each token has its own property selection.
Changing the description token must not change the amount token.

The completed body contains exactly these fields:

| Field name | Field type | Value |
|---|---|---|
| `amount` | Text | Transaction → Amount |
| `description` | Text | Transaction → Merchant |

The phone does not send a category, card, date, currency, or event identifier in this basic setup.
The server supplies those fields and applies the existing category rules.

### 6. Show the response

1. Add Show Notification / Mostrar Notificação after the request action.
2. Set its title to `Gastos`.
3. Set its message to the result variable from Get Contents of URL.
4. Save the automation.

A successful response contains `"ok":true` and `"saved":true`.
The notification shows the actual response, including validation errors.
It does not claim success before the server saves the expense.
A network error can stop Shortcuts before the notification action.

### 7. Check the first purchase

1. Make your next normal purchase with the selected card.
2. If Shortcuts requests network access, allow access to your Gastos endpoint.
3. Read the response notification.
4. Open Gastos and check the new entry marked ⚡.

Running the automation manually does not supply a real Wallet transaction.
A successful request check does not prove that Wallet supplies the fields on this phone.
The first real purchase checks that connection.

## Exporting a shortcut

Apple supports sharing shortcuts through iCloud links and files.
In iOS 27, automations are part of shortcuts, including shared shortcuts.
Personal automations are disabled by default after iCloud sync.
A shared shortcut still needs the correct card selection and private Gastos key on the receiving phone.

The Mac Shortcuts editor supports File → Export and import questions.
The `shortcuts` command can sign an existing shortcut file. It does not provide a creation command.
Apple does not publish the serialized action format as a stable authoring interface.
The available Mac runs macOS 15.8.2, which predates the documented iOS 27 automation editor.
No verified iOS 27 `.shortcut` file accompanies these instructions.
The direct shortcut uses two actions and avoids a separate helper.

## Request contract

`POST /capture/wallet` accepts a capture key in the bearer authorization header.

```json
{
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
`event_id` is optional. If present, it must be a UUID generated once for each capture.
If absent, the Worker generates a new UUID for that request.
The body limit is 4,096 bytes.

A successful request returns:

```json
{"ok":true,"saved":true,"duplicate":false}
```

A repeated supplied identifier returns `duplicate: true` without another insertion.
The identifier remains reserved after deletion, so a retry cannot restore an expense.
Two runs with different identifiers remain separate captures, even when their values match.
Requests without an identifier also remain separate captures.
The basic phone automation omits this identifier. Automatic retries must not be added to that setup.

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
The setup notification shows the server response. It does not show a fixed success message.
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

- [Apple Wallet transaction triggers for iOS 27](https://support.apple.com/en-gu/guide/shortcuts/apd65c67538a/10.0/ios/27)
- [Create an automation in iOS 27](https://support.apple.com/en-om/guide/shortcuts/apdfbdbd7123/10.0/ios/27)
- [Shortcuts changes in iOS 27](https://support.apple.com/en-us/149045)
- [Sync shortcuts in iOS 27](https://support.apple.com/en-az/guide/shortcuts/apdb3a4240b0/10.0/ios/27)
- [Shortcuts variable properties](https://support.apple.com/en-ie/guide/shortcuts/apda36b9018b/ios)
- [Shortcuts export](https://support.apple.com/en-lamr/guide/shortcuts-mac/apdf01f8c054/mac)
- [Shortcuts command line](https://support.apple.com/en-hk/guide/shortcuts-mac/apd455c82f02/mac)
- [Shortcuts network requests](https://support.apple.com/lt-lt/guide/shortcuts/apd58d46713f/10.0/ios/27)
- [Reported Wallet trigger timeouts](https://developer.apple.com/forums/thread/765516)
