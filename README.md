# Webhook POC — Payment Webhook Handler

Standalone proof-of-concept for a payment webhook handler. Uses an **in-memory store** with zero external dependencies (no MongoDB, no Redis). Built to validate that the webhook task is testable in constrained environments like HackerRank.

## Stack

- **Runtime**: Node.js 22+
- **Framework**: Express 5
- **Testing**: Mocha 11 + Chai 5 + chai-http
- **Docs**: Swagger UI (OpenAPI 3.0)
- **Storage**: In-memory (plain JS arrays)

## Quick Start

```bash
npm install
npm start          # starts server on http://localhost:4000
```

Open **http://localhost:4000/api-docs/** in your browser to explore and test all endpoints via Swagger UI.

## Project Structure

```
├── src/
│   ├── app.js                 # Express app with routes + Swagger UI
│   ├── server.js              # Standalone server (port 4000)
│   ├── store.js               # In-memory database
│   ├── swagger.js             # OpenAPI 3.0 specification
│   ├── webhook.service.js     # Solution (all tests pass)
│   └── webhook.buggy.js       # Buggy version (candidate receives this)
├── test/
│   └── webhook.spec.js        # 10 Mocha test cases
├── curl_scripts/              # Individual curl scripts per endpoint
│   ├── 01_reset.sh
│   ├── 02_seed.sh
│   ├── 03_webhook_not_found.sh
│   ├── 04_webhook_amount_mismatch.sh
│   ├── 05_webhook_valid.sh
│   ├── 06_webhook_duplicate.sh
│   ├── 07_webhook_invalid_transition.sh
│   ├── 08_webhook_failed_payment.sh
│   ├── 09_get_order.sh
│   └── 10_get_payment.sh
├── curl_test.sh               # Full end-to-end curl test (runs all steps)
├── config.json                # Mocha multi-reporter config (spec + JUnit XML)
└── package.json
```

## API Endpoints

| Method | Path             | Description                          |
|--------|------------------|--------------------------------------|
| POST   | `/webhook`       | Process a payment webhook event      |
| POST   | `/seed`          | Seed orders, payments, and tickets   |
| POST   | `/reset`         | Clear all data and reset ID counter  |
| GET    | `/orders/:id`    | Lookup an order by ID                |
| GET    | `/payments/:id`  | Lookup a payment by ID               |
| GET    | `/api-docs/`     | Swagger UI                           |
| GET    | `/api-docs.json` | Raw OpenAPI spec (JSON)              |

## Testing

### Automated Tests (Mocha)

```bash
npm test           # runs 10 tests, outputs spec + JUnit XML (unit.xml)
npm run test:quick # runs tests with spec reporter only (faster)
```

**With the solution code** (`src/webhook.service.js`): 10/10 passing.
**With the buggy code** (`src/webhook.buggy.js`): 3 passing, 7 failing.

### Swagger UI

1. Start the server: `npm start`
2. Open http://localhost:4000/api-docs/
3. Use the "Try it out" button on any endpoint
4. Seed data first via `POST /seed`, then fire webhook events

### Individual Curl Scripts

Start the server in one terminal, then run scripts from another:

```bash
# Terminal 1
npm start

# Terminal 2 — run scripts in order
bash curl_scripts/01_reset.sh                    # reset store
bash curl_scripts/02_seed.sh                     # seed 1 order + 1 payment + 3 tickets
bash curl_scripts/03_webhook_not_found.sh        # expect 404
bash curl_scripts/04_webhook_amount_mismatch.sh  # expect 400
bash curl_scripts/05_webhook_valid.sh            # expect 200 (payment completed)
bash curl_scripts/06_webhook_duplicate.sh        # expect 200 + duplicate:true
bash curl_scripts/07_webhook_invalid_transition.sh # expect 200 + ignored:true
bash curl_scripts/09_get_order.sh                # verify order is confirmed
bash curl_scripts/10_get_payment.sh              # verify payment is completed
```

For the failed payment test, reset and re-seed first:

```bash
bash curl_scripts/01_reset.sh
bash curl_scripts/02_seed.sh
bash curl_scripts/08_webhook_failed_payment.sh   # expect 200 (payment failed)
bash curl_scripts/09_get_order.sh                # verify order.payment_status = "failed"
```

You can also override the base URL:

```bash
BASE_URL=http://localhost:5000 bash curl_scripts/05_webhook_valid.sh
```

### Full End-to-End Curl Script

Runs all scenarios in sequence:

```bash
bash curl_test.sh
```

## Webhook Handler Logic

The solution webhook handler (`src/webhook.service.js`) implements:

1. **Idempotency** — Deduplicates by `webhook_event_id` (skips if already processed)
2. **Webhook logging** — Creates an audit log entry for every new event
3. **Payment lookup** — Returns 404 if payment doesn't exist
4. **Order lookup** — Returns 404 if the payment's order doesn't exist
5. **Amount verification** — Returns 400 if webhook amount doesn't match order total
6. **Status transition validation** — Only allows valid transitions:
   - `pending` → `processing`, `completed`, `failed`
   - `processing` → `completed`, `failed`
   - `completed` → _(none — terminal)_
   - `failed` → `processing`
7. **Payment update** — Sets new status and `processed_at` timestamp
8. **Order + ticket updates**:
   - On `completed`: order → `confirmed` / `paid`, all held tickets → `confirmed`
   - On `failed`: order.payment_status → `failed`

## Bugs in the Buggy Version

The candidate version (`src/webhook.buggy.js`) is missing all of the above except payment lookup and basic status update. Specifically:

- No idempotency check (duplicate webhooks processed multiple times)
- No amount verification (accepts any amount)
- No status transition validation (allows `completed` → `pending`)
- No webhook logging (no audit trail)
- No ticket confirmation (held tickets stay held forever)
- No failed payment handling (order status not updated on failure)
- No order existence check (crashes silently if order missing)

## Switching Between Solution and Buggy Code

In `src/app.js`, change the import:

```js
// Solution (all tests pass)
import { processWebhook } from './webhook.service.js';

// Buggy version (7 tests fail)
import { processWebhook } from './webhook.buggy.js';
```

## Test Cases

| # | Test | Validates |
|---|------|-----------|
| 1 | Payment not found → 404 | Basic error handling |
| 2 | Amount mismatch → 400 | Amount verification |
| 3 | Duplicate webhook → idempotent | Idempotency |
| 4 | Valid completion → order confirmed | Happy path |
| 5 | completed → pending → ignored | Status transitions |
| 6 | Tickets confirmed on payment | Ticket lifecycle |
| 7 | Failed payment → order updated | Failure handling |
| 8 | Webhook log created | Audit trail |
| 9 | Order not found → 404 | Order validation |
| 10 | processing → completed → valid | Status transitions |
