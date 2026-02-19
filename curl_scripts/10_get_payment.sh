#!/bin/bash
# Get payment by ID (default ID "2")
BASE_URL="${BASE_URL:-http://localhost:4000}"
PAYMENT_ID="${1:-2}"

echo "--- GET /payments/$PAYMENT_ID ---"
curl -s -w "\nHTTP %{http_code}\n" "$BASE_URL/payments/$PAYMENT_ID"
