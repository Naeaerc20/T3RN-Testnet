process.on('SIGINT', () => {
  console.log('\nExiting...');
  process.exit();
});

const consoleClear = require('console-clear');
const figlet = require('figlet');
const colors = require('colors');
const inquirer = require('inquirer');
const readlineSync = require('readline-sync');
const { ethers } = require('ethers');
const { estimateFees } = require('./scripts/apis');
const chains = require('./scripts/chains');
const fs = require('fs');
const path = require('path');
const { orderABI } = require('./ABI');

const walletsPath = path.join(__dirname, 'scripts', 'wallets.json');
let wallets = [];
try {
  const data = fs.readFileSync(walletsPath, 'utf8');
  wallets = JSON.parse(data);
} catch (error) {
  console.error(colors.red('Error reading wallets.json:', error.message));
  process.exit(1);
}

let proxies = [];
const proxiesPath = path.join(__dirname, 'scripts', 'proxies.txt');
if (fs.existsSync(proxiesPath)) {
  try {
    const proxyFileData = fs.readFileSync(proxiesPath, 'utf8');
    proxies = proxyFileData.split('\n').map(line => line.trim()).filter(Boolean);
  } catch (err) {
    console.error(colors.red('Error reading proxies.txt:', err.message));
  }
}

const mainMenu = async () => {
  consoleClear();
  console.log(colors.green(figlet.textSync('T3RN-CLI', { horizontalLayout: 'default' })));
  console.log(colors.yellow('Script created by Naeaex'));
  console.log(colors.yellow('Follow me for more Scripts - www.github.com/Naeaerc20 - www.x.com/naeaexeth\n'));

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
      console.log(colors.yellow('Coming Soon...'));
      await pause();
      await mainMenu();
      break;
    case 'exit':
      console.log(colors.green('Goodbye!'));
      process.exit(0);
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
    // Display wallets by their 'id' and 'address'
    const walletChoices = wallets.map(wallet => ({
      name: `${wallet.id}. ${wallet.address}`,
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
    console.log(colors.green(`Selected wallet: ${selectedWallet.address}\n`));

    const chainsToCheck = ['bast', 'arbt', 'opst', 'unit'];
    console.log(colors.blue('Wallet Balances:'));

    // Check balances using selectedWallet.address
    const balances = await Promise.all(chainsToCheck.map(async (chainId) => {
      try {
        const rpc = chains[chainId].RPC_URL;
        if (!rpc) throw new Error('No RPC URL');
        const provider = new ethers.providers.JsonRpcProvider(rpc);
        const balanceWei = await provider.getBalance(selectedWallet.address);
        const balanceFormatted = formatBalance(balanceWei);
        return { chain: chains[chainId].ASCII_REF, balance: balanceFormatted };
      } catch (error) {
        return { chain: chains[chainId].ASCII_REF, balance: 'N/A' };
      }
    }));

    balances.forEach(({ chain, balance }) => {
      console.log(`${chain}: ${balance} ETH`);
    });
    console.log();

    const fromChainAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'fromChain',
        message: 'From which chain would you like to send funds?',
        choices: [
          { name: 'Base Sepolia - bast', value: 'bast' },
          { name: 'Arbitrum Sepolia - arbt', value: 'arbt' },
          { name: 'Optimism Sepolia - opst', value: 'opst' },
          { name: 'Unichain Sepolia - unit', value: 'unit' }
        ]
      }
    ]);

    const fromChain = fromChainAnswer.fromChain;
    console.log(colors.green(`Selected source chain: ${fromChain}\n`));

    const toChainAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'toChain',
        message: 'On which chain would you like to receive the assets?',
        choices: [
          { name: 'Base Sepolia - bast', value: 'bast' },
          { name: 'Arbitrum Sepolia - arbt', value: 'arbt' },
          { name: 'Optimism Sepolia - opst', value: 'opst' },
          { name: 'Unichain Sepolia - unit', value: 'unit' }
        ]
      }
    ]);

    const toChain = toChainAnswer.toChain;
    console.log(colors.green(`Selected destination chain: ${toChain}\n`));

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

    const destinationASCII = chains[toChain].ASCII_REF;
    const destinationHEX = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(destinationASCII)).slice(0, 10);
    console.log(colors.green(`Destination HEX (bytes4): ${destinationHEX}`));

    const estimatedData = await estimateFees(amountWei, fromChain, toChain);
    if (!estimatedData) {
      console.log(colors.red('Error fetching estimations from the API.'));
      await pause();
      await bridgeMenu();
      return;
    }

    const estimatedReceivedAmountWei = ethers.BigNumber.from(estimatedData.estimatedReceivedAmountWei.hex);
    console.log(colors.green(`Estimated Received Amount (wei): ${estimatedReceivedAmountWei.toString()}\n`));

    // Build params using selectedWallet.address
    const params = {
      destination: destinationHEX,
      asset: 0,
      targetAccount: ethers.utils.hexZeroPad(selectedWallet.address, 32),
      amount: estimatedReceivedAmountWei,
      rewardAsset: '0x0000000000000000000000000000000000000000',
      insurance: 0,
      maxReward: ethers.utils.parseEther(amountETH)
    };

    const chainConfig = chains[fromChain];
    if (!chainConfig.ROUTER) {
      console.log(colors.red(`The ROUTER address for chain ${fromChain} is not configured.`));
      await pause();
      await bridgeMenu();
      return;
    }

    const provider = new ethers.providers.JsonRpcProvider(chainConfig.RPC_URL);
    // Use selectedWallet.privateKey
    const walletObj = new ethers.Wallet(selectedWallet.privateKey, provider);
    const routerContract = new ethers.Contract(chainConfig.ROUTER, orderABI, walletObj);

    try {
      console.log(colors.cyan('Getting fee data...'));
      const feeData = await provider.getFeeData();
      let baseFee = feeData.lastBaseFeePerGas || feeData.maxFeePerGas;
      if (!baseFee) {
        baseFee = ethers.utils.parseUnits('1', 'gwei');
      }
      const add25 = baseFee.mul(25).div(100);
      const maxFeePerGas = baseFee.add(add25);
      const maxPriorityFeePerGas = maxFeePerGas;

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
          { value: ethers.utils.parseEther(amountETH) }
        );
        gasLimit = estimatedGas.mul(110).div(100);
      } catch (error) {
        console.log(colors.yellow('Gas estimation failed. Using fallback random gas limit.'));
        gasLimit = getRandomGasLimit(chainConfig.minGasLimit, chainConfig.maxGasLimit);
      }

      console.log(colors.green(`Gas Limit: ${gasLimit.toString()}`));
      console.log(colors.green(`Base Fee: ${baseFee.toString()}`));
      console.log(colors.green(`maxFeePerGas: ${maxFeePerGas.toString()}`));
      console.log(colors.green(`maxPriorityFeePerGas: ${maxPriorityFeePerGas.toString()}`));
      console.log(colors.cyan('Sending Transaction...'));

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

      const txExplorer = chainConfig.TX_EXPLORER;
      const txUrl = `${txExplorer}/${tx.hash}`;

      console.log(`Bridging Funds from ${chains[fromChain].ASCII_REF} to ${chains[toChain].ASCII_REF}`);
      console.log(`${selectedWallet.address} - ${amountETH} ETH`);
      console.log(txUrl);

      const receipt = await tx.wait();
      console.log(`Tx Confirmed in Block Number: ${receipt.blockNumber}`);
    } catch (error) {
      console.error(colors.red('Error creating bridge order:', error.message));
    }
  } catch (error) {
    console.error(colors.red('An unexpected error occurred:', error.message));
  }

  const continueAnswer = await inquirer.prompt([
    { type: 'confirm', name: 'continue', message: 'Do you wish to perform another transaction?', default: false }
  ]);
  if (continueAnswer.continue) {
    await bridgeMenu();
  } else {
    await mainMenu();
  }
};

const automaticBridge = async () => {
  console.log(colors.yellow('Please run "npm run auto" to use the automatic bridging function.'));
  await pause();
  await bridgeMenu();
};

mainMenu();
