#!/bin/bash
# List tickets for an order (default order_id "1")
BASE_URL="${BASE_URL:-http://localhost:4000}"
ORDER_ID="${1:-1}"

echo "--- GET /tickets?order_id=$ORDER_ID ---"
curl -s -w "\nHTTP %{http_code}\n" "$BASE_URL/tickets?order_id=$ORDER_ID"
