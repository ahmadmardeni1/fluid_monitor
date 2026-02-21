import 'dotenv/config';
import { CronJob } from 'cron';
import { initBot } from './services/telegram.js';
import { runRateMonitor } from './jobs/rateMonitor.js';
import { runDailyDigest } from './jobs/dailyDigest.js';
import { log } from './utils/logger.js';

// Validate env
const { BOT_TOKEN, CHAT_ID } = process.env;
if (!BOT_TOKEN || !CHAT_ID) {
  log.error('Missing BOT_TOKEN or CHAT_ID in .env');
  process.exit(1);
}

// Init telegram
initBot(BOT_TOKEN, CHAT_ID);

// Hourly rate monitor (default: every hour at :00)
const rateCheckCron = process.env.RATE_CHECK_CRON || '0 * * * *';
const rateJob = new CronJob(rateCheckCron, async () => {
  try {
    await runRateMonitor();
  } catch (error) {
    log.error('Rate monitor job failed:', error.message);
  }
});

// Daily digest (disabled for now)
// const digestCron = process.env.DAILY_DIGEST_CRON || '0 8 * * *';
// const digestJob = new CronJob(digestCron, async () => {
//   try {
//     await runDailyDigest();
//   } catch (error) {
//     log.error('Daily digest job failed:', error.message);
//   }
// });

// Start
rateJob.start();
// digestJob.start();

log.info('Fluid Rate Monitor Bot started.');
log.info(`  Rate check: ${rateCheckCron}`);

// Run immediately on startup to establish baseline
runRateMonitor().catch((err) => log.error('Initial run failed:', err.message));

// Graceful shutdown
function shutdown() {
  log.info('Shutting down...');
  rateJob.stop();
  digestJob.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
