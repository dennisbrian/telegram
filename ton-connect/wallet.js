const { isWalletInfoRemote, WalletsListManager } = require('@tonconnect/sdk');

const walletsListManager = new WalletsListManager({
    cacheTTLMs: Number(process.env.WALLETS_LIST_CACHE_TTL_MS),
});

async function getWallets() {
    const wallets = await walletsListManager.getWallets();
    return wallets.filter(isWalletInfoRemote);
}

async function getWalletInfo(walletAppName) {
    const wallets = await getWallets();
    return wallets.find(
        (wallet) => wallet.appName.toLowerCase() === walletAppName.toLowerCase()
    );
}

module.exports = { getWallets, getWalletInfo };
