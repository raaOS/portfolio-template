#!/bin/bash
# Deploy script for customer deployment
# Usage: ./scripts/deploy/deploy-customer.sh <customer-slug> <cloudflare-api-token> <cloudflare-account-id>
#
# Prerequisites:
#   1. Run build-customer.sh first
#   2. Cloudflare Pages project must exist

set -euo pipefail

CUSTOMER_SLUG="${1:?Usage: $0 <customer-slug> <cloudflare-api-token> <cloudflare-account-id>}"
CF_API_TOKEN="${2:?Usage: $0 <customer-slug> <cloudflare-api-token> <cloudflare-account-id>}"
CF_ACCOUNT_ID="${3:?Usage: $0 <customer-slug> <cloudflare-api-token> <cloudflare-account-id>}"

echo "=== Deploying for customer: $CUSTOMER_SLUG ==="

# Check if build output exists
if [ ! -d ".open-next" ]; then
  echo "Error: .open-next directory not found. Run build-customer.sh first."
  exit 1
fi

# Deploy to Cloudflare Pages
echo "Deploying to Cloudflare Pages..."
CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" \
npx wrangler pages deploy .open-next \
  --project-name="$CUSTOMER_SLUG" \
  --commit-dirty=true

echo "=== Deployment complete ==="
echo "Customer site: https://$CUSTOMER_SLUG.pages.dev"
