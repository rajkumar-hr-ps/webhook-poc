#!/bin/bash
# Failed payment webhook (expect 200, order.payment_status -> "failed")
# Run 01_reset.sh + 02_seed.sh first for a fresh pending payment
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /webhook — failed payment (expect 200) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "failed",
    "amount": 237,
    "webhook_event_id": "evt_failed"
  }'
