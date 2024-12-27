// auto_index.js

const consoleClear = require('console-clear');
const figlet = require('figlet');
const { ethers } = require('ethers');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const _ = require('lodash'); // Added for utility functions
const { estimateFees } = require('./scripts/apis');
const chains = require('./scripts/chains');
const { orderABI } = require('./ABI');

// Debug: display the orderABI
console.log('orderABI:', orderABI);

// Load wallets from wallets.json
const walletsPath = path.join(__dirname, 'wallets.json');
let wallets = [];
try {
  const data = fs.readFileSync(walletsPath, 'utf8');
  wallets = JSON.parse(data);
} catch (error) {
  console.error(colors.red('Error reading wallets.json:', error.message));
  process.exit(1);
}

// Constants for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// Constants for bridge transactions
const MIN_BRIDGE_TXS = 12;  // Minimum number of transactions per wallet
const MAX_BRIDGE_TXS = 20; // Maximum number of transactions per wallet

// Utility function to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility function to generate a random ETH amount (you can adjust min/max as you wish)
const getRandomAmount = () => {
  // Example: currently forces 0.1 exactly; you can update these if you prefer 0.105-0.12, etc.
  const min = 0.1;
  const max = 0.1;
  const random = Math.random() * (max - min) + min;
  return parseFloat(random.toFixed(5));
};

// Function to choose a random destination chain different from the source
const selectDestinationChain = (sourceChainKey, enabledChains) => {
  const availableChains = Object.keys(enabledChains).filter(chain => chain !== sourceChainKey);
  if (availableChains.length === 0) {
    throw new Error(`No available destination chains for source chain ${sourceChainKey}`);
  }
  const randomIndex = Math.floor(Math.random() * availableChains.length);
  return availableChains[randomIndex];
};

// Perform a single bridge transaction with retries
const performTransaction = async (wallet, sourceChainKey, destinationChainKey, amountETH, enabledChains, retryCount = 0) => {
  const sourceChain = enabledChains[sourceChainKey];
  const destinationChain = enabledChains[destinationChainKey];

  const amountWei = ethers.utils.parseEther(amountETH.toString()).toString();
  const destinationASCII = destinationChain.ASCII_REF;
  const destinationHEX = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(destinationASCII)).slice(0, 10);

  // Estimate fees via API
  let estimatedData;
  try {
    estimatedData = await estimateFees(amountWei, sourceChainKey, destinationChainKey);
  } catch (error) {
    console.log(colors.red('Error fetching estimations from the API:', error.message));
    return;
  }

  if (!estimatedData) {
    console.log(colors.red('Error fetching estimations from the API.\n'));
    return;
  }

  const estimatedReceivedAmountWei = ethers.BigNumber.from(estimatedData.estimatedReceivedAmountWei.hex).toString();

  const params = {
    destination: destinationHEX,
    asset: 0,
    targetAccount: ethers.utils.hexZeroPad(wallet.wallet, 32),
    amount: estimatedReceivedAmountWei,
    rewardAsset: '0x0000000000000000000000000000000000000000',
    insurance: 0,
    maxReward: ethers.utils.parseEther(amountETH.toString()).toString()
  };

  if (!sourceChain.ROUTER) {
    console.log(colors.red(`The ROUTER address for chain ${sourceChainKey} is not configured.\n`));
    return;
  }

  // Create provider and contract instance
  const provider = new ethers.providers.JsonRpcProvider(sourceChain.RPC_URL);
  const walletObj = new ethers.Wallet(wallet.privateKey, provider);
  const routerContract = new ethers.Contract(sourceChain.ROUTER, orderABI, walletObj);

  try {
    // Get fee data
    const feeData = await provider.getFeeData();
    let baseFee = feeData.lastBaseFeePerGas || feeData.maxFeePerGas;
    if (!baseFee) {
      baseFee = ethers.utils.parseUnits('1', 'gwei');
    }
    // Add 25% to baseFee
    const add25 = baseFee.mul(25).div(100);
    const maxFeePerGas = baseFee.add(add25);
    const maxPriorityFeePerGas = maxFeePerGas;

    // Estimate gas
    let gasLimit;
    try {
      const estimatedGas = await routerContract.estimateGas.order(
        ethers.utils.hexZeroPad(params.destination, 4),
        params.asset,
        params.targetAccount,
        params.amount,
        params.rewardAsset,
        params.insurance,
        params.maxReward,
        {
          value: ethers.utils.parseEther(amountETH.toString())
        }
      );
      gasLimit = estimatedGas.mul(110).div(100); // 10% buffer
    } catch (error) {
      console.log(colors.yellow(`Gas estimation failed. Using fallback random gas limit.\n`));
      gasLimit = Math.floor(
        Math.random() * (sourceChain.maxGasLimit - sourceChain.minGasLimit + 1)
      ) + sourceChain.minGasLimit;
    }

    // Execute order
    const tx = await routerContract.order(
      ethers.utils.hexZeroPad(params.destination, 4),
      params.asset,
      params.targetAccount,
      params.amount,
      params.rewardAsset,
      params.insurance,
      params.maxReward,
      {
        value: ethers.utils.parseEther(amountETH.toString()),
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit
      }
    );

    console.log(colors.green(`Performing Bridge from [${sourceChain.ASCII_REF}] to [${destinationChain.ASCII_REF}]`));
    console.log(colors.green(`Tx Amount: [${amountETH}] ETH`));
    const txExplorer = sourceChain.TX_EXPLORER;
    const txUrl = `${txExplorer}/${tx.hash}`;
    console.log(colors.green(`Tx Hash Sent! - ${txUrl}`));

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(colors.green(`Tx Confirmed in Block [${receipt.blockNumber}]\n`));

  } catch (error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('insufficient funds')) {
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        const newAmountETH = parseFloat((amountETH * 0.95).toFixed(5));
        console.log(colors.red('INSUFFICIENT_FUNDS: Retrying with 5% less amount.'));
        await sleep(RETRY_DELAY_MS);
        await performTransaction(wallet, sourceChainKey, destinationChainKey, newAmountETH, enabledChains, retryCount + 1);
      } else {
        console.log(colors.red('INSUFFICIENT_FUNDS: Maximum retries reached.\n'));
      }
    } else if (errorMessage.includes('call_exception')) {
      console.log(colors.red('CALL_EXCEPTION occurred during transaction.\n'));
    } else {
      console.error(colors.red('Error creating bridge order:', error.message));
    }
  }
};

