#!/bin/bash
# Seed test data: 1 order ($237), 1 payment, 3 held tickets
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /seed ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/seed" \
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
