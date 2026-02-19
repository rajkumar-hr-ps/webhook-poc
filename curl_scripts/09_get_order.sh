#!/bin/bash
# Get order by ID (default ID "1")
BASE_URL="${BASE_URL:-http://localhost:4000}"
ORDER_ID="${1:-1}"

echo "--- GET /orders/$ORDER_ID ---"
curl -s -w "\nHTTP %{http_code}\n" "$BASE_URL/orders/$ORDER_ID"
