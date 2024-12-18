// scripts/chains.js

const chains = {
  arbt: {
    RPC_URL: 'https://endpoints.omniatech.io/v1/arbitrum/sepolia/public'
    CHAIN_ID: 421614,
    ASCII_REF: 'arbt',
    ROUTER: '0x8D86c3573928CE125f9b2df59918c383aa2B514D',
    TX_EXPLORER: 'https://sepolia.arbiscan.io/tx',
    minGasLimit: 350000,
    maxGasLimit: 800000
  },
  opsp: {
    RPC_URL: 'https://endpoints.omniatech.io/v1/op/sepolia/public'
    CHAIN_ID: 11155420,
    ASCII_REF: 'opsp',
    ROUTER: '0xF221750e52aA080835d2957F2Eed0d5d7dDD8C38',
    TX_EXPLORER: 'https://sepolia-optimism.etherscan.io/tx',
    minGasLimit: 350000,
    maxGasLimit: 800000
  },
  blss: {
    RPC_URL: 'https://sepolia.blast.io'
    CHAIN_ID: 168587773,
    ASCII_REF: 'blss',
    ROUTER: '0x1D5FD4ed9bDdCCF5A74718B556E9d15743cB26A2',
    TX_EXPLORER: 'https://sepolia.blastscan.io/tx',
    minGasLimit: 350000,
    maxGasLimit: 800000
  },
  bssp: {
    RPC_URL: 'https://base-sepolia-rpc.publicnode.com'
    CHAIN_ID: 84532,
    ASCII_REF: 'bssp',
    ROUTER: '0x30A0155082629940d4bd9Cd41D6EF90876a0F1b5',
    TX_EXPLORER: 'https://sepolia.basescan.org/tx',
    minGasLimit: 350000,
    maxGasLimit: 800000
  }
};

module.exports = chains;