// Generate a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Fetch balances for all chains for a given wallet
const fetchBalances = async (wallet, enabledChains) => {
  const balances = {};
  for (const chainKey of Object.keys(enabledChains)) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(enabledChains[chainKey].RPC_URL);
      const balanceWei = await provider.getBalance(wallet.wallet);
      const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));
      balances[chainKey] = balanceEth;
    } catch (error) {
      console.log(colors.red(`Error fetching balance for ${chainKey}:`, error.message));
      balances[chainKey] = 0;
    }
  }
  return balances;
};

// Calculate how many transactions are possible based on balances
const calculateMaxTxs = (balances) => {
  let totalTxs = 0;
  const chainTxCounts = {};
  for (const [chainKey, balance] of Object.entries(balances)) {
    // Example: 1 transaction per 0.1 ETH
    const txCount = Math.floor(balance / 0.1);
    chainTxCounts[chainKey] = txCount;
    totalTxs += txCount;
  }
  return { totalTxs, chainTxCounts };
};

// Assign random number of transactions per chain
const assignRandomTxs = (chainTxCounts) => {
  const assignedTxs = {};
  for (const [chainKey, count] of Object.entries(chainTxCounts)) {
    if (count > 0) {
      const txCount = getRandomInt(MIN_BRIDGE_TXS, MAX_BRIDGE_TXS);
      assignedTxs[chainKey] = Math.min(txCount, count);
    } else {
      assignedTxs[chainKey] = 0;
    }
  }
  return assignedTxs;
};

// Process a single wallet
const processWallet = async (wallet, useRandomTxs, enabledChains) => {
  console.log(colors.magenta(`Starting bridge workflow for Wallet [${wallet.wallet}]`));

  // 1) Fetch balances
  const balances = await fetchBalances(wallet, enabledChains);
  // 2) Determine possible transactions
  const { totalTxs, chainTxCounts } = calculateMaxTxs(balances);

  if (totalTxs === 0) {
    console.log(colors.green(`No transactions can be performed for wallet: ${wallet.wallet}\n`));
    return;
  }

  if (useRandomTxs) {
    // Assign a random total number of transactions
    const randomTxs = getRandomInt(MIN_BRIDGE_TXS, MAX_BRIDGE_TXS);
    const assignedTxCount = Math.min(randomTxs, totalTxs);
    console.log(colors.yellow(`Total transactions able to perform: [${assignedTxCount}]\n`));

    // Distribute transactions among the chains
    const assignedTxsPerChain = assignRandomTxs(chainTxCounts);

    // Execute assigned transactions
    for (const [sourceChainKey, txCount] of Object.entries(assignedTxsPerChain)) {
      for (let txIndex = 0; txIndex < txCount; txIndex++) {
        try {
          const destinationChainKey = selectDestinationChain(sourceChainKey, enabledChains);
          const amountETH = getRandomAmount();
          console.log(colors.magenta(`Transaction ${txIndex + 1} for wallet [${wallet.wallet}] on chain [${sourceChainKey}]`));
          await performTransaction(wallet, sourceChainKey, destinationChainKey, amountETH, enabledChains);
        } catch (error) {
          console.error(colors.red(`Error during transaction for wallet [${wallet.wallet}]:`, error.message));
        }
        // Wait 1 minute before next transaction
        await sleep(60000);
      }
    }
  } else {
    // Standard processing: we just do as many txs as possible on each chain
    console.log(colors.yellow(`Total transactions able to perform: [${totalTxs}]\n`));
    const transactions = [];

    // Collect all transactions
    for (const [sourceChainKey, count] of Object.entries(chainTxCounts)) {
      for (let i = 0; i < count; i++) {
        const destinationChainKey = selectDestinationChain(sourceChainKey, enabledChains);
        const amountETH = getRandomAmount();
        transactions.push({ sourceChainKey, destinationChainKey, amountETH });
      }
    }

    // Execute sequentially
    for (const tx of transactions) {
      // Skip if source == destination
      if (tx.sourceChainKey === tx.destinationChainKey) continue;

      await performTransaction(wallet, tx.sourceChainKey, tx.destinationChainKey, tx.amountETH, enabledChains);
      // Wait 10 seconds before next transaction
      await sleep(10000);
    }
  }

  console.log(colors.green(`Completed transactions for wallet: ${wallet.wallet}\n`));
};

