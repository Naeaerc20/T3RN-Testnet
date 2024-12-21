// scripts/apis.js

const axios = require('axios');
const chains = require('./chains');
const { SocksProxyAgent } = require('socks-proxy-agent');

/**
 * Estimate bridging fees
 */
const estimateFees = async (amountWei, fromChainKey, toChainKey) => {
  const url = 'https://pricer.t1rn.io/estimate';

  const fromChain = chains[fromChainKey].ASCII_REF;
  const toChain = chains[toChainKey].ASCII_REF;

  const payload = {
    amountWei: amountWei,
    executorTipUSD: 0,
    fromAsset: "eth",
    fromChain: fromChain,
    overpayOptionPercentage: 0,
    spreadOptionPercentage: 0,
    toAsset: "eth",
    toChain: toChain
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(url, payload, { headers });

    if (response.status === 200) {
      return response.data;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
};

/**
 * Get public IP using a given SOCKS5 proxy (used for debugging/verification)
 */
const getPublicIP = async (proxyUrl) => {
  const agent = new SocksProxyAgent(proxyUrl);

  // We use "api.ipify.org" to get the public IP in JSON format
  const response = await axios.get('https://api.ipify.org?format=json', {
    httpAgent: agent,
    httpsAgent: agent,
    timeout: 15000,  // 15 seconds
  });
  return response.data.ip;
};

/**
 * Get the earned BRN points for a wallet.  
 * If `proxyUrl` is provided, it will route the request through that proxy.
 */
const getEarnedPoints = async (walletAddress, proxyUrl = null) => {
  const url = `https://pricer.t1rn.io/user/brn/balance?account=${walletAddress}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  };

  // Build axios config
  const config = {
    headers,
    timeout: 15000 // 15 seconds
  };

  // If a proxy is provided, set it up
  if (proxyUrl) {
    const agent = new SocksProxyAgent(proxyUrl);
    config.httpAgent = agent;
    config.httpsAgent = agent;
  }

  try {
    const response = await axios.get(url, config);
    if (response.status === 200) {
      return response.data;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
};

module.exports = { estimateFees, getEarnedPoints, getPublicIP };
