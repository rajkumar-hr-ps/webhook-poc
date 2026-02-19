#!/bin/bash
# Webhook with wrong amount (expect 400)
# Run 02_seed.sh first to create payment ID "2"
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /webhook — amount mismatch (expect 400) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "completed",
    "amount": 100,
    "webhook_event_id": "evt_mismatch"
  }'
