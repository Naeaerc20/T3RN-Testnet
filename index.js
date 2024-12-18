// index.js

const consoleClear = require('console-clear');
const figlet = require('figlet');
const colors = require('colors');
const inquirer = require('inquirer');
const readlineSync = require('readline-sync');
const { ethers } = require('ethers');
const { estimateFees } = require('./scripts/apis');
const chains = require('./scripts/chains');
const orderABI = require('./ABI');
const fs = require('fs');
const path = require('path');

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

/**
 * Main menu displayed to the user.
 */
const mainMenu = async () => {
  consoleClear();
  console.log(
    colors.green(
      figlet.textSync('T3RN-CLI', { horizontalLayout: 'default' })
    )
  );

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
      console.log(colors.yellow('Coming soon...'));
      await pause();
      await mainMenu();
      break;
    case 'exit':
      console.log(colors.green('Goodbye!'));
      process.exit(0);
      break;
    default:
      await mainMenu();
  }
};

/**
 * Pauses the execution until the user presses Enter.
 */
const pause = () => {
  return new Promise((resolve) => {
    readlineSync.question('Press Enter to continue...');
    resolve();
  });
};

/**
 * Bridge Assets submenu.
 */
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

/**
 * Generates a random number between min and max (inclusive).
 * @param {number} min - Minimum value.
 * @param {number} max - Maximum value.
 * @returns {number} - Random number.
 */
const getRandomGasLimit = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Performs a manual bridge operation.
 */
const manualBridge = async () => {
  consoleClear();
  console.log(colors.blue('--- Manual Bridge ---\n'));

  try {
    // Select source chain
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
    console.log(colors.green(`Selected source chain: ${fromChain}`));

    // Select destination chain
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
    console.log(colors.green(`Selected destination chain: ${toChain}`));

    // Select wallet
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
    console.log(colors.green(`Selected wallet: ${selectedWallet.wallet}`));

    // Input amount of ETH to bridge
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
    console.log(colors.green(`Amount to bridge: ${amountETH} ETH`));

    // Convert ETH to wei
    const amountWei = ethers.utils.parseEther(amountETH).toString();
    console.log(colors.green(`Converted amount: ${amountWei} wei`));

    // Get ASCII_REF of destination chain and convert to HEX
    const destinationASCII = chains[toChain].ASCII_REF;
    const destinationHEX = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(destinationASCII)).slice(0, 10); // bytes4 = 8 characters + '0x'
    console.log(colors.green(`Destination HEX (bytes4): ${destinationHEX}`));

    // Call API to estimate fees and get amount
    console.log(colors.cyan('Fetching fee estimations from API...'));
    const estimatedData = await estimateFees(amountWei, fromChain, toChain);
    if (!estimatedData) {
      console.log(colors.red('Error fetching estimations from the API.'));
      await pause();
      await bridgeMenu();
      return;
    }
    console.log(colors.green('Fee estimations received.'));

    const estimatedReceivedAmountWei = ethers.BigNumber.from(estimatedData.estimatedReceivedAmountWei.hex).toString();
    console.log(colors.green(`Estimated Received Amount (wei): ${estimatedReceivedAmountWei}`));

    // Prepare parameters for the `order` function
    const params = {
      destination: destinationHEX,
      asset: 0,
      targetAccount: ethers.utils.hexZeroPad(selectedWallet.wallet, 32),
      amount: estimatedReceivedAmountWei,
      rewardAsset: '0x0000000000000000000000000000000000000000',
      insurance: 0,
      maxReward: ethers.utils.parseEther(amountETH).toString()
    };
    console.log(colors.green('Transaction parameters prepared.'));

    // Instantiate the Router contract
    const chainConfig = chains[fromChain];
    if (!chainConfig.ROUTER) {
      console.log(colors.red(`The ROUTER address for chain ${fromChain} is not configured.`));
      await pause();
      await bridgeMenu();
      return;
    }
    console.log(colors.green(`Router address: ${chainConfig.ROUTER}`));

    const provider = new ethers.providers.JsonRpcProvider(chainConfig.RPC_URL);
    const wallet = new ethers.Wallet(selectedWallet.privateKey, provider);
    const routerContract = new ethers.Contract(chainConfig.ROUTER, orderABI, wallet);
    console.log(colors.green('Router contract instantiated.'));

    // Fetch gas fee data using fixed values
    try {
      console.log(colors.cyan('Calculating gas fees...'));
      const maxFeePerGas = ethers.utils.parseUnits('1', 'gwei'); // Use 1 gwei for maxFeePerGas
      const maxPriorityFeePerGas = ethers.utils.parseUnits('1', 'gwei'); // Use 1 gwei for maxPriorityFeePerGas

      // Generate random gasLimit between minGasLimit and maxGasLimit
      const minGasLimit = chains[fromChain].minGasLimit;
      const maxGasLimit = chains[fromChain].maxGasLimit;
      const gasLimit = getRandomGasLimit(minGasLimit, maxGasLimit);
      console.log(colors.green(`Gas Limit selected: ${gasLimit}`));

      console.log(colors.green(`Gas Fees - Max Fee Per Gas: ${ethers.utils.formatUnits(maxFeePerGas, 'gwei')} gwei, Max Priority Fee Per Gas: ${ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')} gwei`));

      // Send the transaction
      console.log(colors.cyan('Sending transaction...'));
      const tx = await routerContract.order(
        ethers.utils.hexZeroPad(params.destination, 4),
        params.asset,
        params.targetAccount,
        params.amount,
        params.rewardAsset,
        params.insurance,
        params.maxReward,
        {
          value: ethers.utils.parseEther(amountETH), // Send ETH with the transaction
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas,
          gasLimit: gasLimit
        }
      );

      // Log the bridging details
      console.log(`\nBridging Funds from ${chains[fromChain].ASCII_REF} to ${chains[toChain].ASCII_REF}`);
      console.log(`${selectedWallet.wallet} - ${amountETH} ETH`);
      console.log(`${chains[fromChain].TX_EXPLORER}/${tx.hash}`);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(`Tx Confirmed in Block Number: ${receipt.blockNumber}\n`);

    } catch (error) {
      console.error(colors.red('Error creating bridge order:', error.message));
    }

  } catch (error) {
    console.error(colors.red('An unexpected error occurred:', error.message));
  }

  // Ask the user if they want to perform another transaction
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

/**
 * Performs automatic bridge operations.
 */
const automaticBridge = async () => {
  // Implementation similar to manualBridge with adjustments for multiple transactions
  // For brevity, this can be implemented similarly by following the manualBridge structure
  console.log(colors.yellow('Automatic Bridge feature is under development.'));
  await pause();
  await bridgeMenu();
};

// Start the application
mainMenu();
