// ABI.js

// Router Addresses
const LAYERZERO_ARB_ROUTER = "0xfcA99F4B5186D4bfBDbd2C542dcA2ecA4906BA45";
const SUPER_BRIDGE_ROUTER = "0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1";

// Method IDs
const METHOD_ID_SWAP_AND_BRIDGE = "0xae30f6ee";
const METHOD_ID_BRIDGE_ETH_TO     = "0xe11013dd";

// Quoter Address (Uniswap V3) on Arbitrum
const QUOTER_ADDRESS = "0xb27308f9f90d607463bb33ea1bebb41c27ce5ab6";

// ABI for the quoteExactInputSingle function (Corrected to 'view')
const quoterABI = [
  {
    "type": "function",
    "stateMutability": "view", // Changed from "nonpayable" to "view"
    "name": "quoteExactInputSingle",
    "inputs": [
      { "internalType": "address", "name": "tokenIn",  "type": "address" },
      { "internalType": "address", "name": "tokenOut", "type": "address" },
      { "internalType": "uint24",  "name": "fee",      "type": "uint24"  },
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
    ],
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
    ]
  }
];

// ABIs for LayerZero Router
const layerZeroRouterABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "amountIn",          "type": "uint256" },
      { "internalType": "uint256", "name": "amountOutMin",      "type": "uint256" },
      { "internalType": "uint16",  "name": "dstChainId",        "type": "uint16"  },
      { "internalType": "address", "name": "to",                "type": "address" },
      { "internalType": "address", "name": "refundAddress",     "type": "address" },
      { "internalType": "address", "name": "zroPaymentAddress", "type": "address" },
      { "internalType": "bytes",   "name": "adapterParams",     "type": "bytes" }
    ],
    "name": "swapAndBridge",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

// ABIs for SuperBridge Router
const superBridgeRouterABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_to",          "type": "address" },
      { "internalType": "uint32",  "name": "_minGasLimit", "type": "uint32"  },
      { "internalType": "bytes",   "name": "_extraData",   "type": "bytes"   }
    ],
    "name": "bridgeETHTo",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

// Chain Configurations
const ARB_RPC_URL = "SET_ALCHEMY_RPC"; // Set your own RPC here
const SEP_RPC_URL = "SET_ALCHEMY_RPC"; // Set your own RPC here

const ARB_CHAIN_ID = 42161;
const SEP_CHAIN_ID = 161; 

// Transaction Explorers
const SEP_TX_EXPLORER    = "https://sepolia.etherscan.io/tx/";
const ARB_TX_EXPLORER    = "https://arbiscan.io/tx/";

// Additional Chain Configuration for Optimism Sepolia
const OPT_SEPOLIA_RPC_URL     = "SET_ALCHEMY_RPC"; // Set your own RPC here
const OPT_SEPOLIA_CHAIN_ID   = 11155420; // 
const OPT_SEPOLIA_TX_EXPLORER= "https://optimism-sepolia.etherscan.io/tx/";

module.exports = {
  // Router Addresses
  LAYERZERO_ARB_ROUTER,
  SUPER_BRIDGE_ROUTER,

  // Method IDs
  METHOD_ID_SWAP_AND_BRIDGE,
  METHOD_ID_BRIDGE_ETH_TO,

  // Quoter
  QUOTER_ADDRESS,
  quoterABI,

  // ABIs
  ABIs: {
    layerZeroRouter: layerZeroRouterABI,
    superBridgeRouter: superBridgeRouterABI
  },

  // RPC URLs
  ARB_RPC_URL,
  SEP_RPC_URL,
  OPT_SEPOLIA_RPC_URL,

  // Chain IDs
  ARB_CHAIN_ID,
  SEP_CHAIN_ID,
  OPT_SEPOLIA_CHAIN_ID,

  // Transaction Explorers
  SEP_TX_EXPLORER,
  ARB_TX_EXPLORER,
  OPT_SEPOLIA_TX_EXPLORER
};
