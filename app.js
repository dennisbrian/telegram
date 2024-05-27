require('dotenv').config();
const axios = require('axios');
const { TonConnect } = require('@tonconnect/sdk');
const TonConnectStorage = require('./ton-connect/storage');
const { getWallets } = require('./ton-connect/wallet');
const QRCode = require('qrcode');
const { getConnector } = require('./ton-connect/connector');
const { bot } = require('./bot');
const { walletMenuCallbacks } = require('./connect-wallet-menu');

require('./connect-wallet-menu');

// Replace with your local API endpoint
const API_ENDPOINT = 'http://localhost:3000';

// Function to show the main menu
function showMainMenu(chatId) {
    bot.sendMessage(chatId, 'Welcome! Choose an option:', {
        reply_markup: {
            keyboard: [['Free Dice', 'Buy Dice']],
            one_time_keyboard: true,
        },
    });
}

// Welcome message and main menu for /start
bot.onText(/\/start (.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    const username = msg.from.first_name;
    if (match[1] != null) {
        registerReferral(chatId, username, match[1]);
    }

    showMainMenu(chatId);
});

// Listen for 'Home' command
bot.onText(/Home/, (msg) => {
    const chatId = msg.chat.id;
    showMainMenu(chatId);
});

// Handling user commands
bot.on('message', (msg) => {
    const username = msg.from.first_name;
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;

    switch (text) {
        case 'Free Dice':
            showFreeDiceMenu(chatId);
            break;
        case 'Buy Dice':
            showBuyDiceMenu(chatId);
            break;
        case 'New wallet':
            createNewWallet(chatId, userId);
            break;
        case 'Connect wallet':
            connectWallet(chatId, userId);
            break;
        case 'Throw dice':
        case 'Throw again (free)':
            throwDice(chatId, false, userId); // false for free dice
            break;
        case 'Roll dice':
        case 'Throw again':
            throwDice(chatId, true, userId); // true for paid dice
            break;
        case 'Referral':
            showReferral(chatId, username);
            break;
        case 'Deposit':
            handleDeposit(chatId, userId);
            break;
        case 'Home':
        case '/start':
        case 'Back':
            showMainMenu(chatId);
            break;
        default:
            if (text.split(':')[0] == 'Wallet') {
                walletChosen(chatId, userId, text.split(':')[1].trim());
            } else {
                bot.sendMessage(chatId, 'Please choose a valid option.');
            }
    }
});

bot.on('callback_query', (query) => {
    if (!query.data) {
        return;
    }

    let request;

    try {
        request = JSON.parse(query.data);

        if (!walletMenuCallbacks[request.method]) {
            return;
        }

        walletMenuCallbacks[request.method](query, request.data);
    } catch {
        return;
    }
});

// Function to create a new wallet
async function createNewWallet(chatId, userId) {
    try {
        const response = await axios.post(`${API_ENDPOINT}/create-wallet`, {
            userId,
        });
        const walletData = response.data;

        bot.sendMessage(
            chatId,
            `Wallet created!\nAddress: ${walletData.address}\nSeed: ${walletData.seed}\nBalance: ${walletData.balance}`,
            {
                reply_markup: {
                    keyboard: [['Deposit', 'Roll dice', 'Home']],
                    one_time_keyboard: true,
                },
            }
        );
    } catch (error) {
        bot.sendMessage(chatId, 'Error creating wallet. Please try again.');
    }
}

// Function to show free dice menu
function showFreeDiceMenu(chatId) {
    bot.sendMessage(
        chatId,
        'Free Dice Menu:\n- Number of free dice per day\n- Remaining free dice of the day\n- Show $SANTI token balance',
        {
            reply_markup: {
                keyboard: [
                    ['New wallet', 'Connect wallet', 'Throw dice', 'Back'],
                ],
                one_time_keyboard: true,
            },
        }
    );
}

// Function to show buy dice menu
function showBuyDiceMenu(chatId) {
    bot.sendMessage(
        chatId,
        'Buy Dice Menu:\n- $TON per dice roll\n- Maximum paid dice roll per day',
        {
            reply_markup: {
                keyboard: [['New wallet', 'Connect wallet']],
                one_time_keyboard: true,
            },
        }
    );
}

// Helper function to split array into chunks
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// Function to append string to each element in an array
function appendStringToArray(array, appendString) {
    return array.map((element) => appendString + element);
}

