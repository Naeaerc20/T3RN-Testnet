// index.js

const consoleClear = require('console-clear');
const figlet = require('figlet');
const colors = require('colors');
const inquirer = require('inquirer');
const readlineSync = require('readline-sync');
const { ethers } = require('ethers');
const {
  estimateFees,
  getEarnedPoints,
  getPublicIP,
  getPendingRefunds
} = require('./scripts/apis');
const chains = require('./scripts/chains');
const fs = require('fs');
const path = require('path');
const { orderABI, claimRefundV1BatchABI } = require('./ABI');

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

// Load proxies from proxies.txt (optional)
let proxies = [];
const proxiesPath = path.join(__dirname, 'proxies.txt');
if (fs.existsSync(proxiesPath)) {
  try {
    const proxyFileData = fs.readFileSync(proxiesPath, 'utf8');
    proxies = proxyFileData.split('\n').map(line => line.trim()).filter(Boolean);
  } catch (err) {
    console.error(colors.red('Error reading proxies.txt:', err.message));
  }
}

// Main Menu
const mainMenu = async () => {
  consoleClear();
  console.log(colors.green(figlet.textSync('T3RN-CLI', { horizontalLayout: 'default' })));
  console.log(colors.yellow('👑 Script created by Naeaex'));
  console.log(colors.yellow('🔐 Follow me for more Scripts - www.github.com/Naeaerc20 - www.x.com/naeaexeth\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'mainOption',
      message: 'Select an option:',
      choices: [
        { name: '1. Bridge Assets', value: 'bridge' },
        { name: '2. Check User Points', value: 'points' },
        { name: '3. Claim Pending Refunds', value: 'pendingRefunds' },
        { name: '0. Exit', value: 'exit' }
      ]
    }
  ]);

  switch (answers.mainOption) {
    case 'bridge':
      await bridgeMenu();
      break;
    case 'points':
      await checkUserPoints();
      break;
    case 'pendingRefunds':
      await claimPendingRefunds();
      break;
    case 'exit':
      console.log(colors.green('Goodbye!'));
      process.exit(0);
    default:
      await mainMenu();
  }
};

// Simple pause utility
const pause = () => {
  return new Promise((resolve) => {
    readlineSync.question('Press Enter to continue...');
    resolve();
  });
};

// Bridge Menu
const bridgeMenu = async () => {
  consoleClear();
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'bridgeOption',
      message: 'Select Bridge Type:',
      choices: [
        { name: '1. Manual Bridge', value: 'manual' },
        { name: '2. Automatic Bridge', value: 'automatic' },
        { name: '0. Back to Main Menu', value: 'back' }
      ]
    }
  ]);

  switch (answers.bridgeOption) {
    case 'manual':
      await manualBridge();
      break;
    case 'automatic':
      await automaticBridge();
      break;
    case 'back':
      await mainMenu();
      break;
    default:
      await bridgeMenu();
  }
};

// Utility to randomly pick a Gas Limit within a range
const getRandomGasLimit = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Utility to format Wei to ETH with 4 decimals
const formatBalance = (balanceWei) => {
  const balanceEth = ethers.utils.formatEther(balanceWei);
  return parseFloat(balanceEth).toFixed(4);
};

