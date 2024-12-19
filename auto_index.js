// auto_index.js

const consoleClear = require('console-clear');
const figlet = require('figlet');
const { ethers } = require('ethers');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
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

// Utility function to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility function to generate random ETH amount between 0.1 and 0.12 with up to 5 decimals
const getRandomAmount = () => {
  const min = 0.1;
  const max = 0.12;
  const random = Math.random() * (max - min) + min;
  return parseFloat(random.toFixed(5));
};

// Function to select a destination chain different from the source chain
const selectDestinationChain = (sourceChainKey) => {
  const availableChains = Object.keys(chains).filter(chain => chain !== sourceChainKey);
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

  const estimatedData = await estimateFees(amountWei, sourceChainKey, destinationChainKey);
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

// Main function to handle automatic bridging
const autoBridge = async () => {
  consoleClear();
  console.log(
    colors.green(
      figlet.textSync('AUTO BRIDGE', { horizontalLayout: 'default' })
    )
  );
  console.log(colors.yellow('👑 Script created by Naeaex'));
  console.log(colors.yellow('🔐 Follow me for more Scripts like this - www.github.com/Naeaerc20 - www.x.com/naeaexeth\n'));
  console.log('');

  while (true) {
    for (const wallet of wallets) {
      console.log(colors.magenta(`Starting bridge Workflow for Wallet [${wallet.wallet}]`));

      // Fetch balances for all chains
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

      // Determine number of possible transactions per chain
      const txCounts = {};
      for (const [chainKey, balance] of Object.entries(balances)) {
        txCounts[chainKey] = Math.floor(balance / 0.1);
      }

      // Calculate total transactions
      const totalTx = Object.values(txCounts).reduce((acc, count) => acc + count, 0);
      console.log(colors.yellow(`Total transactions able to Perform: [${totalTx}]\n`));

      if (totalTx === 0) {
        console.log(colors.green(`Completed transactions for wallet: ${wallet.wallet}\n`));
        continue;
      }

      // Create a list of transactions to perform
      const transactions = [];
      for (const [sourceChainKey, count] of Object.entries(txCounts)) {
        for (let i = 0; i < count; i++) {
          const destinationChainKey = selectDestinationChain(sourceChainKey);
          const amountETH = getRandomAmount();
          transactions.push({ sourceChainKey, destinationChainKey, amountETH });
        }
      }

      for (const tx of transactions) {
        if (tx.sourceChainKey === tx.destinationChainKey) {
          continue;
        }
        await performTransaction(wallet, tx.sourceChainKey, tx.destinationChainKey, tx.amountETH);
        await sleep(10000); // Wait for 10 seconds before next transaction
      }

      console.log(colors.green(`Completed transactions for wallet: ${wallet.wallet}\n`));
    }

    console.log(colors.yellow('All wallets processed. Waiting for 5 minutes before next cycle.\n'));
    await sleep(300000); // Wait for 5 minutes before next cycle
  }
};

autoBridge();
