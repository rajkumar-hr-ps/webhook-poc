#!/bin/bash
# Valid payment completion webhook (expect 200)
# Run 02_seed.sh first to create payment ID "2"
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /webhook — valid completion (expect 200) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "completed",
    "amount": 237,
    "webhook_event_id": "evt_valid"
  }'
