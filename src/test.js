// Quick test: fetch data from all chains, show digest, and simulate comparison
import { fetchAllData } from './services/ratesFetcher.js';
import { compareRates } from './services/rateComparer.js';
import { formatDailyDigest, formatRateChangeAlerts } from './services/formatter.js';
import { log } from './utils/logger.js';

async function test() {
  log.info('Fetching all data...');
  const data = await fetchAllData();

  // Summary
  for (const [chain, d] of Object.entries(data)) {
    log.info(`${chain}: ${d.lending.length} fTokens, ${d.liquidity.length} liquidity tokens`);
  }

  // Test digest formatting
  log.info('\n=== DAILY DIGEST PREVIEW ===');
  const digest = formatDailyDigest(data);
  // Strip HTML for console
  console.log(digest.replace(/<[^>]*>/g, ''));

  // Simulate a rate change by tweaking data
  log.info('\n=== SIMULATING RATE CHANGE ===');
  const fakeOld = JSON.parse(JSON.stringify(data));
  // Bump a supply rate by 20% to trigger alert
  for (const chain of Object.values(fakeOld)) {
    for (const t of chain.lending) {
      t.supplyRate = Math.round(t.supplyRate * 0.8); // simulate old rate was 20% lower
    }
    for (const t of chain.liquidity) {
      t.borrowRate = Math.round(t.borrowRate * 0.8);
    }
  }

  const alerts = compareRates(data, fakeOld);
  log.info(`Rate changes: ${alerts.rateChanges.length}`);
  log.info(`TVL changes: ${alerts.tvlChanges.length}`);
  log.info(`Reward changes: ${alerts.rewardChanges.length}`);
  log.info(`New assets: ${alerts.newAssets.length}`);
  log.info(`High utilization: ${alerts.highUtilization.length}`);
  log.info(`Whale activity: ${alerts.whaleActivity.length}`);

  if (alerts.rateChanges.length > 0) {
    const msg = formatRateChangeAlerts(alerts.rateChanges);
    console.log('\n' + msg.replace(/<[^>]*>/g, ''));
  }

  log.info('Test complete!');
}

test().catch((e) => {
  log.error('Test failed:', e);
  process.exit(1);
});
