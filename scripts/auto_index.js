process.on('SIGINT', () => { console.log('Exiting...'); process.exit(); });
const consoleClear = require('console-clear');
const figlet = require('figlet');
const { ethers } = require('ethers');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const _ = require('lodash');
const { estimateFees } = require('./apis');
const chains = require('./chains');
const { orderABI } = require('../ABI');

console.log(figlet.textSync('AUTO BRIDGE', { horizontalLayout: 'default' }));
console.log(colors.green('Script created by Naeaex'));
console.log(colors.blue('Follow me for more scripts - www.github.com/Naeaerc20 - www.x.com/naeaexeth'));

const walletsPath = path.join(__dirname, 'wallets.json');
let wallets = [];
try {
  const data = fs.readFileSync(walletsPath, 'utf8');
  wallets = JSON.parse(data);
} catch (error) {
  console.error(colors.red('Error reading wallets.json:', error.message));
  process.exit(1);
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;
const MIN_BRIDGE_TXS = 12;
const MAX_BRIDGE_TXS = 20;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getRandomAmount = () => {
  const min = 1;
  const max = 1;
  const random = Math.random() * (max - min) + min;
  return parseFloat(random.toFixed(5));
};

const selectDestinationChain = (sourceChainKey, enabledChains) => {
  const availableChains = Object.keys(enabledChains).filter(chain => chain !== sourceChainKey);
  if (availableChains.length === 0) {
    throw new Error(`No available destination chains for source chain ${sourceChainKey}`);
  }
  const randomIndex = Math.floor(Math.random() * availableChains.length);
  return availableChains[randomIndex];
};

const performTransaction = async (wallet, sourceChainKey, destinationChainKey, amountETH, enabledChains, retryCount = 0) => {
  const sourceChain = enabledChains[sourceChainKey];
  const destinationChain = enabledChains[destinationChainKey];
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
    console.log(colors.red('Error fetching estimations from the API.'));
    return;
  }

  const estimatedReceivedAmountWei = ethers.BigNumber.from(estimatedData.estimatedReceivedAmountWei.hex).toString();
  const params = {
    destination: destinationHEX,
    asset: 0,
    targetAccount: ethers.utils.hexZeroPad(wallet.address, 32),
    amount: estimatedReceivedAmountWei,
    rewardAsset: '0x0000000000000000000000000000000000000000',
    insurance: 0,
    maxReward: ethers.utils.parseEther(amountETH.toString()).toString()
  };

  if (!sourceChain.ROUTER) {
    console.log(colors.red(`The ROUTER address for chain ${sourceChainKey} is not configured.`));
    return;
  }

  const provider = new ethers.providers.JsonRpcProvider(sourceChain.RPC_URL);
  const walletObj = new ethers.Wallet(wallet.privateKey, provider);
  const routerContract = new ethers.Contract(sourceChain.ROUTER, orderABI, walletObj);

  try {
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
        { value: ethers.utils.parseEther(amountETH.toString()) }
      );
      gasLimit = estimatedGas.mul(110).div(100);
    } catch (error) {
      gasLimit = Math.floor(
        Math.random() * (sourceChain.maxGasLimit - sourceChain.minGasLimit + 1)
      ) + sourceChain.minGasLimit;
    }

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

    const receipt = await tx.wait();
    console.log(colors.green(`Tx Confirmed in Block [${receipt.blockNumber}]`));
    console.log();
  } catch (error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('insufficient funds')) {
      if (retryCount < MAX_RETRIES) {
        const newAmountETH = parseFloat((amountETH * 0.95).toFixed(5));
        console.log(colors.red('INSUFFICIENT_FUNDS: Retrying with 5% less amount.'));
        await sleep(RETRY_DELAY_MS);
        await performTransaction(wallet, sourceChainKey, destinationChainKey, newAmountETH, enabledChains, retryCount + 1);
      } else {
        console.log(colors.red('INSUFFICIENT_FUNDS: Maximum retries reached.'));
      }
    } else if (errorMessage.includes('call_exception')) {
      console.log(colors.red('CALL_EXCEPTION occurred during transaction.'));
    } else {
      console.error(colors.red('Error creating bridge order:', error.message));
    }
  }
};

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const fetchBalances = async (wallet, enabledChains) => {
  const balances = {};
  for (const chainKey of Object.keys(enabledChains)) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(enabledChains[chainKey].RPC_URL);
      const balanceWei = await provider.getBalance(wallet.address);
      const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));
      balances[chainKey] = balanceEth;
    } catch (error) {
      balances[chainKey] = 0;
    }
  }
  return balances;
};

