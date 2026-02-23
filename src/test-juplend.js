// Test script: fetch JupLend data using the SDK with delays to avoid rate limiting
import { Connection, PublicKey } from '@solana/web3.js';
import { getLendingTokens, getLendingTokenDetails } from '@jup-ag/lend/earn';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

// Known token mints for symbol resolution
const KNOWN_MINTS = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'JitoSOL',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'bSOL',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'WETH',
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'WBTC',
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 'stSOL',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'WIF',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': 'JLP',
  'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v': 'jupSOL',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('Fetching JupLend tokens...\n');

  const tokens = await getLendingTokens({ connection });
  console.log(`Found ${tokens.length} lending tokens\n`);

  // Fetch one at a time with 5s delay to avoid rate limiting
  const results = [];
  for (let i = 0; i < tokens.length; i++) {
    const tokenPk = tokens[i];
    console.log(`Fetching ${i + 1}/${tokens.length}: ${tokenPk.toString()}...`);
    try {
      const details = await getLendingTokenDetails({
        lendingToken: tokenPk,
        connection,
      });
      results.push(details);
      console.log('  OK');
    } catch (e) {
      console.log(`  FAILED: ${e.message.slice(0, 80)}`);
    }
    if (i < tokens.length - 1) await sleep(5000); // 5s between requests
  }

  console.log(`\n=== JUPLEND MARKETS (${results.length}/${tokens.length}) ===\n`);
  for (const t of results) {
    const assetAddr = t.asset.toString();
    const symbol = KNOWN_MINTS[assetAddr] || assetAddr.slice(0, 8) + '...';
    const supplyRate = Number(t.supplyRate) / 100;
    const rewardsRate = Number(t.rewardsRate) / 100;
    const totalRate = supplyRate + rewardsRate;
    const totalAssets = Number(t.totalAssets) / Math.pow(10, t.decimals);

    console.log(`${symbol}:`);
    console.log(`  Supply APY: ${supplyRate.toFixed(2)}%`);
    console.log(`  Rewards APY: ${rewardsRate.toFixed(2)}%`);
    console.log(`  Total APY: ${totalRate.toFixed(2)}%`);
    console.log(`  Total Assets: ${totalAssets.toLocaleString()}`);
    console.log(`  Decimals: ${t.decimals}`);
    console.log('');
  }
}

main().catch(console.error);
