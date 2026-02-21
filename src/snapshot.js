// One-time snapshot: post full data overview to the Telegram channel
import 'dotenv/config';
import { fetchAllData } from './services/ratesFetcher.js';
import { initBot, queueMessage } from './services/telegram.js';
import { bpsToPercent } from './utils/rateMath.js';
import { log } from './utils/logger.js';

function fmtUsd(value) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

async function snapshot() {
  initBot(process.env.BOT_TOKEN, process.env.CHAT_ID);

  log.info('Fetching all data for snapshot...');
  const data = await fetchAllData();

  // ─── 1. RATES OVERVIEW ───────────────────────
  let ratesMsg = '<b>📊 FULL RATES SNAPSHOT</b>\n';
  ratesMsg += `<i>${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</i>\n`;
  ratesMsg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const [chainName, chainData] of Object.entries(data)) {
    ratesMsg += `<b>[${chainName}]</b>\n`;

    if (chainData.lending.length > 0) {
      ratesMsg += '<u>Lending (fTokens)</u>\n';
      const sorted = [...chainData.lending].sort((a, b) => b.totalRate - a.totalRate);
      for (const t of sorted) {
        ratesMsg += `  <b>${t.symbol}</b>: ${bpsToPercent(t.totalRate)} APR`;
        if (t.rewardsRate > 0) {
          ratesMsg += ` (${bpsToPercent(t.supplyRate)} base + ${bpsToPercent(t.rewardsRate)} rewards)`;
        }
        ratesMsg += '\n';
      }
      ratesMsg += '\n';
    }

    if (chainData.liquidity.length > 0) {
      ratesMsg += '<u>Liquidity (Supply / Borrow)</u>\n';
      const active = [...chainData.liquidity]
        .filter((t) => t.supplyRate > 0 || t.borrowRate > 0)
        .sort((a, b) => b.borrowRate - a.borrowRate);
      for (const t of active) {
        ratesMsg += `  <b>${t.symbol}</b>: Supply ${bpsToPercent(t.supplyRate)} | Borrow ${bpsToPercent(t.borrowRate)}\n`;
      }
      if (active.length === 0) ratesMsg += '  No active rates\n';
      ratesMsg += '\n';
    }
  }
  await queueMessage(ratesMsg);

  // ─── 2. TVL OVERVIEW ─────────────────────────
  let tvlMsg = '<b>💰 TVL SNAPSHOT</b>\n';
  tvlMsg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const [chainName, chainData] of Object.entries(data)) {
    tvlMsg += `<b>[${chainName}]</b>\n`;

    if (chainData.lending.length > 0) {
      tvlMsg += '<u>Lending TVL</u>\n';
      const sorted = [...chainData.lending].sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd);
      let chainLendingTvl = 0;
      for (const t of sorted) {
        if (t.totalAssetsUsd > 0) {
          tvlMsg += `  ${t.symbol}: ${fmtUsd(t.totalAssetsUsd)}\n`;
          chainLendingTvl += t.totalAssetsUsd;
        }
      }
      tvlMsg += `  <i>Subtotal: ${fmtUsd(chainLendingTvl)}</i>\n\n`;
    }

    if (chainData.liquidity.length > 0) {
      tvlMsg += '<u>Liquidity TVL (Top 15 by Supply)</u>\n';
      const sorted = [...chainData.liquidity]
        .filter((t) => t.totalSupplyUsd > 100)
        .sort((a, b) => b.totalSupplyUsd - a.totalSupplyUsd)
        .slice(0, 15);
      let chainLiqTvl = 0;
      for (const t of sorted) {
        tvlMsg += `  ${t.symbol}: Supply ${fmtUsd(t.totalSupplyUsd)} | Borrow ${fmtUsd(t.totalBorrowUsd)}\n`;
        chainLiqTvl += t.totalSupplyUsd;
      }
      const totalLiqTvl = chainData.liquidity.reduce((s, t) => s + t.totalSupplyUsd, 0);
      tvlMsg += `  <i>Total Liquidity Supply: ${fmtUsd(totalLiqTvl)}</i>\n\n`;
    }
  }
  await queueMessage(tvlMsg);

  // ─── 3. REWARD RATES ─────────────────────────
  let rewardsMsg = '<b>🎁 REWARD RATES</b>\n';
  rewardsMsg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  let hasRewards = false;
  for (const [chainName, chainData] of Object.entries(data)) {
    const withRewards = chainData.lending.filter((t) => t.rewardsRate > 0);
    if (withRewards.length > 0) {
      hasRewards = true;
      rewardsMsg += `<b>[${chainName}]</b>\n`;
      for (const t of withRewards) {
        rewardsMsg += `  <b>${t.symbol}</b>: ${bpsToPercent(t.rewardsRate)} rewards APR`;
        if (t.rewards.length > 0) {
          const rewardTokens = t.rewards.map((r) => r.tokenSymbol).join(', ');
          rewardsMsg += ` (${rewardTokens})`;
        }
        rewardsMsg += '\n';
      }
      rewardsMsg += '\n';
    }
  }
  if (!hasRewards) rewardsMsg += 'No active reward programs at the moment.\n';
  await queueMessage(rewardsMsg);

  // ─── 4. UTILIZATION RATES ────────────────────
  let utilMsg = '<b>⚡ UTILIZATION RATES</b>\n';
  utilMsg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const [chainName, chainData] of Object.entries(data)) {
    const active = [...chainData.liquidity]
      .filter((t) => t.utilization > 0)
      .sort((a, b) => b.utilization - a.utilization);

    if (active.length > 0) {
      utilMsg += `<b>[${chainName}]</b>\n`;

      // Highlight high utilization (>80%)
      const high = active.filter((t) => t.utilization > 8000);
      const normal = active.filter((t) => t.utilization <= 8000 && t.utilization > 0);

      if (high.length > 0) {
        utilMsg += '<u>🔴 High (>80%)</u>\n';
        for (const t of high) {
          const util = (t.utilization / 100).toFixed(1);
          utilMsg += `  <b>${t.symbol}</b>: ${util}% | Borrow: ${bpsToPercent(t.borrowRate)}\n`;
        }
        utilMsg += '\n';
      }

      if (normal.length > 0) {
        utilMsg += '<u>Normal</u>\n';
        for (const t of normal.slice(0, 10)) {
          const util = (t.utilization / 100).toFixed(1);
          utilMsg += `  ${t.symbol}: ${util}%\n`;
        }
        if (normal.length > 10) {
          utilMsg += `  ...and ${normal.length - 10} more\n`;
        }
        utilMsg += '\n';
      }
    }
  }
  await queueMessage(utilMsg);

  // ─── 5. FULL ASSET LIST ──────────────────────
  let assetsMsg = '<b>📋 ALL TRACKED ASSETS</b>\n';
  assetsMsg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  let totalLending = 0;
  let totalLiquidity = 0;
  for (const [chainName, chainData] of Object.entries(data)) {
    const lendCount = chainData.lending.length;
    const liqCount = chainData.liquidity.length;
    totalLending += lendCount;
    totalLiquidity += liqCount;

    assetsMsg += `<b>[${chainName}]</b>\n`;
    assetsMsg += `  Lending (${lendCount}): ${chainData.lending.map((t) => t.symbol).join(', ')}\n`;
    assetsMsg += `  Liquidity (${liqCount}): ${chainData.liquidity.map((t) => t.symbol).join(', ')}\n\n`;
  }

  assetsMsg += `<b>Total: ${totalLending} lending tokens + ${totalLiquidity} liquidity tokens across ${Object.keys(data).length} chains</b>`;
  await queueMessage(assetsMsg);

  log.info('Snapshot posted to channel!');
  process.exit(0);
}

snapshot().catch((e) => {
  log.error('Snapshot failed:', e);
  process.exit(1);
});