// Manual Bridge Option
const manualBridge = async () => {
  consoleClear();
  console.log(colors.blue('--- Manual Bridge ---\n'));

  try {
    // Prompt user to select a wallet
    const walletChoices = wallets.map(wallet => ({
      name: `${wallet.id}. ${wallet.wallet}`,
      value: wallet.id
    }));

    const walletAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletId',
        message: 'Select the ID of the wallet you want to use:',
        choices: walletChoices
      }
    ]);

    const selectedWallet = wallets.find(w => w.id === walletAnswer.walletId);
    console.log(colors.green(`Selected wallet: ${selectedWallet.wallet}\n`));

    // Show balances for specific chains
    const chainsToCheck = ['arbt', 'opsp', 'blss', 'bssp'];
    console.log(colors.blue('Wallet Balances:'));
    const balances = await Promise.all(chainsToCheck.map(async (chainId) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(chains[chainId].RPC_URL);
        const balanceWei = await provider.getBalance(selectedWallet.wallet);
        const balanceFormatted = formatBalance(balanceWei);
        return { chain: chains[chainId].ASCII_REF, balance: balanceFormatted };
      } catch (error) {
        return { chain: chains[chainId].ASCII_REF, balance: 'Error' };
      }
    }));

    balances.forEach(({ chain, balance }) => {
      console.log(`${chain}: ${balance} ETH`);
    });
    console.log();

    // Ask from which chain to send
    const fromChainAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'fromChain',
        message: 'From which chain would you like to send funds?',
        choices: [
          { name: 'ARBITRUM Sepolia - arbt', value: 'arbt' },
          { name: 'OPTIMISM Sepolia - opsp', value: 'opsp' },
          { name: 'BLAST Sepolia - blss', value: 'blss' },
          { name: 'BASE Sepolia - bssp', value: 'bssp' }
        ]
      }
    ]);

    const fromChain = fromChainAnswer.fromChain;
    console.log(colors.green(`Selected source chain: ${fromChain}\n`));

    // Ask destination chain
    const toChainAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'toChain',
        message: 'On which chain would you like to receive the assets?',
        choices: [
          { name: 'ARBITRUM Sepolia - arbt', value: 'arbt' },
          { name: 'OPTIMISM Sepolia - opsp', value: 'opsp' },
          { name: 'BLAST Sepolia - blss', value: 'blss' },
          { name: 'BASE Sepolia - bssp', value: 'bssp' }
        ]
      }
    ]);

    const toChain = toChainAnswer.toChain;
    console.log(colors.green(`Selected destination chain: ${toChain}\n`));

    // Ask how much ETH to bridge (minimum 0.1)
    let amountETH = '';
    while (true) {
      amountETH = readlineSync.question('Please enter the amount of ETH you want to bridge: ');
      const amount = parseFloat(amountETH);
      if (isNaN(amount) || amount < 0.1) {
        console.log(colors.red('The minimum amount is 0.1 ETH.'));
      } else {
        break;
      }
    }
    console.log(colors.green(`\nAmount to bridge: ${amountETH} ETH`));

    // Convert to Wei
    const amountWei = ethers.utils.parseEther(amountETH).toString();
    console.log(colors.green(`Converted amount: ${amountWei} wei`));

    // Convert destination ASCII to HEX (bytes4)
    const destinationASCII = chains[toChain].ASCII_REF;
    const destinationHEX = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(destinationASCII)).slice(0, 10);
    console.log(colors.green(`Destination HEX (bytes4): ${destinationHEX}`));

    // Estimate bridging fees from the API
    const estimatedData = await estimateFees(amountWei, fromChain, toChain);
    if (!estimatedData) {
      console.log(colors.red('Error fetching estimations from the API.'));
      await pause();
      await bridgeMenu();
      return;
    }

    const estimatedReceivedAmountWei = ethers.BigNumber.from(estimatedData.estimatedReceivedAmountWei.hex).toString();
    console.log(colors.green(`Estimated Received Amount (wei): ${estimatedReceivedAmountWei}\n`));

    // Build parameters for the "order" function
    const params = {
      destination: destinationHEX,
      asset: 0,
      targetAccount: ethers.utils.hexZeroPad(selectedWallet.wallet, 32),
      amount: estimatedReceivedAmountWei,
      rewardAsset: '0x0000000000000000000000000000000000000000',
      insurance: 0,
      maxReward: ethers.utils.parseEther(amountETH).toString()
    };

    // Check if fromChain has a router
    const chainConfig = chains[fromChain];
    if (!chainConfig.ROUTER) {
      console.log(colors.red(`The ROUTER address for chain ${fromChain} is not configured.\n`));
      await pause();
      await bridgeMenu();
      return;
    }

    // Create provider and contract
    const provider = new ethers.providers.JsonRpcProvider(chainConfig.RPC_URL);
    const walletObj = new ethers.Wallet(selectedWallet.privateKey, provider);
    const routerContract = new ethers.Contract(chainConfig.ROUTER, orderABI, walletObj);

    try {
      // Retrieve baseFee and compute +25%
      console.log(colors.cyan('Getting fee data...'));
      const feeData = await provider.getFeeData();
      let baseFee = feeData.lastBaseFeePerGas || feeData.maxFeePerGas;
      if (!baseFee) {
        // Fallback if no base fee data is available
        baseFee = ethers.utils.parseUnits('1', 'gwei');
      }
      const add25 = baseFee.mul(25).div(100);
      const maxFeePerGas = baseFee.add(add25);
      const maxPriorityFeePerGas = maxFeePerGas;

      // Attempt to estimate Gas for the order
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
            value: ethers.utils.parseEther(amountETH)
          }
        );
        // Optional small buffer (e.g., 10% extra)
        gasLimit = estimatedGas.mul(110).div(100);
      } catch (error) {
        // If estimation fails, use random gas between min and max
        console.log(colors.yellow('Gas estimation failed. Using fallback random gas limit.\n'));
        gasLimit = getRandomGasLimit(chainConfig.minGasLimit, chainConfig.maxGasLimit);
      }

      console.log(colors.green(`Gas Limit: ${gasLimit.toString()}`));
      console.log(colors.green(`Base Fee: ${baseFee.toString()}`));
      console.log(colors.green(`maxFeePerGas: ${maxFeePerGas.toString()}`));
      console.log(colors.green(`maxPriorityFeePerGas: ${maxPriorityFeePerGas.toString()}\n`));

      console.log(colors.cyan('Sending Transaction...\n'));

      // Send the transaction
      const tx = await routerContract.order(
        ethers.utils.hexZeroPad(params.destination, 4),
        params.asset,
        params.targetAccount,
        params.amount,
        params.rewardAsset,
        params.insurance,
        params.maxReward,
        {
          value: ethers.utils.parseEther(amountETH),
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit
        }
      );

      // Explorer link
      const txExplorer = chainConfig.TX_EXPLORER;
      const txUrl = `${txExplorer}/${tx.hash}`;

      console.log(`Bridging Funds from ${chains[fromChain].ASCII_REF} to ${chains[toChain].ASCII_REF}`);
      console.log(`${selectedWallet.wallet} - ${amountETH} ETH`);
      console.log(`${txUrl}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Tx Confirmed in Block Number: ${receipt.blockNumber}\n`);

    } catch (error) {
      console.error(colors.red('Error creating bridge order:', error.message));
    }

  } catch (error) {
    console.error(colors.red('An unexpected error occurred:', error.message));
  }

  // Prompt to perform another transaction
  const continueAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continue',
      message: 'Do you wish to perform another transaction?',
      default: false
    }
  ]);

  if (continueAnswer.continue) {
    await bridgeMenu();
  } else {
    await mainMenu();
  }
};

