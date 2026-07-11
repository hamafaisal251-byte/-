#!/usr/bin/env bash
# ============================================================================
# SOVEREIGN FX TRADING BOT (Proda/NEXUS) - Chrony Installer & Configuration
# ============================================================================
# This script automates installing and setting up the Chrony NTP time daemon
# on a Debian, Ubuntu, CentOS, or RHEL server.
#
# MUST BE RUN WITH SUDO / AS ROOT.

set -euo pipefail

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: This script must be run with root privileges (e.g., sudo ./setup-chrony.sh)." >&2
  exit 1
fi

echo "===================================================================="
echo "⏳ Initializing High-Precision Time Sync Configuration via Chrony..."
echo "===================================================================="

# Detect OS and package manager
if command -v apt-get &>/dev/null; then
  echo "📦 Debian/Ubuntu system detected. Installing chrony..."
  apt-get update -y
  apt-get install -y chrony
  
  CHRONY_CONF_DIR="/etc/chrony"
  CHRONY_SERVICE="chrony"

elif command -v yum &>/dev/null; then
  echo "📦 RedHat/CentOS system detected. Installing chrony..."
  yum install -y chrony
  
  CHRONY_CONF_DIR="/etc"
  CHRONY_SERVICE="chronyd"

else
  echo "❌ Error: Unsupported system package manager. Please install 'chrony' manually." >&2
  exit 1
fi

# Apply custom chrony.conf
if [ -f "./chrony.conf" ]; then
  echo "⚙️ Copying custom chrony.conf to ${CHRONY_CONF_DIR}/chrony.conf..."
  cp "./chrony.conf" "${CHRONY_CONF_DIR}/chrony.conf"
else
  echo "⚠️ Custom chrony.conf not found at current path. Writing a fresh configuration directly..."
  cat <<EOF > "${CHRONY_CONF_DIR}/chrony.conf"
# Custom Fallback configuration
server time.google.com iburst preferred
server time.cloudflare.com iburst
pool pool.ntp.org iburst maxsources 3
driftfile /var/lib/chrony/drift
makestep 0.01 3
rtcsync
logdir /var/log/chrony
EOF
fi

# Enable and start the service
echo "🔄 Starting Chrony NTP service and enabling startup boot hook..."
if command -v systemctl &>/dev/null; then
  systemctl daemon-reload || true
  systemctl enable "$CHRONY_SERVICE"
  systemctl restart "$CHRONY_SERVICE"
else
  service "$CHRONY_SERVICE" restart || true
fi

# Print status and verify
echo "🛡️ Verifying NTP daemon synchronization status..."
sleep 2

if command -v chronyc &>/dev/null; then
  echo "--------------------------------------------------------"
  chronyc tracking
  echo "--------------------------------------------------------"
  echo "✅ Success: High-Precision Time Sync via Chrony is fully operational!"
else
  echo "⚠️ Warning: 'chronyc' cli utility not found in standard path yet. Time-sync service started."
fi
