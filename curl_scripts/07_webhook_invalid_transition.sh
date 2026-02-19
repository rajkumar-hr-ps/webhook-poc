#!/bin/bash
# Invalid status transition: completed -> pending (expect 200 + ignored:true)
# Run 05_webhook_valid.sh first so payment is already "completed"
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /webhook — invalid transition (expect 200 + ignored) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "pending",
    "amount": 237,
    "webhook_event_id": "evt_invalid_transition"
  }'
