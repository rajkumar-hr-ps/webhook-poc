#!/bin/bash
# Webhook with non-existent payment (expect 404)
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /webhook — payment not found (expect 404) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "999",
    "status": "completed",
    "amount": 237,
    "webhook_event_id": "evt_not_found"
  }'
