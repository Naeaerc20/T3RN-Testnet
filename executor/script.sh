#!/usr/bin/env bash

# Define configuration file path (stored in the same directory as this script)
CONFIG_FILE="$(dirname "$0")/executor_config.env"

echo "🚀 Starting configuration process..."

# Function to prompt for configuration and update the config file
configure() {
  echo "🔧 Initial configuration"
  # Prompt for Private Key
  read -p "🔑 Please enter your Private Key: " USER_PRIVATE_KEY

  # Prompt for RPC endpoints choice: public or private
  read -p "Would you like to use PUBLIC or PRIVATE RPC endpoints? (public/private): " RPC_CHOICE
  if [ "$RPC_CHOICE" = "public" ] || [ "$RPC_CHOICE" = "PUBLIC" ]; then
    RPC_CHOICE="public"
    # For public endpoints, no further input is needed.
  else
    RPC_CHOICE="private"
    echo "🔧 Please enter your PRIVATE RPC endpoints (HTTPS or WSS) for each chain."
    # l2rn always uses the default endpoint, so we do not ask for it.
    read -p "Arbitrum Sepolia (arbt) endpoint: " RPC_ARBT
    read -p "Base Sepolia (bast) endpoint: " RPC_BAST
    read -p "Optimism Sepolia (opst) endpoint: " RPC_OPST
    read -p "Unichain Sepolia (unit) endpoint: " RPC_UNIT
  fi

  # Write configuration to the config file
  cat <<EOF > "$CONFIG_FILE"
# Executor configuration file
PRIVATE_KEY_LOCAL="$USER_PRIVATE_KEY"
RPC_CHOICE="$RPC_CHOICE"
EOF

  if [ "$RPC_CHOICE" = "private" ]; then
    cat <<EOF >> "$CONFIG_FILE"
RPC_ARBT="$RPC_ARBT"
RPC_BAST="$RPC_BAST"
RPC_OPST="$RPC_OPST"
RPC_UNIT="$RPC_UNIT"
EOF
  fi

  echo "✅ Configuration saved to $CONFIG_FILE"
}

# Check if configuration file exists
if [ -f "$CONFIG_FILE" ]; then
  echo "📝 Existing configuration found."
  source "$CONFIG_FILE"
  read -p "Do you want to update your configuration? (y/n): " update_config
  if [[ "$update_config" =~ ^[Yy]$ ]]; then
    configure
    source "$CONFIG_FILE"
  else
    echo "✅ Using existing configuration."
  fi
else
  echo "❗ No configuration found. Creating a new one."
  configure
  source "$CONFIG_FILE"
fi

#######################################
# Remove old executor folder and tar.gz files
#######################################
echo "🧹 Removing old executor folders and tar.gz files..."
sudo rm -rf executor
sudo rm -rf executor-linux-*.tar.gz

#######################################
# Download executor-linux
#######################################
read -p "Do you wish to use custom executor version? (yes/no): " CUSTOM_VERSION_CHOICE
if [[ "$CUSTOM_VERSION_CHOICE" == "yes" ]]; then
  read -p "Enter the custom version (e.g. 0.53.0): " CUSTOM_VERSION
  echo "⬇️ Downloading executor-linux version v${CUSTOM_VERSION}..."
  wget https://github.com/t3rn/executor-release/releases/download/v${CUSTOM_VERSION}/executor-linux-v${CUSTOM_VERSION}.tar.gz
else
  echo "⬇️ Downloading executor-linux latest version..."
  curl -s https://api.github.com/repos/t3rn/executor-release/releases/latest | \
  grep -Po '"tag_name": "\K.*?(?=")' | \
  xargs -I {} wget https://github.com/t3rn/executor-release/releases/download/{}/executor-linux-{}.tar.gz
fi

#######################################
# Extract the downloaded tar.gz
#######################################
echo "📦 Extracting downloaded files..."
tar -xzf executor-linux-*.tar.gz

#######################################
# Enter the bin folder
#######################################
echo "🔍 Entering the executor bin folder..."
cd executor/executor/bin || { echo "❌ Error: Unable to enter the bin folder"; exit 1; }

#######################################
# Set ENABLED_NETWORKS (note the updated order)
#######################################
echo "⚙️ Configuring enabled networks..."
export ENABLED_NETWORKS='arbitrum-sepolia,base-sepolia,optimism-sepolia,unichain-sepolia,l2rn'

#######################################
# Set RPC endpoints based on configuration
#######################################
echo "🔧 Setting up RPC endpoints..."
if [ "$RPC_CHOICE" = "public" ]; then
  export RPC_ENDPOINTS='{
    "l2rn": ["https://b2n.rpc.caldera.xyz/http"],
    "arbt": ["https://arbitrum-sepolia.drpc.org", "https://sepolia-rollup.arbitrum.io/rpc"],
    "bast": ["https://base-sepolia-rpc.publicnode.com", "https://base-sepolia.drpc.org"],
    "opst": ["https://sepolia.optimism.io", "https://optimism-sepolia.drpc.org"],
    "unit": ["https://unichain-sepolia.drpc.org", "https://sepolia.unichain.org"]
  }'
else
  export RPC_ENDPOINTS="{
    \"l2rn\": [\"https://b2n.rpc.caldera.xyz/http\"],
    \"arbt\": [\"$RPC_ARBT\"],
    \"bast\": [\"$RPC_BAST\"],
    \"opst\": [\"$RPC_OPST\"],
    \"unit\": [\"$RPC_UNIT\"]
  }"
fi

#######################################
# Export remaining environment variables
#######################################
echo "🚀 Exporting additional environment variables..."
export ENVIRONMENT="testnet"
export LOG_LEVEL="debug"
export LOG_PRETTY="false"
export EXECUTOR_PROCESS_BIDS_ENABLED="true"
export EXECUTOR_PROCESS_ORDERS_ENABLED="true"
export EXECUTOR_PROCESS_CLAIMS_ENABLED="true"
export EXECUTOR_MAX_L3_GAS_PRICE="100"
export EXECUTOR_PROCESS_PENDING_ORDERS_FROM_API="false"
export EXECUTOR_PROCESS_ORDERS_ENABLED_API="false"

echo "✅ Environment variables configured:"
echo "   • ENVIRONMENT=$ENVIRONMENT"
echo "   • LOG_LEVEL=$LOG_LEVEL"
echo "   • LOG_PRETTY=$LOG_PRETTY"
echo "   • EXECUTOR_PROCESS_BIDS_ENABLED=$EXECUTOR_PROCESS_BIDS_ENABLED"
echo "   • EXECUTOR_PROCESS_ORDERS_ENABLED=$EXECUTOR_PROCESS_ORDERS_ENABLED"
echo "   • EXECUTOR_PROCESS_CLAIMS_ENABLED=$EXECUTOR_PROCESS_CLAIMS_ENABLED"
echo "   • EXECUTOR_MAX_L3_GAS_PRICE=$EXECUTOR_MAX_L3_GAS_PRICE"
echo "   • EXECUTOR_PROCESS_PENDING_ORDERS_FROM_API=$EXECUTOR_PROCESS_PENDING_ORDERS_FROM_API"
echo "   • EXECUTOR_PROCESS_ORDERS_ENABLED_API=$EXECUTOR_PROCESS_ORDERS_ENABLED_API"

# Set the PRIVATE_KEY_LOCAL environment variable using the stored key
export PRIVATE_KEY_LOCAL="$PRIVATE_KEY_LOCAL"

#######################################
# Run the Executor
#######################################
echo "🚀 Starting the Executor..."
./executor
