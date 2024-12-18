// scripts/apis.js
const axios = require('axios');
const chains = require('./chains');

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

module.exports = { estimateFees };
