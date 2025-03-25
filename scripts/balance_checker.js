#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const colors = require('colors');
require('console-clear')();

const chains = require('./chains.js');
const walletsPath = path.join(__dirname, 'wallets.json');

async function main() {
  let wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
  if (!Array.isArray(wallets)) wallets = [wallets];

  for (const wallet of wallets) {
    console.log(`\n💼 Wallet [${wallet.address}] Currently Has Following Balances:\n`.blue);
    for (const key in chains) {
      const chain = chains[key];
      try {
        const provider = new ethers.providers.JsonRpcProvider(chain.RPC_URL, chain.CHAIN_ID);
        const balanceBN = await provider.getBalance(wallet.address);
        const balance = ethers.utils.formatEther(balanceBN);
        console.log(`🔗 Chain: [${chain.ASCII_REF}] - Balance: [${balance}] ETH`);
      } catch (error) {
        console.error(`❌ Error retrieving balance on ${chain.ASCII_REF} for wallet ${wallet.address}: ${error.message}`);
      }
    }
  }
}

main();
