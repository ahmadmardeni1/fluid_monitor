import { fetchAllData } from '../services/ratesFetcher.js';
import { compareRates } from '../services/rateComparer.js';
import {
  formatRateChangeAlerts,
  formatTvlAlerts,
  formatNewAssetAlerts,
  formatUtilizationAlerts,
} from '../services/formatter.js';
import { queueMessage } from '../services/telegram.js';
import { loadState, saveState } from '../state/store.js';
import { log } from '../utils/logger.js';
import { percentChange, bpsToPercent } from '../utils/rateMath.js';

export async function runRateMonitor() {
  log.info('Starting rate monitor cycle...');

  const previousData = loadState();
  const currentData = await fetchAllData();

  if (Object.keys(currentData).length === 0) {
    log.error('No data fetched from any chain. Skipping cycle.');
    return;
  }

  // First run: save baseline, no alerts
  if (Object.keys(previousData).length === 0) {
    log.info('First run — saving baseline state.');
    saveState(currentData);

    let msg = '<b>Fluid Rate Monitor Started</b>\n';
    msg += '━━━━━━━━━━━━━━━━━━━━\n\n';

    for (const [name, d] of Object.entries(currentData)) {
      msg += `<b>[${name}]</b>\n`;

      if (d.liquidity.length > 0) {
        const tickers = d.liquidity.map((t) => t.symbol).join(', ');
        msg += `  ${tickers}\n`;
      }

      msg += '\n';
    }

    msg += 'Checking every hour. Alerts fire when:\n';
    msg += '  - Rate changes > 10%\n';
    msg += '  - TVL moves > 5% (min $100k)\n';
    msg += '  - Utilization crosses 90%\n';
    msg += '  - New assets listed';

    await queueMessage(msg);
    return;
  }

  // Log comparison details (liquidity tokens only)
  for (const [chainName, chainData] of Object.entries(currentData)) {
    const prevChain = previousData[chainName];
    if (!prevChain) {
      log.info(`[${chainName}] NEW CHAIN — no previous data`);
      continue;
    }

    for (const token of chainData.liquidity) {
      const prev = prevChain.liquidity?.find((p) => p.address === token.address);
      if (!prev) {
        log.info(`[${chainName}] NEW: ${token.symbol}`);
        continue;
      }
      const supChg = percentChange(prev.supplyRate, token.supplyRate);
      const borChg = percentChange(prev.borrowRate, token.borrowRate);
      const utilPrev = (prev.utilization || 0) / 100;
      const utilCurr = token.utilization / 100;
      // Only log tokens with some activity
      if (prev.supplyRate > 0 || token.supplyRate > 0 || prev.borrowRate > 0 || token.borrowRate > 0) {
        log.info(
          `[${chainName}] ${token.symbol}: ` +
            `supply ${bpsToPercent(prev.supplyRate)}->${bpsToPercent(token.supplyRate)} (${isFinite(supChg) ? supChg.toFixed(1) + '%' : 'n/a'}) | ` +
            `borrow ${bpsToPercent(prev.borrowRate)}->${bpsToPercent(token.borrowRate)} (${isFinite(borChg) ? borChg.toFixed(1) + '%' : 'n/a'}) | ` +
            `util ${utilPrev.toFixed(1)}%->${utilCurr.toFixed(1)}%`
        );
      }
    }
  }

  // Compare
  const alerts = compareRates(currentData, previousData);

  // Send each alert type
  await queueMessage(formatRateChangeAlerts(alerts.rateChanges));
  await queueMessage(formatTvlAlerts(alerts.tvlChanges));
  await queueMessage(formatNewAssetAlerts(alerts.newAssets));
  await queueMessage(formatUtilizationAlerts(alerts.highUtilization));

  // Save state
  saveState(currentData);

  const total =
    alerts.rateChanges.length +
    alerts.tvlChanges.length +
    alerts.newAssets.length +
    alerts.highUtilization.length;

  log.info(`Rate monitor cycle done. ${total} alert(s) sent.`);
}
