// auto_index.js

const consoleClear = require('console-clear');
const figlet = require('figlet');
const { ethers } = require('ethers');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { estimateFees } = require('./scripts/apis');
const chains = require('./scripts/chains');

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
const MIN_BRIDGE_TXS = 7; // Minimum number of transactions per wallet
const MAX_BRIDGE_TXS = 15; // Maximum number of transactions per wallet

// Utility function to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility function to generate random ETH amount between 0.105 and 0.12 with up to 5 decimals
const getRandomAmount = () => {
  const min = 0.105;
  const max = 0.12;
  const random = Math.random() * (max - min) + min;
  return parseFloat(random.toFixed(5));
};

// Function to select a destination chain different from the source chain
const selectDestinationChain = (sourceChainKey) => {
  const availableChains = Object.keys(chains).filter(chain => chain !== sourceChainKey);
  if (availableChains.length === 0) {
    throw new Error(`No available destination chains for source chain ${sourceChainKey}`);
  }
  const randomIndex = Math.floor(Math.random() * availableChains.length);
  return availableChains[randomIndex];
};

// Function to perform a single bridge transaction with error handling and retries
const performTransaction = async (wallet, sourceChainKey, destinationChainKey, amountETH, retryCount = 0) => {
  const sourceChain = chains[sourceChainKey];
  const destinationChain = chains[destinationChainKey];

  const amountWei = ethers.utils.parseEther(amountETH.toString()).toString();
  const destinationASCII = destinationChain.ASCII_REF;
  const destinationHEX = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(destinationASCII)).slice(0, 10);

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

  const provider = new ethers.providers.JsonRpcProvider(sourceChain.RPC_URL);
  const walletObj = new ethers.Wallet(wallet.privateKey, provider);
  const routerContract = new ethers.Contract(sourceChain.ROUTER, require('./ABI'), walletObj);

  try {
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
        maxFeePerGas: ethers.utils.parseUnits('1', 'gwei'),
        maxPriorityFeePerGas: ethers.utils.parseUnits('1', 'gwei'),
        gasLimit: Math.floor(Math.random() * (sourceChain.maxGasLimit - sourceChain.minGasLimit + 1)) + sourceChain.minGasLimit
      }
    );

    console.log(colors.green(`Performing Bridge from [${sourceChain.ASCII_REF}] to [${destinationChain.ASCII_REF}]`));
    console.log(colors.green(`Tx Amount: [${amountETH}] ETH`));
    const txExplorer = sourceChain.TX_EXPLORER;
    const txUrl = `${txExplorer}/${tx.hash}`;
    console.log(colors.green(`Tx Hash Sent! - ${txUrl}`));

    const receipt = await tx.wait();
    console.log(colors.green(`Tx Confirmed in Block [${receipt.blockNumber}]\n`));

  } catch (error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('insufficient funds')) {
      if (retryCount < MAX_RETRIES) {
        const newAmountETH = parseFloat((amountETH * 0.95).toFixed(5));
        console.log(colors.red('INSUFFICIENT_FUNDS: Retrying with 5% less amount.'));
        await sleep(RETRY_DELAY_MS);
        await performTransaction(wallet, sourceChainKey, destinationChainKey, newAmountETH, retryCount + 1);
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

// Function to get a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to fetch balances for all chains for a given wallet
const fetchBalances = async (wallet) => {
  const balances = {};
  for (const chainKey of Object.keys(chains)) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(chains[chainKey].RPC_URL);
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

// Function to calculate maximum possible transactions based on balances
const calculateMaxTxs = (balances) => {
  let totalTxs = 0;
  const chainTxCounts = {};
  for (const [chainKey, balance] of Object.entries(balances)) {
    // Here, we assume we can do 1 transaction for each 0.1 ETH
    const txCount = Math.floor(balance / 0.1);
    chainTxCounts[chainKey] = txCount;
    totalTxs += txCount;
  }
  return { totalTxs, chainTxCounts };
};

// Function to assign transactions based on random bridgeTxs within the limits of balances
const assignRandomTxs = (chainTxCounts) => {
  const assignedTxs = {};
  for (const [chainKey, count] of Object.entries(chainTxCounts)) {
    if (count > 0) {
      // Generate a random number of transactions within the specified min/max, but not exceeding the chain’s count
      const txCount = getRandomInt(MIN_BRIDGE_TXS, MAX_BRIDGE_TXS);
      assignedTxs[chainKey] = Math.min(txCount, count);
    } else {
      assignedTxs[chainKey] = 0;
    }
  }
  return assignedTxs;
};

// Function to process a single wallet
const processWallet = async (wallet, useRandomTxs) => {
  if (useRandomTxs) {
    // Assign a random number of transactions within balance limits
    console.log(colors.magenta(`Starting bridge Workflow for Wallet [${wallet.wallet}]`));
    const balances = await fetchBalances(wallet);
    const { totalTxs, chainTxCounts } = calculateMaxTxs(balances);

    if (totalTxs === 0) {
      console.log(colors.green(`Completed transactions for wallet: ${wallet.wallet}\n`));
      return;
    }

    const randomTxs = getRandomInt(MIN_BRIDGE_TXS, MAX_BRIDGE_TXS);
    const assignedTxCount = Math.min(randomTxs, totalTxs);
    console.log(colors.yellow(`Total transactions able to Perform: [${assignedTxCount}]\n`));

    // Assign transactions per chain based on available transactions
    const assignedTxsPerChain = assignRandomTxs(chainTxCounts);

    // Execute assigned transactions
    for (const [sourceChainKey, txCount] of Object.entries(assignedTxsPerChain)) {
      for (let txIndex = 0; txIndex < txCount; txIndex++) {
        try {
          const destinationChainKey = selectDestinationChain(sourceChainKey);
          const amountETH = getRandomAmount();
          console.log(colors.magenta(`Starting transaction ${txIndex + 1} for wallet [${wallet.wallet}] on chain [${sourceChainKey}]`));
          await performTransaction(wallet, sourceChainKey, destinationChainKey, amountETH);
        } catch (error) {
          console.error(colors.red(`Error during transaction for wallet [${wallet.wallet}]:`, error.message));
        }
        // Wait for 1 minute before the next transaction
        await sleep(60000);
      }
    }

    console.log(colors.green(`Completed transactions for wallet: ${wallet.wallet}\n`));
  } else {
    // Standard processing based on balances
    console.log(colors.magenta(`Starting bridge Workflow for Wallet [${wallet.wallet}]`));

    // Fetch balances for all chains
    const balances = await fetchBalances(wallet);
    // Determine number of possible transactions per chain
    const { totalTxs, chainTxCounts } = calculateMaxTxs(balances);

    console.log(colors.yellow(`Total transactions able to Perform: [${totalTxs}]\n`));

    if (totalTxs === 0) {
      console.log(colors.green(`Completed transactions for wallet: ${wallet.wallet}\n`));
      return;
    }

    // Create a list of transactions to perform
    const transactions = [];
    for (const [sourceChainKey, count] of Object.entries(chainTxCounts)) {
      for (let i = 0; i < count; i++) {
        const destinationChainKey = selectDestinationChain(sourceChainKey);
        const amountETH = getRandomAmount();
        transactions.push({ sourceChainKey, destinationChainKey, amountETH });
      }
    }

    // Execute each transaction
    for (const tx of transactions) {
      if (tx.sourceChainKey === tx.destinationChainKey) {
        continue;
      }
      await performTransaction(wallet, tx.sourceChainKey, tx.destinationChainKey, tx.amountETH);
      // Wait for 10 seconds before next transaction
      await sleep(10000);
    }

    console.log(colors.green(`Completed transactions for wallet: ${wallet.wallet}\n`));
  }
};

// --- New function to check if the current time (UTC) is between 1:00 AM and 10:00 AM
const isRestingTime = () => {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  // Return true if current UTC hour is >= 1 and < 10
  return hourUTC >= 1 && hourUTC < 10;
};

// Main function to handle automatic bridging
const autoBridge = async () => {
  consoleClear();
  console.log(
    colors.green(
      figlet.textSync('AUTO BRIDGE', { horizontalLayout: 'default' })
    )
  );
  console.log(colors.yellow('👑 Script created by Naeaex'));
  console.log(colors.yellow('🔐 Follow me for more scripts like this - www.github.com/Naeaerc20 - www.x.com/naeaexeth\n'));
  console.log('');

  // Initial prompts
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useRandomTxs',
      message: 'Do you want to use a random number of transactions per wallet (min and max bridgeTxs)?',
      default: false
    },
    {
      type: 'confirm',
      name: 'useBatches',
      message: 'Do you want to process wallets in batches of 10?',
      default: false
    },
    {
      type: 'confirm',
      name: 'useRestingTime',
      message: 'Do you want to use Resting Time (1:00 AM - 10:00 AM UTC)?',
      default: false
    }
  ]);

  const { useRandomTxs, useBatches, useRestingTime } = answers;

  // Start infinite cycle
  while (true) {

    // --- If resting time is enabled, check if we are within 1:00 AM - 10:00 AM UTC
    if (useRestingTime) {
      while (isRestingTime()) {
        console.log(colors.yellow('We are in the resting time (1:00 AM - 10:00 AM UTC). Sleeping for 30 minutes...'));
        await sleep(30 * 60 * 1000); // 30 minutes
      }
    }

    // --- Perform the bridging logic
    if (useBatches) {
      // Process wallets in batches of 10
      for (let i = 0; i < wallets.length; i += 10) {
        const batch = wallets.slice(i, i + 10);
        console.log(colors.blue(`Processing batch of wallets ${i + 1} to ${i + batch.length}`));

        // Process all wallets in the batch concurrently
        const walletPromises = batch.map(wallet => processWallet(wallet, useRandomTxs));

        // Use Promise.allSettled to handle all promises without failing on the first rejection
        const results = await Promise.allSettled(walletPromises);

        // Handle results
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            console.log(colors.green(`Wallet [${batch[index].wallet}] processed successfully.`));
          } else {
            console.log(colors.red(`Wallet [${batch[index].wallet}] encountered an error: ${result.reason}`));
          }
        });
      }
    } else {
      // Processing all wallets at once
      const walletPromises = wallets.map(wallet => processWallet(wallet, useRandomTxs));
      const results = await Promise.allSettled(walletPromises);

      // Handle results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(colors.green(`Wallet [${wallets[index].wallet}] processed successfully.`));
        } else {
          console.log(colors.red(`Wallet [${wallets[index].wallet}] encountered an error: ${result.reason}`));
        }
      });
    }

    // --- After finishing this "round" of transactions for ALL wallets,
    //     we rest for a random time between 5 and 10 minutes before starting again.
    const randomRest = getRandomInt(5, 10) * 60 * 1000; // random minutes between 5-10
    console.log(colors.yellow(`Finished a round of transactions. Waiting ${randomRest / 60000} minutes before the next round.\n`));
    await sleep(randomRest);
  }
};

autoBridge();
