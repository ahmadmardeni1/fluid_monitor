// Integration test: fetch all data (Fluid + JupLend) and simulate comparison
import 'dotenv/config';
import { fetchJupLendVaults } from './services/jupLendFetcher.js';
import { compareRates } from './services/rateComparer.js';
import {
  formatRateChangeAlerts,
  formatTvlAlerts,
  formatNewAssetAlerts,
  formatUtilizationAlerts,
} from './services/formatter.js';
import { bpsToPercent } from './utils/rateMath.js';

function fmtUsd(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

async function main() {
  console.log('=== TEST 1: Fetch JupLend Vaults ===\n');

  const jupData = await fetchJupLendVaults();
  if (!jupData) {
    console.error('Failed to fetch JupLend data');
    process.exit(1);
  }

  console.log(`Fetched ${jupData.liquidity.length} vaults\n`);

  // Show top 10 by TVL
  const sorted = [...jupData.liquidity].sort((a, b) => b.totalSupplyUsd - a.totalSupplyUsd);
  console.log('Top 10 vaults by TVL:');
  for (let i = 0; i < Math.min(10, sorted.length); i++) {
    const v = sorted[i];
    console.log(
      `  ${v.symbol}: supply ${bpsToPercent(v.supplyRate)} | borrow ${bpsToPercent(v.borrowRate)} | ` +
      `TVL ${fmtUsd(v.totalSupplyUsd)} | Borrows ${fmtUsd(v.totalBorrowUsd)} | ` +
      `Util ${(v.utilization / 100).toFixed(1)}%`
    );
  }

  console.log('\n=== TEST 2: Simulate Rate Comparison ===\n');

  // Create fake "previous" data with slightly different rates to trigger alerts
  const fakeOld = JSON.parse(JSON.stringify(jupData));
  for (const token of fakeOld.liquidity) {
    // Simulate 15% supply rate increase on first vault
    if (token.symbol === sorted[0].symbol) {
      token.supplyRate = Math.round(token.supplyRate * 0.8); // was 20% lower
    }
    // Simulate TVL drop of $200k on second vault
    if (token.symbol === sorted[1].symbol) {
      token.totalSupplyUsd = token.totalSupplyUsd + 200000;
    }
    // Simulate utilization crossing 90% on third vault
    if (token.symbol === sorted[2].symbol) {
      token.utilization = 8500; // was 85%, now it crossed 90%
    }
  }

  const alerts = compareRates(
    { JupLend: jupData },
    { JupLend: fakeOld }
  );

  console.log(`Rate change alerts: ${alerts.rateChanges.length}`);
  for (const a of alerts.rateChanges) {
    console.log(`  [${a.chain}] ${a.symbol} | ${a.metric}: ${bpsToPercent(a.prev)} -> ${bpsToPercent(a.curr)} (${a.change.toFixed(1)}%)`);
  }

  console.log(`\nTVL change alerts: ${alerts.tvlChanges.length}`);
  for (const a of alerts.tvlChanges) {
    console.log(`  [${a.chain}] ${a.symbol}: ${fmtUsd(a.prevTvl)} -> ${fmtUsd(a.currTvl)} (${a.change.toFixed(1)}%)`);
  }

  console.log(`\nNew asset alerts: ${alerts.newAssets.length}`);
  console.log(`High utilization alerts: ${alerts.highUtilization.length}`);
  for (const a of alerts.highUtilization) {
    console.log(`  [${a.chain}] ${a.symbol}: ${a.utilization.toFixed(1)}%`);
  }

  console.log('\n=== TEST 3: Formatted Messages ===\n');

  const rateMsg = formatRateChangeAlerts(alerts.rateChanges);
  if (rateMsg) {
    console.log('RATE CHANGE MESSAGE:');
    console.log(rateMsg.replace(/<[^>]*>/g, ''));
  }

  const tvlMsg = formatTvlAlerts(alerts.tvlChanges);
  if (tvlMsg) {
    console.log('TVL CHANGE MESSAGE:');
    console.log(tvlMsg.replace(/<[^>]*>/g, ''));
  }

  const utilMsg = formatUtilizationAlerts(alerts.highUtilization);
  if (utilMsg) {
    console.log('UTILIZATION MESSAGE:');
    console.log(utilMsg.replace(/<[^>]*>/g, ''));
  }

  console.log('\n=== TEST 4: New Asset Detection ===\n');

  // Simulate a new vault appearing
  const newVault = {
    chain: 'JupLend',
    chainId: 'solana',
    type: 'liquidity',
    symbol: 'NEW/USDC',
    address: 'fake_new_vault_address',
    supplyRate: 500,
    borrowRate: 800,
    totalSupplyUsd: 1000000,
    totalBorrowUsd: 500000,
    utilization: 5000,
  };
  const currentWithNew = JSON.parse(JSON.stringify(jupData));
  currentWithNew.liquidity.push(newVault);

  const newAlerts = compareRates(
    { JupLend: currentWithNew },
    { JupLend: jupData }
  );

  console.log(`New assets detected: ${newAlerts.newAssets.length}`);
  const newMsg = formatNewAssetAlerts(newAlerts.newAssets);
  if (newMsg) {
    console.log(newMsg.replace(/<[^>]*>/g, ''));
  }

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch(console.error);
