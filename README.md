# T3RN CLI

Welcome to this T3RN code a tool specifically dedicated to maximizing points on the current T3RN Testnet

Spend funds from any chain to any chain, sending a minimum of 0.1ETH for each transaction. The manual version is already implemented, I will add another automated version later.

Follow me for more updates

Any donation is welcomed! via EVM - 0xd3Ca2e3346d1d19A97E28bBe91BAaee9ad70aB49

Basic facilities:
1. Clone the Repository
2. Enter the base directory
3. Run "npm install" to install the necessary packages and versions
4. Add your wallets to "wallets.json" in the written format
5. Run "node index.js" and start using the application

NOTE 1: For better performance it is highly recommended to set your own RPC URLs in the "scripts/chains.js" file  

NOTE 2: Added "strategy" directory, I discovered that if you use layerZero bridge you can bridge ETH from Arbitrum, Optimism, Ethereum Mainnet  
To Sepolia & obtain a lot of ETH, Then you can use Super Bridge to bridge your SepoliaETH to Optimism Sepolia ETH - it can make the code to run smoothly  
(layerzero bridge still under construction)...  
(superbridge available to be used).  

Edit "strategy/ABI.js" and set your on alchemy RPCs for better experience  

NOTE 3: Added optional usage of proxies for point checker - add your proxies in this form "socks5://login:pass@ip:port" in proxies.txt