// Check user points
const checkUserPoints = async () => {
  consoleClear();
  console.log(colors.blue('--- Check User Points ---\n'));

  let useProxies = false;
  if (proxies.length > 0) {
    const proxyAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useProxies',
        message: 'Do you want to use proxies to check points?',
        default: false
      }
    ]);
    useProxies = proxyAnswer.useProxies;
  } else {
    console.log(colors.yellow('No proxies found (proxies.txt). Proceeding without proxies.\n'));
  }

  try {
    // Prompt user to select a wallet
    const walletChoices = wallets.map(wallet => ({
      name: `${wallet.id}. ${wallet.wallet}`,
      value: wallet.id
    }));

    const walletAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletId',
        message: 'Select the ID of the wallet to check points:',
        choices: walletChoices
      }
    ]);

    const selectedWallet = wallets.find(w => w.id === walletAnswer.walletId);
    const walletAddress = selectedWallet.wallet;

    // If using proxies, shift from the list
    let proxyUrl = null;
    if (useProxies && proxies.length > 0) {
      proxyUrl = proxies.shift();
      try {
        const myIP = await getPublicIP(proxyUrl);
        console.log(colors.green(`Current Proxy IP: [${myIP}]`));
      } catch (err) {
        console.log(colors.red(`Error obtaining public IP with Proxy [${proxyUrl}]: ${err.message}`));
        console.log(colors.yellow('Proceeding anyway...\n'));
      }
    }

    // Fetch earned points
    const earnedPointsData = await getEarnedPoints(walletAddress, proxyUrl);
    if (!earnedPointsData) {
      console.log(colors.red('Error fetching earned points from the API.\n'));
      await pause();
      await checkUserPoints();
      return;
    }

    const brnBalance = earnedPointsData.BRNBalance;
    console.log(colors.green(`Wallet [${walletAddress}] has earned ${brnBalance} BRN Points!\n`));

  } catch (error) {
    console.error(colors.red('An unexpected error occurred:', error.message));
  }

  // Ask if user wants to check another wallet
  const continueAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continue',
      message: 'Do you wish to check another account?',
      default: false
    }
  ]);

  if (continueAnswer.continue) {
    await checkUserPoints();
  } else {
    await mainMenu();
  }
};

// Automatic bridge is delegated to auto_index.js
const automaticBridge = async () => {
  console.log(colors.yellow('Please run node auto_index.js to use the automatic bridging function.'));
  await pause();
  await bridgeMenu();
};

