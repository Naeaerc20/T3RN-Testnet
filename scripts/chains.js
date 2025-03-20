// scripts/chains.js

const chains = {
  bast: {
    RPC_URL: 'https://base-sepolia.drpc.org',
    CHAIN_ID: 84532,
    ASCII_REF: 'bast',
    ROUTER: '0xCEE0372632a37Ba4d0499D1E2116eCff3A17d3C3',
    TX_EXPLORER: 'https://sepolia.basescan.org/tx',
    minGasLimit: 350000,
    maxGasLimit: 800000
  },
  arbt: {
    RPC_URL: 'https://arbitrum-sepolia.drpc.org',
    CHAIN_ID: 421614,
    ASCII_REF: 'arbt',
    ROUTER: '0x22B65d0B9b59af4D3Ed59F18b9Ad53f5F4908B54',
    TX_EXPLORER: 'https://sepolia.arbiscan.io/tx',
    minGasLimit: 1500000,
    maxGasLimit: 3000000
  },
  opst: {
    RPC_URL: 'https://sepolia.optimism.io',
    CHAIN_ID: 11155420,
    ASCII_REF: 'opst',
    ROUTER: '0xb6Def636914Ae60173d9007E732684a9eEDEF26E',
    TX_EXPLORER: 'https://sepolia-optimism.etherscan.io/tx',
    minGasLimit: 350000,
    maxGasLimit: 800000
  },
  unit: {
    RPC_URL: 'https://sepolia.unichain.org',
    CHAIN_ID: 1301,
    ASCII_REF: 'unit',
    ROUTER: '0x1cEAb5967E5f078Fa0FEC3DFfD0394Af1fEeBCC9',
    TX_EXPLORER: 'https://unichain-sepolia.blockscout.com/tx',
    minGasLimit: 350000,
    maxGasLimit: 800000
  }
};

module.exports = chains;
