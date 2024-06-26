const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// In-memory data store (this can be replaced with a database)
let wallets = {}; // key: walletAddress, value: { address, seed, balance }
let user_wallet = {}; // key: userId, value: address
let diceRollHistory = [];
const botUsername = "TELEGRAM_BOT_USERNAME"

// Utility function to save wallets to a file (simulate database)
const saveWalletsToFile = () => {
  fs.writeFileSync(path.join(__dirname, 'data', 'wallets.json'), JSON.stringify(wallets, null, 2));
};

// Utility function to load wallets from a file (simulate database)
const loadWalletsFromFile = () => {
  if (fs.existsSync(path.join(__dirname, 'data', 'wallets.json'))) {
    wallets = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'wallets.json')));
  }
};

// Initialize user wallets JSON file with an empty object if it's empty
function initializeUserWalletsFile() {
  if (!fs.existsSync(path.join(__dirname, 'data', 'user_wallet.json'))) {
    fs.writeFileSync(path.join(__dirname, 'data', 'user_wallet.json'), JSON.stringify({}));
  }
}

// Read user wallet from the JSON file
function readUserCurrentWallet(userId) {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'user_wallet.json'), 'utf8');
    const userWallets = JSON.parse(data);
    return userWallets[userId] || null;
  } catch (err) {
    console.error('Error reading user wallets file:', err);
    return null;
  }
}

// Read user wallets from the JSON file
function readUserCurrentWallets(userId) {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'wallets.json'), 'utf8');
    const wallets = JSON.parse(data);
    // console.log(wallets);
    return Object.keys(wallets).filter(w => wallets[w].userId === userId) || [];
  } catch (err) {
    console.error('Error reading user wallets file:', err);
    return null;
  }
}

// Read users wallets from the JSON file
function readUsersCurrentWallets() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'user_wallet.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading user wallets file:', err);
    return {};
  }
}

// Write user wallet to the JSON file
function writeUserCurrentWallet(userId, walletId) {
  try {
    const userWallets = readUsersCurrentWallets();
    userWallets[userId] = walletId;
    fs.writeFileSync(path.join(__dirname, 'data', 'user_wallet.json'), JSON.stringify(userWallets, null, 2));
  } catch (err) {
    console.error('Error writing user wallets file:', err);
  }
}

// Load wallets from file at startup
loadWalletsFromFile();
initializeUserWalletsFile();

// Endpoint to create a wallet
app.post('/create-wallet', (req, res) => {
  const { userId } = req.body;
  const newWallet = {
    address: uuidv4(), // Generate a unique wallet address
    seed: uuidv4(), // Generate a unique seed phrase
    balance: 0,
    userId: userId,
  };

  wallets[newWallet.address] = newWallet;
  saveWalletsToFile();
  writeUserCurrentWallet(userId, newWallet.address);

  res.json(newWallet);
});

// Endpoint to get user current wallet
app.post('/get-user-current-wallet', (req, res) => {
  const { userId } = req.body;
  const walletAddress = readUserCurrentWallet(userId);

  res.json(walletAddress);
});

// Endpoint to get user current wallets
app.post('/get-user-current-wallets', (req, res) => {
  const { userId } = req.body;
  const walletAddresses = readUserCurrentWallets(userId);

  res.json(walletAddresses);
});

// Endpoint to get user current wallets
app.post('/choose-wallet', (req, res) => {
  const { userId, walletAddress } = req.body;
  const wallet = wallets[walletAddress];

  if (wallet.userId != userId) {
    return res.status(400).json({ error: 'Wallet not found' });
  }

  writeUserCurrentWallet(userId, walletAddress);

  res.json(wallet);
});

// Endpoint to roll dice
app.post('/roll-dice', (req, res) => {
  const { isPaid, userId } = req.body;

  const address = readUserCurrentWallet(userId);

  if (isPaid && !wallets[address]) {
    return res.status(400).json({ error: 'Wallet not found' });
  }

  const diceValue = Math.floor(Math.random() * 6) + 1;
  const tokenAmount = diceValue * (isPaid ? 10 : 1);
  var balance = 0;

  if (isPaid) {
    loadWalletsFromFile(); // refresh data before checking balance
    if (wallets[address].balance < 10) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    wallets[address].balance -= 10; // Deduct paid dice cost
    wallets[address].balance += tokenAmount; // Add earned tokens
    saveWalletsToFile();

    diceRollHistory.push({ address, value: diceValue, tokenAmount });
    balance = wallets[address].balance;
  }

  res.json({ value: diceValue, tokenAmount, balance: balance });
});

// Endpoint to get referral info
app.get('/referral', async (req, res) => {
  try {
    // Get the chatId parameter from the request query
    const chatId = req.query.username;

    // Read the referral data from the JSON file
    const referralData = readReferralData();

    // Check if the chatId exists in the referral data
    if (referralData.users[chatId.toString()]) {
      let data = referralData.users[chatId.toString()];
      data.link = `https://t.me/${botUsername}?start=${data.link}`;
      res.json({ data });
    } else {
      // If the user does not exist, create a new record with default values
      const referralLink = generateReferralLink();
      referralData.users[chatId] = {
        link: referralLink,
        referred_total: 0,
        rewards: 0
      };
      referralData.links[referralLink] = chatId; // Generate mapping
      writeReferralData(referralData);

      data = referralData.users[chatId.toString()]
      data.link = `https://t.me/${botUsername}?start=${data.link}`;
      res.json({ data });
    }
  } catch (error) {
    console.error('Error handling referral request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get referral link and refer a new user
app.get('/referral-link', (req, res) => {
  try {
    const username = req.query.username;
    const code = req.query.code;

    // Read the referral data from the JSON file
    const referralData = readReferralData();

    // Check if the provided code exists in the links object
    if (referralData.links && referralData.links[code]) {
      const referrer = referralData.links[code];
      const referredUser = username; // Assuming the provided username is the referred user

      // Increment referred_total and rewards of the referrer
      if (referralData.users && referralData.users[referrer]) {
        referralData.users[referrer].referred_total++;
        referralData.users[referrer].rewards++;
      }

      // Generate and write referral data for the referred user
      referralData.users[referredUser] = {
        link: generateReferralLink(),
        referred_total: 0,
        rewards: 0,
        referred_by: referrer
      };
      referralData.links[referralData.users[referredUser].link] = username;

      // Write the updated referral data to the file
      writeReferralData(referralData);

      res.json({ message: 'You have been succesfully referred!' });
    } else {
      // If the provided code is invalid, return an error response
      res.json({ message: 'Invalid Referral Code!' });
    }
  } catch (error) {
    console.error('Error handling referral link request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function readReferralData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'referral.json'), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { links: {}, users: {} };
  }
}

// Function to write referral data to the JSON file
async function writeReferralData(referralData) {
  fs.writeFileSync(path.join(__dirname, 'data', 'referral.json'), JSON.stringify(referralData, null, 2));
}

// Function to generate a random referral link
function generateReferralLink() {
  // Generate a random alphanumeric string as the referral link
  return Math.random().toString(36).substring(2, 10);
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
