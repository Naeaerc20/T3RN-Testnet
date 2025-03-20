#!/usr/bin/env bash

# 1. Prompt for the Private Key
read -p "Please enter your Private Key: " USER_PRIVATE_KEY

# 2. Remove old executor folder and tar.gz files
sudo rm -rf executor
sudo rm -rf executor-linux-*.tar.gz

# 3. Download the latest version of executor-linux
curl -s https://api.github.com/repos/t3rn/executor-release/releases/latest | \
grep -Po '"tag_name": "\K.*?(?=")' | \
xargs -I {} wget https://github.com/t3rn/executor-release/releases/download/{}/executor-linux-{}.tar.gz

# 4. Extract the downloaded tar.gz
tar -xzf executor-linux-*.tar.gz

# 5. Enter the bin folder
cd executor/executor/bin || exit 1

# 6. Export environment variables
export ENVIRONMENT="testnet"
export LOG_LEVEL="debug"
export LOG_PRETTY="false"
export EXECUTOR_PROCESS_BIDS_ENABLED="true"
export EXECUTOR_PROCESS_ORDERS_ENABLED="true"
export EXECUTOR_PROCESS_CLAIMS_ENABLED="true"
export EXECUTOR_MAX_L3_GAS_PRICE="100"

# Set the PRIVATE_KEY_LOCAL to the user-provided key
export PRIVATE_KEY_LOCAL="$USER_PRIVATE_KEY"

export ENABLED_NETWORKS='arbitrum-sepolia,base-sepolia,optimism-sepolia,l2rn,unichain'

export RPC_ENDPOINTS='{
    "l2rn": ["https://b2n.rpc.caldera.xyz/http"],
    "arbt": ["https://arbitrum-sepolia.drpc.org", "https://sepolia-rollup.arbitrum.io/rpc"],
    "bast": ["https://base-sepolia-rpc.publicnode.com", "https://base-sepolia.drpc.org"],
    "opst": ["https://sepolia.optimism.io", "https://optimism-sepolia.drpc.org"],
    "unit": ["https://unichain-sepolia.drpc.org", "https://sepolia.unichain.org"]
}'

# 7. Run the Executor
./executor
