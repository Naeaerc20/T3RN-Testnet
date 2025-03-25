#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ethers } = require('ethers');
const colors = require('colors');
require('console-clear')();

const walletsPath = path.join(__dirname, 'wallets.json');

async function getBalance(walletAddress) {
  const url = `https://b2n.explorer.caldera.xyz/api/v2/addresses/${walletAddress}`;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (response.status === 200) {
      const coin_balance = response.data.coin_balance;
      return ethers.utils.formatEther(coin_balance);
    } else {
      console.error(`❌ Received status code ${response.status} for wallet ${walletAddress}`);
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`⚠️  Wallet [${walletAddress}] has not generated points yet\n`);
    } else {
      console.error(`❌ Error fetching balance for wallet ${walletAddress}: ${error.message}`);
    }
    return null;
  }
}

async function main() {
  let wallets;
  try {
    wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
  } catch (err) {
    console.error("❌ Error reading wallets.json:", err);
    process.exit(1);
  }
  if (!Array.isArray(wallets)) {
    wallets = [wallets];
  }
  for (const wallet of wallets) {
    const balance = await getBalance(wallet.address);
    if (balance !== null) {
      console.log(`💼 Wallet [${wallet.address}] currently has 💰 [${balance}] BRN\n`.green);
    }
  }
}

main();
