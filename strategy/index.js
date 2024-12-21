// index.js

const inquirer = require('inquirer');
const colors = require('colors');
const path = require('path');
const figlet = require('figlet'); // Ensure figlet is installed
const { superBridgeWorkflow } = require('./scripts/superBridge'); // Import the function from superBridge.js

// Function to clear the console
const consoleClear = () => {
  console.clear();
};

// Function to pause until the user presses Enter
const pause = async () => {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...',
    }
  ]);
};

// Function to display the main menu
const showMenu = async () => {
  consoleClear();
  console.log(
    colors.green(
      figlet.textSync('T3RN-Testnet', { horizontalLayout: 'default' })
    )
  );
  console.log(colors.yellow('👑 Script created by Naeaex'));
  console.log(colors.yellow('🔐 Follow me for more scripts like this - www.github.com/Naeaerc20 - www.x.com/naeaexeth\n'));
  console.log('');

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'option',
      message: 'Please select an option:',
      choices: [
        { name: '1. Perform LayerZero Workflow (Coming Soon...)', value: 'layerZero' },
        { name: '2. Perform SuperBridge Workflow', value: 'superBridge' },
        { name: '3. Exit', value: 'exit' }
      ]
    }
  ]);

  switch (answers.option) {
    case 'layerZero':
      console.log(colors.blue('LayerZero Workflow is coming soon...\n'));
      await pause();
      break;
    case 'superBridge':
      await superBridgeWorkflow();
      await pause();
      break;
    case 'exit':
      console.log(colors.green('Exiting...'));
      process.exit(0);
      break;
    default:
      console.log(colors.red('Invalid option selected.'));
      await pause();
  }

  // Return to the menu after completing an action
  await showMenu();
};

// Start the menu
showMenu();