// Check if the current UTC time is between 1:00 AM and 10:00 AM
const isRestingTime = () => {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  // Return true if current UTC hour is >= 1 and < 10
  return hourUTC >= 1 && hourUTC < 10;
};

// Main function to handle automatic bridging
const autoBridge = async () => {
  consoleClear();
  console.log(colors.green(figlet.textSync('AUTO BRIDGE', { horizontalLayout: 'default' })));
  console.log(colors.yellow('👑 Script created by Naeaex'));
  console.log(colors.yellow('🔐 Follow me for more scripts - www.github.com/Naeaerc20 - www.x.com/naeaexeth\n'));

  // Prompt for config
  const configAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useRandomTxs',
      message: 'Use a random number of transactions per wallet (within min and max)?',
      default: false
    },
    {
      type: 'confirm',
      name: 'useBatches',
      message: 'Process wallets in batches of 10?',
      default: false
    },
    {
      type: 'confirm',
      name: 'useRestingTime',
      message: 'Use Resting Time (1:00 AM - 10:00 AM UTC)?',
      default: false
    }
  ]);

  const { useRandomTxs, useBatches, useRestingTime } = configAnswers;

  // Prompt for chains to disable
  const disableChainsAnswer = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'disabledChains',
      message: 'Select the chains you want to disable (they will neither send nor receive funds):',
      choices: Object.keys(chains),
      default: []
    }
  ]);

  const { disabledChains } = disableChainsAnswer;

  // Create a new object with enabled chains
  const enabledChains = _.cloneDeep(chains); // Clone to avoid mutating the original chains object

  disabledChains.forEach(chainKey => {
    delete enabledChains[chainKey];
  });

  // Validate that there are still chains available after disabling
  if (Object.keys(enabledChains).length === 0) {
    console.error(colors.red('Error: All chains have been disabled. Exiting.'));
    process.exit(1);
  }

  console.log(colors.green(`\nEnabled chains: ${Object.keys(enabledChains).join(', ')}`));
  console.log(colors.green(`Disabled chains: ${disabledChains.join(', ')}\n`));

  // Infinite loop
  while (true) {
    // If resting time is enabled, check the time
    if (useRestingTime) {
      while (isRestingTime()) {
        console.log(colors.yellow('We are in the resting time (1:00 AM - 10:00 AM UTC). Sleeping for 30 minutes...'));
        await sleep(30 * 60 * 1000); // 30 minutes
      }
    }

    // Perform bridging logic
    if (useBatches) {
      // Process wallets in batches of 10
      for (let i = 0; i < wallets.length; i += 10) {
        const batch = wallets.slice(i, i + 10);
        console.log(colors.blue(`Processing batch of wallets ${i + 1} to ${i + batch.length}`));

        // Process them concurrently
        const walletPromises = batch.map(wallet => processWallet(wallet, useRandomTxs, enabledChains));
        const results = await Promise.allSettled(walletPromises);

        // Check results
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            console.log(colors.green(`Wallet [${batch[index].wallet}] processed successfully.`));
          } else {
            console.log(colors.red(`Wallet [${batch[index].wallet}] encountered an error: ${result.reason}`));
          }
        });
      }
    } else {
      // Process all wallets in one pass
      const walletPromises = wallets.map(wallet => processWallet(wallet, useRandomTxs, enabledChains));
      const results = await Promise.allSettled(walletPromises);

      // Check results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(colors.green(`Wallet [${wallets[index].wallet}] processed successfully.`));
        } else {
          console.log(colors.red(`Wallet [${wallets[index].wallet}] encountered an error: ${result.reason}`));
        }
      });
    }

    // After finishing this round, wait a random time (5-10 minutes) before starting again
    const randomRest = getRandomInt(5, 10) * 60 * 1000;
    console.log(colors.yellow(`Finished a round of transactions. Waiting ${randomRest / 60000} minutes before the next round.\n`));
    await sleep(randomRest);
  }
};

autoBridge();
