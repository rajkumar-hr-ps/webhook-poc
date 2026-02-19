#!/bin/bash
# Reset the in-memory store (clears all data, resets ID counter)
BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "--- POST /reset ---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE_URL/reset"
