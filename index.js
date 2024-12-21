// index.js

const consoleClear = require('console-clear');
const figlet = require('figlet');
const colors = require('colors');
const inquirer = require('inquirer');
const readlineSync = require('readline-sync');
const { ethers } = require('ethers');
const { estimateFees, getEarnedPoints, getPublicIP } = require('./scripts/apis');
const chains = require('./scripts/chains');
const orderABI = require('./ABI');
const fs = require('fs');
const path = require('path');

// Read wallets
const walletsPath = path.join(__dirname, 'wallets.json');
let wallets = [];
try {
  const data = fs.readFileSync(walletsPath, 'utf8');
  wallets = JSON.parse(data);
} catch (error) {
  console.error(colors.red('Error reading wallets.json:', error.message));
  process.exit(1);
}

// --- Read proxies from proxies.txt (if it exists) ---
let proxies = [];
const proxiesPath = path.join(__dirname, 'proxies.txt');
if (fs.existsSync(proxiesPath)) {
  try {
    const proxyFileData = fs.readFileSync(proxiesPath, 'utf8');
    // Split by line and remove empty lines
    proxies = proxyFileData.split('\n').map(line => line.trim()).filter(Boolean);
  } catch (err) {
    console.error(colors.red('Error reading proxies.txt:', err.message));
  }
}

// Main menu
const mainMenu = async () => {
  consoleClear();
  console.log(
    colors.green(
      figlet.textSync('T3RN-CLI', { horizontalLayout: 'default' })
    )
  );
  console.log(colors.yellow('👑 Script created by Naeaex'));
  console.log(colors.yellow('🔐 Follow me for more Scripts like this - www.github.com/Naeaerc20 - www.x.com/naeaexeth\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'mainOption',
      message: 'Select an option:',
      choices: [
        { name: '1. Bridge Assets', value: 'bridge' },
        { name: '2. Check User Points', value: 'points' },
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
    case 'exit':
      console.log(colors.green('Goodbye!'));
      process.exit(0);
      break;
    default:
      await mainMenu();
  }
};

const pause = () => {
  return new Promise((resolve) => {
    readlineSync.question('Press Enter to continue...');
    resolve();
  });
};

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

const getRandomGasLimit = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const formatBalance = (balanceWei) => {
  const balanceEth = ethers.utils.formatEther(balanceWei);
  return parseFloat(balanceEth).toFixed(4);
};

const manualBridge = async () => {
  consoleClear();
  console.log(colors.blue('--- Manual Bridge ---\n'));

  try {
    // List wallets to pick from
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

    // Fetch balances from some chains
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

    // From chain
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

    // To chain
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

    // Input amount
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

    const amountWei = ethers.utils.parseEther(amountETH).toString();
    console.log(colors.green(`Converted amount: ${amountWei} wei`));

    // Prepare destination bytes4
    const destinationASCII = chains[toChain].ASCII_REF;
    const destinationHEX = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(destinationASCII)).slice(0, 10);
    console.log(colors.green(`Destination HEX (bytes4): ${destinationHEX}`));

    // Estimate fees from API
    const estimatedData = await estimateFees(amountWei, fromChain, toChain);
    if (!estimatedData) {
      console.log(colors.red('Error fetching estimations from the API.'));
      await pause();
      await bridgeMenu();
      return;
    }

    const estimatedReceivedAmountWei = ethers.BigNumber.from(estimatedData.estimatedReceivedAmountWei.hex).toString();
    console.log(colors.green(`Estimated Received Amount (wei): ${estimatedReceivedAmountWei}\n`));

    const params = {
      destination: destinationHEX,
      asset: 0,
      targetAccount: ethers.utils.hexZeroPad(selectedWallet.wallet, 32),
      amount: estimatedReceivedAmountWei,
      rewardAsset: '0x0000000000000000000000000000000000000000',
      insurance: 0,
      maxReward: ethers.utils.parseEther(amountETH).toString()
    };

    // Build transaction
    const chainConfig = chains[fromChain];
    if (!chainConfig.ROUTER) {
      console.log(colors.red(`The ROUTER address for chain ${fromChain} is not configured.\n`));
      await pause();
      await bridgeMenu();
      return;
    }

    const provider = new ethers.providers.JsonRpcProvider(chainConfig.RPC_URL);
    const walletObj = new ethers.Wallet(selectedWallet.privateKey, provider);
    const routerContract = new ethers.Contract(chainConfig.ROUTER, orderABI, walletObj);

    try {
      console.log(colors.cyan('Calculating gas fees...'));
      const maxFeePerGas = ethers.utils.parseUnits('1', 'gwei');
      const maxPriorityFeePerGas = ethers.utils.parseUnits('1', 'gwei');

      const minGasLimit = chains[fromChain].minGasLimit;
      const maxGasLimit = chains[fromChain].maxGasLimit;
      const gasLimit = getRandomGasLimit(minGasLimit, maxGasLimit);
      console.log(colors.green(`Gas Limit: ${gasLimit}`));

      console.log(colors.green(`Gas Fees - Max Fee Per Gas: ${ethers.utils.formatUnits(maxFeePerGas, 'gwei')} gwei, Max Priority Fee Per Gas: ${ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')} gwei\n`));

      console.log(colors.cyan('Sending Transaction...\n'));

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
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas,
          gasLimit: gasLimit
        }
      );

      const txExplorer = chains[fromChain].TX_EXPLORER;
      const txUrl = `${txExplorer}/${tx.hash}`;

      console.log(`Bridging Funds from ${chains[fromChain].ASCII_REF} to ${chains[toChain].ASCII_REF}`);
      console.log(`${selectedWallet.wallet} - ${amountETH} ETH`);
      console.log(`${txUrl}`);

      const receipt = await tx.wait();
      console.log(`Tx Confirmed in Block Number: ${receipt.blockNumber}\n`);

    } catch (error) {
      console.error(colors.red('Error creating bridge order:', error.message));
    }

  } catch (error) {
    console.error(colors.red('An unexpected error occurred:', error.message));
  }

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

// --- Check User Points with optional proxy usage ---
const checkUserPoints = async () => {
  consoleClear();
  console.log(colors.blue('--- Check User Points ---\n'));

  // Prompt to use proxies or not
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

    // If using proxies, pick the first available proxy
    let proxyUrl = null;
    if (useProxies && proxies.length > 0) {
      proxyUrl = proxies.shift(); // Remove the first proxy from the list

      try {
        // Check public IP via that proxy
        const myIP = await getPublicIP(proxyUrl);
        console.log(colors.green(`Current Proxy IP: [${myIP}]`));
      } catch (err) {
        console.log(colors.red(`Error obtaining public IP with Proxy [${proxyUrl}]: ${err.message}`));
        console.log(colors.yellow('Proceeding anyway...\n'));
      }
    }

    // Now call getEarnedPoints with or without the proxy
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

// Automatic bridge placeholder
const automaticBridge = async () => {
  console.log(colors.yellow('Please run node auto_index.js to use this function'));
  await pause();
  await bridgeMenu();
};

mainMenu();
