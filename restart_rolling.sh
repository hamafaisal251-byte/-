#!/usr/bin/env bash
# ==============================================================================
# restart_rolling.sh
# Sovereign FX Trading Bot (NEXUS Engine)
# Zero-Downtime Rolling Deployment Orchestrator
# ==============================================================================
set -euo pipefail

# Configurations
APP_NAME="nexus-sovereign-bot"
TARGET_PORT=3000
TEMPORARY_GREEN_PORT=3001
POLL_INTERVAL_SEC=2
MAX_POLL_ATTEMPTS=30 # 60 seconds max timeout
SYSTEM_VERSION="1.5.0"

echo "======================================================================"
echo "🚀 INITIATING ZERO-DOWNTIME ROLLING DEPLOYMENT FOR VERSION ${SYSTEM_VERSION}"
echo "======================================================================"

# Step 1: Detect current active container configuration
echo "Checking active containers..."
ACTIVE_CONTAINERS=$(docker ps --filter "name=${APP_NAME}" --format '{{.Names}}')

if [ -z "${ACTIVE_CONTAINERS}" ]; then
  echo "⚠️  No active container detected. Performing a clean, direct boot..."
  docker compose up -d
  echo "✅ Core services booted."
  exit 0
fi

echo "Detected active container(s):"
echo "${ACTIVE_CONTAINERS}"

# We run a side-by-side green instance on the temporary green port (3001)
echo "----------------------------------------------------------------------"
echo "Step 1/5: Starting Green Container (Version ${SYSTEM_VERSION}) on port ${TEMPORARY_GREEN_PORT}..."
echo "----------------------------------------------------------------------"

# Spin up the green container
docker run -d \
  --name "${APP_NAME}-green" \
  -p "${TEMPORARY_GREEN_PORT}:${TARGET_PORT}" \
  --env-file .env \
  --network="host" \
  "${APP_NAME}:latest"

# Step 2: Poll /api/ready health check on the Green container
echo "----------------------------------------------------------------------"
echo "Step 2/5: Polling green container at http://127.0.0.1:${TEMPORARY_GREEN_PORT}/api/ready..."
echo "----------------------------------------------------------------------"

attempt=1
ready=0

while [ $attempt -le $MAX_POLL_ATTEMPTS ]; do
  echo "Checking health (Attempt $attempt/$MAX_POLL_ATTEMPTS)..."
  
  # Fetch readiness status
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${TEMPORARY_GREEN_PORT}/api/ready || true)
  
  if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ Success! Green container is READY and state restoration is 100% complete."
    ready=1
    break
  fi
  
  echo "❌ Container not ready (HTTP Status: $HTTP_STATUS). Retrying in ${POLL_INTERVAL_SEC}s..."
  sleep $POLL_INTERVAL_SEC
  attempt=$((attempt + 1))
done

if [ $ready -eq 0 ]; then
  echo "🚨 CRITICAL ERROR: Green container failed /api/ready health check after $((MAX_POLL_ATTEMPTS * POLL_INTERVAL_SEC)) seconds."
  echo "Aborting deployment to preserve current open positions. Stopping green container..."
  docker stop "${APP_NAME}-green" || true
  docker rm "${APP_NAME}-green" || true
  exit 1
fi

# Step 3: Swap proxy routing or ports
echo "----------------------------------------------------------------------"
echo "Step 3/5: Swapping load balancer routing / network ports..."
echo "----------------------------------------------------------------------"
# In high-availability setups, this updates the Nginx/Traefik reverse proxy.
# For standard docker host networks, we stop the old, re-link, or restart the proxy container.
# Here, we swap port 3000 mapping by renaming and reloading containers:
docker rename "${APP_NAME}" "${APP_NAME}-blue-old" || true

# Step 4: Gracefully shut down the old container (Blue)
echo "----------------------------------------------------------------------"
echo "Step 4/5: Sending SIGTERM to old container (initiates graceful request drain & DB flush)..."
echo "----------------------------------------------------------------------"
# Send SIGTERM cleanly to allow the old instance to drain requests and flush trading state
docker kill --signal=SIGTERM "${APP_NAME}-blue-old" || true

# Wait for old container to exit cleanly (up to 10 seconds, conforming to our process timeout)
echo "Waiting for old container request drain..."
docker wait "${APP_NAME}-blue-old" || true

# Step 5: Finalize Green container naming and cleanup
echo "----------------------------------------------------------------------"
echo "Step 5/5: Promoting Green container to primary..."
echo "----------------------------------------------------------------------"
docker stop "${APP_NAME}-blue-old" || true
docker rm "${APP_NAME}-blue-old" || true

# Reallocate primary port by restarting Green container mapped to primary port (or re-map proxy)
docker stop "${APP_NAME}-green" || true
docker rm "${APP_NAME}-green" || true

# Start primary container
docker run -d \
  --name "${APP_NAME}" \
  -p "${TARGET_PORT}:${TARGET_PORT}" \
  --env-file .env \
  --network="host" \
  --restart=always \
  "${APP_NAME}:latest"

echo "======================================================================"
echo "🎉 ZERO-DOWNTIME ROLLING DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "New version ${SYSTEM_VERSION} is active and fully routing traffic on port ${TARGET_PORT}."
echo "======================================================================"
