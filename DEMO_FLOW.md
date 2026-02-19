# Webhook POC — Demo Flow

This document explains the complete flow for demonstrating that webhook-related payment tasks are testable on the HackerRank platform.

---

## What This POC Proves

- A payment webhook handler can be tested **without MongoDB or Redis**
- Candidates can **run tests** to validate their fix (`npm test`)
- Candidates can **manually test via curl or Swagger UI** to verify behavior
- The JUnit XML output (`unit.xml`) works with HackerRank's scoring system
- The buggy code fails 7/10 tests; the solution passes 10/10

---

## Setup

```bash
npm install
npm start          # server starts on http://localhost:4000
```

Open **http://localhost:4000/api-docs/** for Swagger UI.

---

## Data Model (In-Memory)

After seeding, the store contains:

```
Order #1     →  total_amount: 237, status: pending, payment_status: pending
Payment #2   →  order_id: "1", amount: 237, status: pending
Ticket #3    →  order_id: "1", status: held, unit_price: 79
Ticket #4    →  order_id: "1", status: held, unit_price: 79
Ticket #5    →  order_id: "1", status: held, unit_price: 79
```

IDs auto-increment: order gets 1, payment gets 2, tickets get 3/4/5.

---

## API Flow — Step by Step

### Step 1: Reset and Seed Data

Always start fresh to get predictable IDs.

```bash
# Clear everything
curl -X POST http://localhost:4000/reset

# Seed: 1 order ($237) + 1 payment + 3 held tickets
curl -X POST http://localhost:4000/seed \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      { "total_amount": 237, "status": "pending", "payment_status": "pending" }
    ],
    "payments": [
      { "order_id": "1", "amount": 237, "status": "pending" }
    ],
    "tickets": [
      { "order_id": "1", "status": "held", "unit_price": 79 },
      { "order_id": "1", "status": "held", "unit_price": 79 },
      { "order_id": "1", "status": "held", "unit_price": 79 }
    ]
  }'
```

**Verify seeded data:**
```bash
curl http://localhost:4000/orders/1
# → { "id": "1", "total_amount": 237, "status": "pending", "payment_status": "pending" }

curl http://localhost:4000/payments/2
# → { "id": "2", "order_id": "1", "amount": 237, "status": "pending" }

curl http://localhost:4000/tickets?order_id=1
# → [{ "id": "3", "status": "held" }, { "id": "4", "status": "held" }, { "id": "5", "status": "held" }]
```

---

### Step 2: Test Error Cases

#### 2a. Payment Not Found (expect 404)
```bash
curl -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "999",
    "status": "completed",
    "amount": 237,
    "webhook_event_id": "evt_not_found"
  }'
# → { "error": "payment not found" }   HTTP 404
```

#### 2b. Amount Mismatch (expect 400)
```bash
curl -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "completed",
    "amount": 100,
    "webhook_event_id": "evt_mismatch"
  }'
# → { "error": "payment amount does not match order total" }   HTTP 400
```

---

### Step 3: Process a Valid Payment Webhook

```bash
curl -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "completed",
    "amount": 237,
    "webhook_event_id": "evt_valid"
  }'
# → { "received": true, "payment_status": "completed" }   HTTP 200
```

**Now verify what changed:**

```bash
# Order should be confirmed + paid
curl http://localhost:4000/orders/1
# → { "status": "confirmed", "payment_status": "paid" }

# Payment should be completed
curl http://localhost:4000/payments/2
# → { "status": "completed", "processed_at": "2026-..." }

# All 3 tickets should be confirmed (were "held")
curl http://localhost:4000/tickets?order_id=1
# → [{ "status": "confirmed" }, { "status": "confirmed" }, { "status": "confirmed" }]

# Webhook log should exist
curl http://localhost:4000/webhook-logs?webhook_event_id=evt_valid
# → [{ "webhook_event_id": "evt_valid", "payment_id": "2", "status": "completed" }]
```

---

### Step 4: Test Idempotency (Duplicate Webhook)

Send the **exact same webhook** again (same `webhook_event_id`):

```bash
curl -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "completed",
    "amount": 237,
    "webhook_event_id": "evt_valid"
  }'
# → { "received": true, "duplicate": true }   HTTP 200
```

The handler recognized `evt_valid` was already processed and returned `duplicate: true` without processing it again.

---

### Step 5: Test Invalid Status Transition

Payment is now `completed`. Try to move it back to `pending`:

```bash
curl -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "pending",
    "amount": 237,
    "webhook_event_id": "evt_bad_transition"
  }'
# → { "received": true, "ignored": true, "reason": "cannot transition from 'completed' to 'pending'" }
```

The handler blocked the invalid transition and returned `ignored: true`.

---

### Step 6: Test Failed Payment

Reset and seed fresh data, then send a `failed` status:

