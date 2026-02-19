#!/bin/bash
# Duplicate webhook (same webhook_event_id as 05 — expect 200 + duplicate:true)
# Run 05_webhook_valid.sh first
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /webhook — duplicate event (expect 200 + duplicate) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "2",
    "status": "completed",
    "amount": 237,
    "webhook_event_id": "evt_valid"
  }'