// Claim pending refunds
const claimPendingRefunds = async () => {
  consoleClear();
  console.log(colors.blue('--- Claim Pending Refunds ---\n'));

  let useProxies = false;
  if (proxies.length > 0) {
    const proxyAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useProxies',
        message: 'Do you want to use proxies to claim refunds?',
        default: false
      }
    ]);
    useProxies = proxyAnswer.useProxies;
  } else {
    console.log(colors.yellow('No proxies found (proxies.txt). Proceeding without proxies.\n'));
  }

  // Prompt user to select a wallet
  const walletChoices = wallets.map(wallet => ({
    name: `${wallet.id}. ${wallet.wallet}`,
    value: wallet.id
  }));

  const walletAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'walletId',
      message: 'Select the ID of the wallet to claim refunds:',
      choices: walletChoices
    }
  ]);

  const selectedWallet = wallets.find(w => w.id === walletAnswer.walletId);
  const walletAddress = selectedWallet.wallet;

  let proxyUrl = null;
  if (useProxies && proxies.length > 0) {
    proxyUrl = proxies.shift();
    try {
      const myIP = await getPublicIP(proxyUrl);
      console.log(colors.green(`Current Proxy IP: [${myIP}]`));
    } catch (err) {
      console.log(colors.red(`Error obtaining public IP with Proxy [${proxyUrl}]: ${err.message}`));
      console.log(colors.yellow('Proceeding anyway...\n'));
    }
  }

  console.log(colors.cyan('Fetching Pending Refunds...'));
  const pendingRefunds = await getPendingRefunds(walletAddress, proxyUrl);

  if (!pendingRefunds || pendingRefunds.length === 0) {
    console.log(colors.yellow(`No Pending Refunds found for wallet [${walletAddress}].\n`));
    await pause();
    await mainMenu();
    return;
  }

  console.log(colors.green(`Wallet [${walletAddress}] has [${pendingRefunds.length}] Pending Refunds to be processed\n`));

  for (let i = 0; i < pendingRefunds.length; i++) {
    const refund = pendingRefunds[i];
    if (!refund.isRefundable) {
      console.log(colors.yellow(`Skipping Refund [${refund.id}] - isRefundable == false\n`));
      continue;
    }

    const chainKey = refund.source;
    if (!chains[chainKey]) {
      console.log(colors.red(`Chain key [${chainKey}] not found in chains.js, skipping.\n`));
      continue;
    }

    const provider = new ethers.providers.JsonRpcProvider(chains[chainKey].RPC_URL);
    const walletObj = new ethers.Wallet(selectedWallet.privateKey, provider);
    const routerContract = new ethers.Contract(chains[chainKey].ROUTER, claimRefundV1BatchABI, walletObj);

    const maxRewardWei = ethers.BigNumber.from(refund.maxReward.hex);
    const maxRewardEth = parseFloat(ethers.utils.formatEther(maxRewardWei)).toFixed(3);
    console.log(colors.cyan(`Processing Refund on [${chainKey}] worth [${maxRewardEth}] ETH`));

    const orderNonceArray = [refund.nonce];
    const rewardAssetArray = [refund.rewardAsset];
    const maxRewardArray = [maxRewardWei];
    const orderTimestampArray = [ethers.BigNumber.from(refund.orderTimestamp._hex)];

    try {
      // Try to estimate gas
      let gasLimit;
      try {
        const estimatedGas = await routerContract.estimateGas.claimRefundV1Batch(
          orderNonceArray,
          rewardAssetArray,
          maxRewardArray,
          orderTimestampArray
        );
        gasLimit = estimatedGas.mul(110).div(100);
      } catch (error) {
        console.log(colors.yellow('Gas estimation failed for claimRefundV1Batch. Using fallback random gas limit.\n'));
        gasLimit = getRandomGasLimit(500000, 900000);
      }

      // Retrieve baseFee and compute +25%
      const feeData = await provider.getFeeData();
      let baseFee = feeData.lastBaseFeePerGas || feeData.maxFeePerGas;
      if (!baseFee) {
        baseFee = ethers.utils.parseUnits("1", "gwei");
      }
      const add25 = baseFee.mul(25).div(100);
      const maxFeePerGas = baseFee.add(add25);
      const maxPriorityFeePerGas = maxFeePerGas;

      const tx = await routerContract.claimRefundV1Batch(
        orderNonceArray,
        rewardAssetArray,
        maxRewardArray,
        orderTimestampArray,
        {
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );

      const txUrl = `${chains[chainKey].TX_EXPLORER}/${tx.hash}`;
      console.log(colors.green(`Tx Hash Sent! - ${txUrl}`));

      const receipt = await tx.wait();
      console.log(colors.green(`Tx Confirmed in Block [${receipt.blockNumber}]\n`));

    } catch (error) {
      console.log(colors.red(`Error claiming refund [${refund.id}]: ${error.message}\n`));
    }
  }

  console.log(colors.green('\nAll pending refunds processed!\n'));
  await pause();
  await mainMenu();
};

// Start
mainMenu();
