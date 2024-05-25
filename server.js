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
let diceRollHistory = [];
let referrals = {
  link: 'http://localhost:3000/referral-link/',
  referredUsers: 0,
  totalRewards: 0,
  users: [] // List of users who referred others
};

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

// Load wallets from file at startup
loadWalletsFromFile();

// Endpoint to create a wallet
app.post('/create-wallet', (req, res) => {
  const newWallet = {
    address: uuidv4(), // Generate a unique wallet address
    seed: uuidv4(), // Generate a unique seed phrase
    balance: 0
  };

  wallets[newWallet.address] = newWallet;
  saveWalletsToFile();

  res.json(newWallet);
});

// Endpoint to roll dice
app.post('/roll-dice', (req, res) => {
  const { isPaid, address } = req.body;

  if (!wallets[address]) {
    return res.status(400).json({ error: 'Wallet not found' });
  }

  const diceValue = Math.floor(Math.random() * 6) + 1;
  const tokenAmount = diceValue * (isPaid ? 10 : 1);

  if (isPaid) {
    if (wallets[address].balance < 10) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    wallets[address].balance -= 10; // Deduct paid dice cost
  }

  wallets[address].balance += tokenAmount; // Add earned tokens
  saveWalletsToFile();

  diceRollHistory.push({ address, value: diceValue, tokenAmount });
  res.json({ value: diceValue, tokenAmount, balance: wallets[address].balance });
});

// Endpoint to get referral info
app.get('/referral', (req, res) => {
  res.json(referrals);
});

// Endpoint to get referral link and refer a new user
app.post('/referral-link', (req, res) => {
  const { referrer } = req.body;

  if (!wallets[referrer]) {
    return res.status(400).json({ error: 'Referrer wallet not found' });
  }

  const referralLink = `${referrals.link}${uuidv4()}`;

  referrals.users.push({ referrer, link: referralLink });
  referrals.referredUsers += 1;

  res.json({ referralLink, referredUsers: referrals.referredUsers, totalRewards: referrals.totalRewards });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
