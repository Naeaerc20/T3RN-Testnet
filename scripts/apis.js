const axios = require('axios');
const chains = require('./chains');
const { SocksProxyAgent } = require('socks-proxy-agent');

const estimateFees = async (amountWei, fromChainKey, toChainKey) => {
  const url = 'https://api.t2rn.io/estimate';
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
    return response.data;
  } catch (error) {
    return null;
  }
};

const getPublicIP = async (proxyUrl) => {
  const agent = new SocksProxyAgent(proxyUrl);
  const response = await axios.get('https://api.ipify.org?format=json', {
    httpAgent: agent,
    httpsAgent: agent,
    timeout: 15000
  });
  return response.data.ip;
};

const getEarnedPoints = async (walletAddress, proxyUrl = null) => {
  const url = `https://pricer.t1rn.io/user/brn/balance?account=${walletAddress}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  };
  const config = { headers, timeout: 15000 };
  if (proxyUrl) {
    const agent = new SocksProxyAgent(proxyUrl);
    config.httpAgent = agent;
    config.httpsAgent = agent;
  }
  try {
    const response = await axios.get(url, config);
    return response.status === 200 ? response.data : null;
  } catch (error) {
    return null;
  }
};

module.exports = {
  estimateFees,
  getEarnedPoints,
  getPublicIP
};
