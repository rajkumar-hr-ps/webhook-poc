#!/bin/bash
# List webhook log entries (optionally filter by event ID)
BASE_URL="${BASE_URL:-http://localhost:4000}"
EVENT_ID="${1:-}"

if [ -n "$EVENT_ID" ]; then
  echo "--- GET /webhook-logs?webhook_event_id=$EVENT_ID ---"
  curl -s -w "\nHTTP %{http_code}\n" "$BASE_URL/webhook-logs?webhook_event_id=$EVENT_ID"
else
  echo "--- GET /webhook-logs (all) ---"
  curl -s -w "\nHTTP %{http_code}\n" "$BASE_URL/webhook-logs"
fi
