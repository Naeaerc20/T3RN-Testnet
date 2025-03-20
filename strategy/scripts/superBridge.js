// superBridge.js

const inquirer = require('inquirer');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const ABI = require('../ABI'); // Import configurations from ABI.js

// Function to get wallet balances in Sepolia and Optimism Sepolia
const getBalances = async (walletAddress) => {
  try {
    // Provider for Sepolia
    const sepProvider = new ethers.providers.JsonRpcProvider(ABI.SEP_RPC_URL);
    const sepBalanceWei = await sepProvider.getBalance(walletAddress);
    const sepBalanceEth = parseFloat(ethers.utils.formatEther(sepBalanceWei)).toFixed(3);

    // Provider for Optimism Sepolia
    const optSepProvider = new ethers.providers.JsonRpcProvider(ABI.OPT_SEPOLIA_RPC_URL);
    const optSepBalanceWei = await optSepProvider.getBalance(walletAddress);
    const optSepBalanceEth = parseFloat(ethers.utils.formatEther(optSepBalanceWei)).toFixed(3);

    return {
      Sepolia: sepBalanceEth,
      OptimismSepolia: optSepBalanceEth
    };
  } catch (error) {
    console.error(colors.red(`Error fetching balances: ${error.message}`));
    return {
      Sepolia: '0.000000',
      OptimismSepolia: '0.000000'
    };
  }
};

// Function to perform the bridge operation
const performBridge = async (wallet, amountETH) => {
  try {
    // Configure the wallet with Sepolia provider
    const provider = new ethers.providers.JsonRpcProvider(ABI.SEP_RPC_URL);
    const signer = new ethers.Wallet(wallet.privateKey, provider);

    // Initialize the SUPER_BRIDGE_ROUTER contract
    const superBridgeContract = new ethers.Contract(
      ABI.SUPER_BRIDGE_ROUTER,
      ABI.ABIs.superBridgeRouter,
      signer
    );

    // Prepare parameters
    const _to = wallet.wallet;
    const _minGasLimit = 200000;
    const _extraData = '0x7375706572627269646765'; // "superbridge" in hex

    // Generate a random gasLimit between 800,000 and 1,200,000
    const gasLimit = getRandomInt(800000, 1200000);

    // Transaction options
    const txOptions = {
      gasLimit: gasLimit,
      maxFeePerGas: ethers.utils.parseUnits('35', 'gwei'),
      maxPriorityFeePerGas: ethers.utils.parseUnits('35', 'gwei'),
      value: ethers.utils.parseEther(amountETH.toString())
    };

    console.log(colors.magenta(`\nWallet [${_to}] is Bridging [${amountETH}] ETH From Sepolia to Optimism Sepolia`));

    // Send the transaction
    const tx = await superBridgeContract.bridgeETHTo(_to, _minGasLimit, _extraData, txOptions);
    console.log(colors.green(`Tx Sent! - ${ABI.SEP_TX_EXPLORER}${tx.hash}`));

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log(colors.green(`Transaction Confirmed in Block Number: [${receipt.blockNumber}]\n`));
  } catch (error) {
    console.error(colors.red(`Error during bridge: ${error.message}\n`));
  }
};

// Function to generate a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Main function to handle the SuperBridge workflow
const superBridgeWorkflow = async () => {
  try {
    // Read wallets.json
    const walletsPath = path.join(__dirname, '..', '..', 'wallets.json'); // Correct path to wallets.json
    if (!fs.existsSync(walletsPath)) {
      throw new Error(`wallets.json not found at path: ${walletsPath}`);
    }
    const walletsData = fs.readFileSync(walletsPath, 'utf8');
    const wallets = JSON.parse(walletsData);

    if (wallets.length === 0) {
      console.log(colors.red('No wallets found in wallets.json.'));
      return;
    }

    // Prompt to select a wallet
    const walletAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedWallet',
        message: 'Select the wallet to use:',
        choices: wallets.map(wallet => ({
          name: `${wallet.id}. ${wallet.wallet}`,
          value: wallet
        }))
      }
    ]);

    const selectedWallet = walletAnswer.selectedWallet;

    // Fetch and display balances
    const balances = await getBalances(selectedWallet.wallet);
    console.log(colors.yellow(`\nBalances for Wallet [${selectedWallet.wallet}]:`));
    console.log(colors.yellow(`- Sepolia: ${balances.Sepolia} ETH`));
    console.log(colors.yellow(`- Optimism Sepolia: ${balances.OptimismSepolia} ETH\n`));

    // Prompt to enter the amount of ETH to send
    const amountAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter the amount of ETH in Sepolia to send to Optimism Sepolia:',
        validate: (value) => {
          const valid = !isNaN(parseFloat(value)) && parseFloat(value) > 0;
          return valid || 'Please enter a valid positive number.';
        }
      }
    ]);

    const amountETH = parseFloat(amountAnswer.amount).toFixed(3);

    // Check if the wallet has enough balance
    if (parseFloat(amountETH) > parseFloat(balances.Sepolia)) {
      console.log(colors.red(`\nInsufficient Sepolia balance. Available: ${balances.Sepolia} ETH, Requested: ${amountETH} ETH\n`));
      return;
    }

    // Confirm action
    const confirmAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to bridge ${amountETH} ETH from Sepolia to Optimism Sepolia using wallet ${selectedWallet.wallet}?`,
        default: false
      }
    ]);

    if (!confirmAnswer.confirm) {
      console.log(colors.blue('Bridge operation cancelled by the user.\n'));
      return;
    }

    // Perform the bridge
    await performBridge(selectedWallet, amountETH);

  } catch (error) {
    console.error(colors.red(`An unexpected error occurred: ${error.message}`));
  }
};

// Export the main workflow function
module.exports = { superBridgeWorkflow };
