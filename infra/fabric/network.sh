#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Veritas — Hyperledger Fabric Network Bootstrap Script
# Author: Muhammad Mujahid (github.com/Mujahidaryan)
#
# Usage:
#   chmod +x infra/fabric/network.sh
#   ./infra/fabric/network.sh up        # Start network
#   ./infra/fabric/network.sh down      # Stop network
#   ./infra/fabric/network.sh deploy-cc # Deploy chaincode
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHANNEL_NAME="veritas-channel"
CHAINCODE_NAME="document-registry"
CHAINCODE_PATH="${SCRIPT_DIR}/../../contracts/document-registry"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE="1"

# Check Fabric binaries
if ! command -v peer &> /dev/null; then
  echo "❌ Fabric binaries not found. Download from:"
  echo "   https://hyperledger-fabric.readthedocs.io/en/latest/install.html"
  exit 1
fi

# ─── Generate crypto material ─────────────────────────────────────
generate_crypto() {
  echo "🔐 Generating crypto material..."
  mkdir -p "${SCRIPT_DIR}/crypto-config" "${SCRIPT_DIR}/channel-artifacts"

  cryptogen generate \
    --config="${SCRIPT_DIR}/crypto-config.yaml" \
    --output="${SCRIPT_DIR}/crypto-config"

  echo "✅ Crypto material generated"
}

# ─── Create genesis block ─────────────────────────────────────────
create_genesis() {
  echo "📦 Creating channel genesis block..."

  configtxgen \
    -profile VeritasGenesis \
    -channelID system-channel \
    -outputBlock "${SCRIPT_DIR}/channel-artifacts/genesis.block" \
    -configPath "${SCRIPT_DIR}"

  echo "✅ Genesis block created"
}

# ─── Start network ────────────────────────────────────────────────
up() {
  echo "🚀 Starting Veritas Fabric network..."
  generate_crypto
  create_genesis

  docker-compose -f "${SCRIPT_DIR}/docker-compose.fabric.yml" up -d

  echo "⏳ Waiting for peers to start..."
  sleep 5

  create_channel
  join_channel
  echo "✅ Fabric network running"
}

# ─── Create channel ───────────────────────────────────────────────
create_channel() {
  echo "📡 Creating channel: ${CHANNEL_NAME}..."

  configtxgen \
    -profile VeritasChannel \
    -outputCreateChannelTx "${SCRIPT_DIR}/channel-artifacts/channel.tx" \
    -channelID "${CHANNEL_NAME}" \
    -configPath "${SCRIPT_DIR}"

  export CORE_PEER_LOCALMSPID="VeritasMSP"
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE="${SCRIPT_DIR}/crypto-config/peerOrganizations/veritas.io/peers/peer0.veritas.io/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${SCRIPT_DIR}/crypto-config/peerOrganizations/veritas.io/users/Admin@veritas.io/msp"
  export CORE_PEER_ADDRESS=localhost:7051

  peer channel create \
    -o localhost:7050 \
    -c "${CHANNEL_NAME}" \
    -f "${SCRIPT_DIR}/channel-artifacts/channel.tx" \
    --outputBlock "${SCRIPT_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
    --tls \
    --cafile "${SCRIPT_DIR}/crypto-config/ordererOrganizations/veritas.io/orderers/orderer.veritas.io/msp/tlscacerts/tlsca.veritas.io-cert.pem"

  echo "✅ Channel created"
}

# ─── Join channel ─────────────────────────────────────────────────
join_channel() {
  echo "🔗 Joining peer to channel..."

  peer channel join \
    -b "${SCRIPT_DIR}/channel-artifacts/${CHANNEL_NAME}.block"

  echo "✅ Peer joined channel"
}

# ─── Deploy chaincode ─────────────────────────────────────────────
deploy_chaincode() {
  echo "📜 Deploying document-registry chaincode..."

  cd "${CHAINCODE_PATH}" && go mod vendor && cd -

  # Package
  peer lifecycle chaincode package "${CHAINCODE_NAME}.tar.gz" \
    --path "${CHAINCODE_PATH}" \
    --lang golang \
    --label "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

  # Install
  peer lifecycle chaincode install "${CHAINCODE_NAME}.tar.gz"

  # Get package ID
  PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" | awk '{print $3}' | tr -d ',')
  echo "Package ID: ${PACKAGE_ID}"

  # Approve
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.veritas.io \
    --tls \
    --cafile "${SCRIPT_DIR}/crypto-config/ordererOrganizations/veritas.io/orderers/orderer.veritas.io/msp/tlscacerts/tlsca.veritas.io-cert.pem" \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --package-id "${PACKAGE_ID}" \
    --sequence "${CHAINCODE_SEQUENCE}"

  # Commit
  peer lifecycle chaincode commit \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.veritas.io \
    --tls \
    --cafile "${SCRIPT_DIR}/crypto-config/ordererOrganizations/veritas.io/orderers/orderer.veritas.io/msp/tlscacerts/tlsca.veritas.io-cert.pem" \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --sequence "${CHAINCODE_SEQUENCE}"

  echo "✅ Chaincode deployed: ${CHAINCODE_NAME} v${CHAINCODE_VERSION}"
}

# ─── Stop network ─────────────────────────────────────────────────
down() {
  echo "🛑 Stopping Veritas Fabric network..."
  docker-compose -f "${SCRIPT_DIR}/docker-compose.fabric.yml" down --volumes
  rm -rf "${SCRIPT_DIR}/crypto-config" "${SCRIPT_DIR}/channel-artifacts"
  echo "✅ Network stopped and cleaned"
}

# ─── Entry point ──────────────────────────────────────────────────
case "$1" in
  up)           up ;;
  down)         down ;;
  deploy-cc)    deploy_chaincode ;;
  *)
    echo "Usage: $0 {up|down|deploy-cc}"
    exit 1
    ;;
esac
