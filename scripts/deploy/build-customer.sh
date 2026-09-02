#!/bin/bash
# Build script for customer deployment
# Usage: ./scripts/deploy/build-customer.sh <customer-slug> <cloudflare-api-token> <cloudflare-account-id>

set -euo pipefail

CUSTOMER_SLUG="${1:?Usage: $0 <customer-slug> <cloudflare-api-token> <cloudflare-account-id>}"
CF_API_TOKEN="${2:?Usage: $0 <customer-slug> <cloudflare-api-token> <cloudflare-account-id>}"
CF_ACCOUNT_ID="${3:?Usage: $0 <customer-slug> <cloudflare-api-token> <cloudflare-account-id>}"

echo "=== Building for customer: $CUSTOMER_SLUG ==="

# Set environment variables for this customer
export CUSTOMER_SITE_ID="$CUSTOMER_SLUG"
export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"

# Clean previous build
echo "Cleaning previous build..."
rm -rf .next .open-next out

# Build the application
echo "Building Next.js application..."
npx next build

# Prepare OpenNext output for Cloudflare
echo "Preparing OpenNext output..."
npx @opennextjs/cloudflare

echo "=== Build complete ==="
echo "Output directory: .open-next"
echo ""
echo "To deploy, run:"
echo "  CLOUDFLARE_API_TOKEN=$CF_API_TOKEN npx wrangler pages deploy .open-next --project-name=$CUSTOMER_SLUG"
