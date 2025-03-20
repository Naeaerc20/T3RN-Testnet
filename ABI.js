// ABI.js

const orderABI = [
  {
    "type": "function",
    "name": "order",
    "stateMutability": "payable",
    "inputs": [
      { "name": "destination", "type": "bytes4" },
      { "name": "asset", "type": "uint32" },
      { "name": "targetAccount", "type": "bytes32" },
      { "name": "amount", "type": "uint256" },
      { "name": "rewardAsset", "type": "address" },
      { "name": "insurance", "type": "uint256" },
      { "name": "maxReward", "type": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "bytes32" }
    ]
  }
];

module.exports = {
  orderABI
};
