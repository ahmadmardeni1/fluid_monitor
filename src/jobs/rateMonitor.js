import { fetchAllData } from '../services/ratesFetcher.js';
import { compareRates } from '../services/rateComparer.js';
import {
  formatRateChangeAlerts,
  formatTvlAlerts,
  formatRewardAlerts,
  formatNewAssetAlerts,
  formatUtilizationAlerts,
  formatWhaleAlerts,
} from '../services/formatter.js';
import { queueMessage } from '../services/telegram.js';
import { loadState, saveState } from '../state/store.js';
import { log } from '../utils/logger.js';

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

      if (d.lending.length > 0) {
        const tickers = d.lending.map((t) => t.symbol).join(', ');
        msg += `  Lending: ${tickers}\n`;
      }

      if (d.liquidity.length > 0) {
        const tickers = d.liquidity.map((t) => t.symbol).join(', ');
        msg += `  Liquidity: ${tickers}\n`;
      }

      msg += '\n';
    }

    msg += 'Checking every hour. Alerts fire when:\n';
    msg += '  - Rate changes > 10%\n';
    msg += '  - TVL moves > 5%\n';
    msg += '  - Reward rate changes > 10%\n';
    msg += '  - Utilization crosses 90%\n';
    msg += '  - New assets listed';

    await queueMessage(msg);
    return;
  }

  // Compare
  const alerts = compareRates(currentData, previousData);

  // Send each alert type
  await queueMessage(formatRateChangeAlerts(alerts.rateChanges));
  await queueMessage(formatTvlAlerts(alerts.tvlChanges));
  await queueMessage(formatRewardAlerts(alerts.rewardChanges));
  await queueMessage(formatNewAssetAlerts(alerts.newAssets));
  await queueMessage(formatUtilizationAlerts(alerts.highUtilization));
  await queueMessage(formatWhaleAlerts(alerts.whaleActivity));

  // Save state
  saveState(currentData);

  const total =
    alerts.rateChanges.length +
    alerts.tvlChanges.length +
    alerts.rewardChanges.length +
    alerts.newAssets.length +
    alerts.highUtilization.length +
    alerts.whaleActivity.length;

  log.info(`Rate monitor cycle done. ${total} alert(s) sent.`);
}