const processWallet = async (wallet, useRandomTxs, enabledChains) => {
  console.log(colors.green(`Starting bridge workflow for Wallet [${wallet.address}]`));
  const balances = await fetchBalances(wallet, enabledChains);
  const availableSourceChains = Object.keys(balances).filter(chainKey => balances[chainKey] >= 0.1);

  if (availableSourceChains.length === 0) {
    console.log(colors.blue(`No transactions can be performed for wallet: ${wallet.address}`));
    return;
  }

  let totalTxs = 0;
  for (const chainKey of availableSourceChains) {
    totalTxs += Math.floor(balances[chainKey] / 0.1);
  }

  if (useRandomTxs) {
    const randomTxs = getRandomInt(MIN_BRIDGE_TXS, MAX_BRIDGE_TXS);
    const assignedTxCount = Math.min(randomTxs, totalTxs);
    console.log(colors.green(`Total transactions able to perform: [${assignedTxCount}]`));

    for (let txIndex = 0; txIndex < assignedTxCount; txIndex++) {
      const sourceChainKey = availableSourceChains[Math.floor(Math.random() * availableSourceChains.length)];
      const destinationChainKey = selectDestinationChain(sourceChainKey, enabledChains);
      const amountETH = getRandomAmount();
      console.log(colors.green(`Transaction ${txIndex + 1} for wallet [${wallet.address}] from [${sourceChainKey}]`));
      await performTransaction(wallet, sourceChainKey, destinationChainKey, amountETH, enabledChains);
      await sleep(60000);
    }
  } else {
    console.log(colors.green(`Total transactions able to perform: [${totalTxs}]`));
    for (const sourceChainKey of availableSourceChains) {
      const count = Math.floor(balances[sourceChainKey] / 0.1);
      for (let i = 0; i < count; i++) {
        const destinationChainKey = selectDestinationChain(sourceChainKey, enabledChains);
        const amountETH = getRandomAmount();
        await performTransaction(wallet, sourceChainKey, destinationChainKey, amountETH, enabledChains);
        await sleep(10000);
      }
    }
  }

  console.log(colors.blue(`Completed transactions for wallet: ${wallet.address}`));
};

const isRestingTime = () => {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  return hourUTC >= 1 && hourUTC < 10;
};

const autoBridge = async () => {
  consoleClear();
  console.log(figlet.textSync('AUTO BRIDGE', { horizontalLayout: 'default' }));
  console.log(colors.blue('Script created by Naeaex'));
  console.log(colors.blue('Follow me for more scripts - www.github.com/Naeaerc20 - www.x.com/naeaexeth'));

  const configAnswers = await inquirer.prompt([
    { type: 'confirm', name: 'useRandomTxs', message: 'Use a random number of transactions per wallet (within min and max)?', default: false },
    { type: 'confirm', name: 'useBatches', message: 'Process wallets in batches of 10?', default: false },
    { type: 'confirm', name: 'useRestingTime', message: 'Use Resting Time (1:00 AM - 10:00 AM UTC)?', default: false }
  ]);

  const { useRandomTxs, useBatches, useRestingTime } = configAnswers;

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
  const enabledChains = _.cloneDeep(chains);

  disabledChains.forEach(chainKey => {
    delete enabledChains[chainKey];
  });

  if (Object.keys(enabledChains).length === 0) {
    console.error(colors.red('Error: All chains have been disabled. Exiting.'));
    process.exit(1);
  }

  const shuffledWallets = _.shuffle(wallets);

  console.log(colors.green(`Enabled chains: ${Object.keys(enabledChains).join(', ')}`));
  console.log(colors.green(`Disabled chains: ${disabledChains.join(', ')}`));

  while (true) {
    if (useRestingTime) {
      while (isRestingTime()) {
        console.log(colors.green('We are in the resting time (1:00 AM - 10:00 AM UTC). Sleeping for 30 minutes...'));
        await sleep(30 * 60 * 1000);
      }
    }

    if (useBatches) {
      for (let i = 0; i < shuffledWallets.length; i += 10) {
        const batch = shuffledWallets.slice(i, i + 10);
        console.log(colors.green(`Processing batch of wallets ${i + 1} to ${i + batch.length}`));
        const walletPromises = batch.map(wallet => processWallet(wallet, useRandomTxs, enabledChains));
        const results = await Promise.allSettled(walletPromises);

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            console.log(colors.green(`Wallet [${batch[index].address}] processed successfully.`));
          } else {
            console.log(colors.red(`Wallet [${batch[index].address}] encountered an error: ${result.reason}`));
          }
        });
      }
    } else {
      for (const wallet of shuffledWallets) {
        await processWallet(wallet, useRandomTxs, enabledChains);
      }
    }

    const randomRest = getRandomInt(5, 10) * 60 * 1000;
    console.log(colors.green(`Finished a round of transactions. Waiting ${randomRest / 60000} minutes before the next round.`));
    await sleep(randomRest);
  }
};

autoBridge();
