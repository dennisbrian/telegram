const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Replace with your local API endpoint
const API_ENDPOINT = 'http://localhost:3000';
const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// Welcome message and main menu
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Choose an option:', {
    reply_markup: {
      keyboard: [['Free Dice', 'Buy Dice']],
      one_time_keyboard: true,
    },
  });
});

// Handling user commands
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  switch (text) {
    case 'Free Dice':
      showFreeDiceMenu(chatId);
      break;
    case 'Buy Dice':
      showBuyDiceMenu(chatId);
      break;
    case 'New wallet':
      createNewWallet(chatId);
      break;
    case 'Connect wallet':
      connectWallet(chatId);
      break;
    case 'Throw dice':
      throwDice(chatId, false); // false for free dice
      break;
    case 'Roll dice':
      throwDice(chatId, true); // true for paid dice
      break;
    case 'Referral':
      showReferral(chatId);
      break;
    default:
      bot.sendMessage(chatId, 'Please choose a valid option.');
  }
});

// Function to create a new wallet
async function createNewWallet(chatId) {
  try {
    const response = await axios.post(`${API_ENDPOINT}/create-wallet`);
    const walletData = response.data;

    bot.sendMessage(chatId, `Wallet created!\nAddress: ${walletData.address}\nSeed: ${walletData.seed}\nBalance: ${walletData.balance}`, {
      reply_markup: {
        keyboard: [['Deposit', 'Roll dice', 'Home']],
        one_time_keyboard: true,
      },
    });
  } catch (error) {
    bot.sendMessage(chatId, 'Error creating wallet. Please try again.');
  }
}

// Function to show free dice menu
function showFreeDiceMenu(chatId) {
  bot.sendMessage(chatId, 'Free Dice Menu:\n- Number of free dice per day\n- Remaining free dice of the day\n- Show $SANTI token balance', {
    reply_markup: {
      keyboard: [['New wallet', 'Connect wallet', 'Throw dice', 'Back']],
      one_time_keyboard: true,
    },
  });
}

// Function to show buy dice menu
function showBuyDiceMenu(chatId) {
  bot.sendMessage(chatId, 'Buy Dice Menu:\n- $TON per dice roll\n- Maximum paid dice roll per day', {
    reply_markup: {
      keyboard: [['New wallet', 'Connect wallet']],
      one_time_keyboard: true,
    },
  });
}

// Function to connect an existing wallet
function connectWallet(chatId) {
  bot.sendMessage(chatId, 'Please enter your wallet details to connect.');
  // Additional logic to handle wallet connection can be implemented here
}

// Function to handle dice rolls
async function throwDice(chatId, isPaid) {
  try {
    const response = await axios.post(`${API_ENDPOINT}/roll-dice`, { isPaid });
    const diceResult = response.data;

    bot.sendMessage(chatId, `Dice rolled! You got ${diceResult.value}. You earned ${diceResult.tokenAmount} $SANTI tokens.`, {
      reply_markup: {
        keyboard: [['Throw again', 'Referral', 'Home']],
        one_time_keyboard: true,
      },
    });
  } catch (error) {
    bot.sendMessage(chatId, 'Error rolling dice. Please try again.');
  }
}

// Function to show referral info
async function showReferral(chatId) {
  try {
    const response = await axios.get(`${API_ENDPOINT}/referral`);
    const referralData = response.data;

    bot.sendMessage(chatId, `Referral Rules:\nLink: ${referralData.link}\nReferred Users: ${referralData.referredUsers}\nTotal Rewards: ${referralData.totalRewards}`, {
      reply_markup: {
        keyboard: [['Home']],
        one_time_keyboard: true,
      },
    });
  } catch (error) {
    bot.sendMessage(chatId, 'Error fetching referral info. Please try again.');
  }
}

// Function to handle deposits
function handleDeposit(chatId, walletAddress) {
  bot.sendMessage(chatId, `Please deposit to the following address: ${walletAddress}`, {
    reply_markup: {
      keyboard: [['Copy address']],
      one_time_keyboard: true,
    },
  });
}
