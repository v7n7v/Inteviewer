#!/bin/bash
# ═══════════════════════════════════════════════════
# Talent Studio — Cloud Run Deployment Script
# ═══════════════════════════════════════════════════
# Usage: ./deploy-cloudrun.sh
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated
#   2. Cloud Run API enabled in GCP console
#   3. .env.local file with all environment variables
# ═══════════════════════════════════════════════════

set -e

PROJECT_ID="talent-consulting-acf16"
REGION="us-east1"
SERVICE_NAME="talent-studio"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "══════════════════════════════════════"
echo "  Talent Studio → Cloud Run Deploy"
echo "══════════════════════════════════════"

# Step 1: Set the project
echo "→ Setting GCP project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Step 2: Build the Docker image via Cloud Build
echo "→ Building Docker image via Cloud Build..."
gcloud builds submit --tag ${IMAGE_NAME} --timeout=1200

# Step 3: Deploy to Cloud Run
echo "→ Deploying to Cloud Run (${REGION})..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --env-vars-file .env.cloudrun.yaml

echo ""
echo "══════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "  Service URL will be shown above."
echo ""
echo "  Next steps:"
echo "  1. Map your custom domain:"
echo "     gcloud run domain-mappings create \\"
echo "       --service=${SERVICE_NAME} \\"
echo "       --domain=talentconsulting.io \\"
echo "       --region=${REGION}"
echo ""
echo "  2. Update DNS records as shown by gcloud"
echo "══════════════════════════════════════"
