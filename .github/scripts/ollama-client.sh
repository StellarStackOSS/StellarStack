#!/bin/bash

# Ollama API Client Script
# Connects to a local Ollama instance and generates summaries using neural-chat model
# Usage: ./ollama-client.sh <prompt> [model]

set -e

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
MODEL="${2:-neural-chat}"
PROMPT="$1"
TIMEOUT=120  # 2 minutes timeout
MAX_RETRIES=3
RETRY_COUNT=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1" >&2
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Validate input
if [ -z "$PROMPT" ]; then
  log_error "Prompt is required"
  echo "Usage: $0 <prompt> [model]" >&2
  exit 1
fi

# Test Ollama connection
test_connection() {
  log_info "Testing connection to Ollama at $OLLAMA_URL..."

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 5 \
    "$OLLAMA_URL/api/tags" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ]; then
    log_info "✓ Successfully connected to Ollama"
    return 0
  else
    log_error "Failed to connect to Ollama (HTTP $http_code)"
    return 1
  fi
}

# Generate completion from Ollama
generate() {
  local prompt="$1"
  local attempt=1

  while [ $attempt -le $MAX_RETRIES ]; do
    if [ $attempt -gt 1 ]; then
      log_warn "Retry attempt $attempt/$MAX_RETRIES..."
      # Exponential backoff: 2^(attempt-1) seconds
      sleep $((2 ** (attempt - 1)))
    fi

    log_info "Sending prompt to Ollama ($attempt/$MAX_RETRIES)..."

    local response
    response=$(curl -s -X POST "$OLLAMA_URL/api/generate" \
      --max-time $TIMEOUT \
      -H "Content-Type: application/json" \
      -d @- <<EOF 2>/dev/null || echo '{"error":"request_failed"}'
{
  "model": "$MODEL",
  "prompt": "$prompt",
  "stream": false,
  "options": {
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "num_predict": 500
  }
}
EOF
    )

    # Check if we got an error response
    if echo "$response" | grep -q '"error"'; then
      attempt=$((attempt + 1))
      continue
    fi

    # Extract response text using multiple fallback methods
    local text
    text=$(echo "$response" | jq -r '.response // empty' 2>/dev/null || \
           echo "$response" | jq -r '.text // empty' 2>/dev/null || \
           echo "")

    if [ -n "$text" ] && [ "$text" != "null" ]; then
      log_info "✓ Successfully generated response"
      echo "$text"
      return 0
    fi

    attempt=$((attempt + 1))
  done

  log_error "Failed to generate response after $MAX_RETRIES attempts"
  return 1
}

# Main execution
main() {
  # Test connection first
  if ! test_connection; then
    log_error "Cannot connect to Ollama at $OLLAMA_URL"
    log_error "Ensure Ollama is running and OLLAMA_URL is correct"
    exit 1
  fi

  # Generate summary
  if ! generate "$PROMPT"; then
    log_error "Failed to generate response from Ollama"
    exit 1
  fi
}

main