// Function to connect an existing wallet
async function connectWallet(chatId, userId) {
    try {
        const wallets = await getWallets();

        const connector = getConnector(chatId);

        connector.onStatusChange((wallet) => {
            if (wallet) {
                bot.sendMessage(
                    chatId,
                    `${wallet.device.appName} wallet connected!`
                );
            }
        });

        const tonkeeper = wallets.find(
            (wallet) => wallet.appName === 'tonkeeper'
        );

        const link = connector.connect({
            bridgeUrl: tonkeeper.bridgeUrl,
            universalLink: tonkeeper.universalLink,
        });
        const image = await QRCode.toBuffer(link);

        await bot.sendPhoto(chatId, image, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Choose a wallet',
                            callback_data: JSON.stringify({
                                method: 'chose_wallet',
                            }),
                        },
                    ],
                ],
            },
        });
    } catch (error) {
        bot.sendMessage(
            chatId,
            'Error fetching wallet address. Please try again.'
        );
    }
}

// Function to handle dice rolls
async function throwDice(chatId, isPaid, userId) {
    try {
        const response = await axios.post(`${API_ENDPOINT}/roll-dice`, {
            isPaid,
            userId,
        });
        const diceResult = response.data;

        bot.sendMessage(
            chatId,
            `Dice rolled! You got ${diceResult.value}. You earned ${diceResult.tokenAmount} $SANTI tokens.`,
            {
                reply_markup: {
                    keyboard: [
                        [
                            'Throw again' + (isPaid ? '' : ' (free)'),
                            'Referral',
                            'Home',
                        ],
                    ],
                    one_time_keyboard: true,
                },
            }
        );
    } catch (error) {
        bot.sendMessage(chatId, error.response.data.error, {
            reply_markup: {
                keyboard: [
                    [
                        'Throw again' + (isPaid ? '' : ' (free)'),
                        'Referral',
                        'Home',
                    ],
                ],
                one_time_keyboard: true,
            },
        });
        return;
    }
}

// Function to show referral info
async function showReferral(chatId, username) {
    try {
        const response = await axios.get(
            `${API_ENDPOINT}/referral?username=` + username
        );
        const referralData = response.data.data;
        bot.sendMessage(
            chatId,
            `Referral Rules: Lorem ipsum dolor sit amet, ted limus dolor sit lorem\nLink: ${referralData.link}\nReferred Users: ${referralData.referred_total}\nTotal Rewards: ${referralData.rewards}`,
            {
                reply_markup: {
                    keyboard: [['Home']],
                    one_time_keyboard: true,
                },
            }
        );
    } catch (error) {
        bot.sendMessage(
            chatId,
            'Error fetching referral info. Please try again.'
        );
    }
}

// Function to handle deposits
async function handleDeposit(chatId, userId) {
    try {
        const response = await axios.post(
            `${API_ENDPOINT}/get-user-current-wallet`,
            { userId }
        );
        const walletAddress = response.data;

        bot.sendMessage(
            chatId,
            `Please deposit to the following address: ${walletAddress}`,
            {
                reply_markup: {
                    keyboard: [['Home']],
                    one_time_keyboard: true,
                },
            }
        );
    } catch (error) {
        bot.sendMessage(
            chatId,
            'Error fetching wallet address. Please try again.'
        );
    }
}

async function home(chatId) {
    try {
        bot.sendMessage(chatId, 'Welcome! Choose an option:', {
            reply_markup: {
                keyboard: [['Free Dice', 'Buy Dice']],
                one_time_keyboard: true,
            },
        });
    } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, 'Please try again.');
    }
}

// Function after picking wallet
async function walletChosen(chatId, userId, walletAddress) {
    try {
        const response = await axios.post(`${API_ENDPOINT}/choose-wallet`, {
            userId,
            walletAddress,
        });
        const walletData = response.data;

        bot.sendMessage(
            chatId,
            `Wallet chosen!\nAddress: ${walletData.address}\nSeed: ${walletData.seed}\nBalance: ${walletData.balance}`,
            {
                reply_markup: {
                    keyboard: [['Deposit', 'Roll dice', 'Home']],
                    one_time_keyboard: true,
                },
            }
        );
    } catch (error) {
        bot.sendMessage(chatId, 'Error choosing wallet. Please try again.');
    }
}

async function registerReferral(chatId, username, referral_code) {
    try {
        const response = await axios.get(
            `${API_ENDPOINT}/referral-link?username=` +
                username +
                '&code=' +
                referral_code
        );
        const message = response.data.message;
        bot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: [['Home']],
                one_time_keyboard: true,
            },
        });
    } catch (error) {
        console.log(error);
        bot.sendMessage(
            chatId,
            'Error fetching referral info. Please try again.'
        );
    }
}