```bash
curl -X POST http://localhost:4000/reset
curl -X POST http://localhost:4000/seed \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [{ "total_amount": 237, "status": "pending", "payment_status": "pending" }],
    "payments": [{ "order_id": "1", "amount": 237, "status": "pending" }],
    "tickets": [{ "order_id": "1", "status": "held", "unit_price": 79 }]
  }'

curl -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "failed",
    "amount": 237,
    "webhook_event_id": "evt_failed"
  }'
# → { "received": true, "payment_status": "failed" }

# Verify order payment_status is "failed"
curl http://localhost:4000/orders/1
# → { "status": "pending", "payment_status": "failed" }
```

---

## Running Automated Tests

### With Solution Code (all pass)

The app currently imports `webhook.service.js` (solution):

```bash
npm test
# 10 passing
```

JUnit XML output is written to `unit.xml` — this is what HackerRank reads for scoring.

### With Buggy Code (7 fail)

Change the import in `src/app.js`:

```js
// Change this line:
import { processWebhook } from './webhook.service.js';
// To:
import { processWebhook } from './webhook.buggy.js';
```

Then run:

```bash
npm test
# 3 passing, 7 failing
```

The 3 that still pass with buggy code:
1. Payment not found (404) — buggy code handles this
2. Valid payment completion — buggy code does update order on "completed"
3. processing → completed — same as above

The 7 that fail:
1. Amount mismatch — buggy code skips amount verification
2. Duplicate idempotency — buggy code has no dedup
3. Invalid status transition — buggy code allows any transition
4. Ticket confirmation — buggy code never confirms tickets
5. Failed payment — buggy code ignores failed status
6. Webhook log — buggy code doesn't create logs
7. Order not found — buggy code doesn't check if order exists

---

## Using Curl Scripts

Individual scripts are in `curl_scripts/`. Run them in order:

```bash
bash curl_scripts/01_reset.sh                      # Reset store
bash curl_scripts/02_seed.sh                       # Seed data
bash curl_scripts/03_webhook_not_found.sh          # 404 case
bash curl_scripts/04_webhook_amount_mismatch.sh    # 400 case
bash curl_scripts/05_webhook_valid.sh              # Happy path
bash curl_scripts/06_webhook_duplicate.sh          # Idempotency
bash curl_scripts/07_webhook_invalid_transition.sh # Blocked transition
bash curl_scripts/09_get_order.sh                  # Verify order
bash curl_scripts/10_get_payment.sh                # Verify payment
bash curl_scripts/11_get_tickets.sh                # Verify tickets
bash curl_scripts/12_get_webhook_logs.sh evt_valid # Verify audit log
```

Or run the full end-to-end script:

```bash
bash curl_test.sh
```

---

## Using Swagger UI

1. Open **http://localhost:4000/api-docs/**
2. Follow this order:

| Step | Endpoint | Action |
|------|----------|--------|
| 1 | `POST /reset` | Click "Try it out" → Execute |
| 2 | `POST /seed` | Use the pre-filled example → Execute |
| 3 | `GET /orders/1` | Verify order exists (status: pending) |
| 4 | `GET /payments/2` | Verify payment exists (status: pending) |
| 5 | `GET /tickets?order_id=1` | Verify 3 tickets (status: held) |
| 6 | `POST /webhook` | Select "Valid payment completion" example → Execute |
| 7 | `GET /orders/1` | Verify status changed to **confirmed**, payment_status to **paid** |
| 8 | `GET /tickets?order_id=1` | Verify all tickets now **confirmed** |
| 9 | `GET /webhook-logs` | Verify audit log entry was created |
| 10 | `POST /webhook` | Same body again → should return `duplicate: true` |

---

## What the Candidate Experience Looks Like

On HackerRank, the candidate would:

1. See the codebase with the buggy `processWebhook` function
2. Run `npm test` → **7 tests fail**
3. Read the failing test names to understand what's expected:
   - "should return 400 when amount does not match order total"
   - "should handle duplicate webhook idempotently"
   - "should ignore invalid status transition"
   - "should confirm all held tickets on successful payment"
   - "should update order payment_status on failed payment"
   - "should create a webhook log entry"
   - "should return 404 when order does not exist for payment"
4. Fix the `processWebhook` function in `webhook.service.js`
5. Run `npm test` → **10 tests pass**
6. Optionally start the server and verify via curl/Swagger

The candidate does NOT need to:
- Set up MongoDB or Redis
- Configure any external services
- Understand HMAC signatures
- Touch any file other than `webhook.service.js`

---

## Files Overview

| File | Purpose |
|------|---------|
| `src/webhook.service.js` | **Solution** — working webhook handler (10/10 tests pass) |
| `src/webhook.buggy.js` | **Buggy version** — what the candidate would receive (3/10 pass) |
| `src/app.js` | Express 5 app — routes, Swagger UI, error handler |
| `src/store.js` | In-memory database (replaces MongoDB) |
| `src/swagger.js` | OpenAPI 3.0 spec for Swagger UI |
| `src/server.js` | Standalone server (port 4000) |
| `test/webhook.spec.js` | 10 Mocha test cases |
| `curl_scripts/` | 12 individual curl scripts |
| `curl_test.sh` | Full end-to-end curl test |
| `config.json` | Mocha reporter config (spec + JUnit XML) |
