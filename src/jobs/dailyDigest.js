import { fetchAllData } from '../services/ratesFetcher.js';
import { formatDailyDigest } from '../services/formatter.js';
import { queueMessage } from '../services/telegram.js';
import { log } from '../utils/logger.js';

export async function runDailyDigest() {
  log.info('Generating daily digest...');

  const currentData = await fetchAllData();
  if (Object.keys(currentData).length === 0) {
    log.error('No data for daily digest.');
    return;
  }

  await queueMessage(formatDailyDigest(currentData));
  log.info('Daily digest sent.');
}
