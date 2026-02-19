#!/bin/bash
# ============================================================
# Webhook POC — Manual curl test script
# Start the server first:  npm start
# Then run this script:    bash curl_test.sh
# ============================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "=== Webhook POC — Manual Testing ==="
echo ""

# Step 1: Seed test data
echo "--- Step 1: Seed order + payment + tickets ---"
SEED=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/seed" \
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
  }')
HTTP_CODE=$(echo "$SEED" | tail -1)
BODY=$(echo "$SEED" | sed '$d')
echo "HTTP $HTTP_CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

PAYMENT_ID="2"

# Step 2: Non-existent payment (expect 404)
echo "--- Step 2: Non-existent payment (expect 404) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "999",
    "status": "completed",
    "amount": 237,
    "webhook_event_id": "evt_curl_001"
  }'
echo ""

# Step 3: Amount mismatch (expect 400)
echo "--- Step 3: Amount mismatch (expect 400) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"payment_id\": \"$PAYMENT_ID\",
    \"status\": \"completed\",
    \"amount\": 100,
    \"webhook_event_id\": \"evt_curl_002\"
  }"
echo ""

# Step 4: Valid webhook (expect 200)
echo "--- Step 4: Valid completion (expect 200) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"payment_id\": \"$PAYMENT_ID\",
    \"status\": \"completed\",
    \"amount\": 237,
    \"webhook_event_id\": \"evt_curl_003\"
  }"
echo ""

# Step 5: Duplicate webhook (expect 200 + duplicate:true)
echo "--- Step 5: Duplicate webhook (expect 200 + duplicate) ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"payment_id\": \"$PAYMENT_ID\",
    \"status\": \"completed\",
    \"amount\": 237,
    \"webhook_event_id\": \"evt_curl_003\"
  }"
echo ""

# Step 6: Verify order is now confirmed
echo "--- Step 6: Verify order status ---"
curl -s -w "\nHTTP %{http_code}\n" "$BASE_URL/orders/1"
echo ""

echo "=== Done ==="
