## T3RN-Testnet V2

Welcome to this script T3RN to handle/manage multiple account operation, random transaction execution etc.
Accurace BRN Points for future $TRN Airdrop

## Project Structure

```bash

T3RN-Testnet/
├── ABI.js                       # Main contract ABI definitions used by the CLI.
├── index.js                     # Primary CLI script for bridging assets and checking points.
├── README.md                    # Project documentation and usage instructions.
├── executor/
│   └── script.sh                # A bash Automatized Script for Instalation & Execution of Executor Node.
├── scripts/
│   ├── apis.js                  # Contains functions for API calls (e.g., fee estimation).
│   ├── auto_index.js            # Script for automatic bridging with random transactions.
│   ├── chains.js                # Configuration for various blockchain networks.
│   ├── proxies.txt              # List of proxy URLs (format: socks5://user:pass@ip:port).
│   ├── wallet_aggregator.js     # Script for aggregating and managing wallet data.
│   └── wallets.json             # JSON file storing wallet information (addresses, keys, etc.).
└── strategy/
    ├── ABI.js                   # ABI definitions specific to strategy contracts.
    ├── index.js                 # Main CLI script for executing strategy-based operations.
    └── scripts/
        ├── layerzeroBridge.js   # Script for bridging assets using the LayerZero protocol.
        └── superBridge.js       # Script for executing bridge asset transactions on Super bridge.

```

## Instructions

1. Clone Repository - "git clone https://github.com/Naeaerc20/T3RN-Testnet"
2. Open main Directory - "cd T3RN-Testnet"
3. Initialize basic app - "npm start"
4. Run random tx's - "npm run auto"
5. Add existing wallets to the script - "npm run add"
6. Check added wallets in the script - npm run show

## Executor Node

In case that you're interested in running your executor it's been created an automatized script to help you make this all in one.
Just first open a screen using "screen -S executor" then run "npm run executor" - Insert your data and save this screen.
Every time T3RN update their node, just back to the screen, stop your node and re run the script.

Promt - npm run executor


Good luck using it!
