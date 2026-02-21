import { bpsToPercent } from '../utils/rateMath.js';

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});
}

function fmtUsd(value) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function arrow(change) {
  return change > 0 ? 'UP' : 'DOWN';
}

// ─── RATE CHANGES ──────────────────────────────

export function formatRateChangeAlerts(alerts) {
  if (!alerts.length) return null;

  let html = '<b>RATE CHANGE ALERTS</b>\n';
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  const byChain = groupBy(alerts, 'chain');
  for (const [chain, items] of Object.entries(byChain)) {
    html += `<b>[${chain}]</b>\n`;
    for (const a of items) {
      const src = a.source === 'liquidity' ? 'LIQ' : 'LEND';
      html += `  [${src}] <b>${a.symbol}</b> | ${a.metric}\n`;
      html += `  ${bpsToPercent(a.prev)} -> ${bpsToPercent(a.curr)} (${arrow(a.change)} ${Math.abs(a.change).toFixed(1)}%)\n\n`;
    }
  }
  return html;
}

// ─── TVL CHANGES ───────────────────────────────

export function formatTvlAlerts(alerts) {
  if (!alerts.length) return null;

  let html = '<b>TVL CHANGE ALERTS</b>\n';
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  const byChain = groupBy(alerts, 'chain');
  for (const [chain, items] of Object.entries(byChain)) {
    html += `<b>[${chain}]</b>\n`;
    for (const a of items) {
      const dir = a.change > 0 ? 'INFLOW' : 'OUTFLOW';
      const diff = Math.abs(a.currTvl - a.prevTvl);
      html += `  <b>${a.symbol}</b>\n`;
      html += `  ${dir}: ${fmtUsd(diff)} (${a.change > 0 ? '+' : ''}${a.change.toFixed(1)}%)\n`;
      html += `  TVL: ${fmtUsd(a.prevTvl)} -> ${fmtUsd(a.currTvl)}\n\n`;
    }
  }
  return html;
}

// ─── REWARD RATE CHANGES ───────────────────────

export function formatRewardAlerts(alerts) {
  if (!alerts.length) return null;

  let html = '<b>REWARD RATE CHANGES</b>\n';
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  const byChain = groupBy(alerts, 'chain');
  for (const [chain, items] of Object.entries(byChain)) {
    html += `<b>[${chain}]</b>\n`;
    for (const a of items) {
      html += `  <b>${a.symbol}</b>\n`;
      html += `  ${bpsToPercent(a.prev)} -> ${bpsToPercent(a.curr)} (${arrow(a.change)} ${Math.abs(a.change).toFixed(1)}%)\n\n`;
    }
  }
  return html;
}

// ─── NEW ASSETS ────────────────────────────────

export function formatNewAssetAlerts(alerts) {
  if (!alerts.length) return null;

  let html = '<b>NEW ASSETS DETECTED</b>\n';
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const a of alerts) {
    html += `<b>[${a.chain}]</b> `;
    if (a.assetType === 'fToken') {
      html += `New fToken: <b>${a.symbol}</b> (${a.assetSymbol})\n`;
      html += `  Supply: ${bpsToPercent(a.supplyRate)}`;
      if (a.rewardsRate > 0) html += ` + ${bpsToPercent(a.rewardsRate)} rewards`;
      if (a.totalAssetsUsd > 0) html += ` | TVL: ${fmtUsd(a.totalAssetsUsd)}`;
      html += '\n\n';
    } else {
      html += `New Liquidity Token: <b>${a.symbol}</b>\n`;
      html += `  Supply: ${bpsToPercent(a.supplyRate)} | Borrow: ${bpsToPercent(a.borrowRate)}`;
      if (a.utilization > 0) html += ` | Util: ${(a.utilization / 100).toFixed(1)}%`;
      html += '\n\n';
    }
  }
  return html;
}

// ─── HIGH UTILIZATION ──────────────────────────

export function formatUtilizationAlerts(alerts) {
  if (!alerts.length) return null;

  let html = '<b>HIGH UTILIZATION WARNING</b>\n';
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const a of alerts) {
    html += `<b>[${a.chain}]</b> ${a.symbol}\n`;
    html += `  Utilization: ${a.utilization.toFixed(1)}%\n`;
    html += `  Supply: ${bpsToPercent(a.supplyRate)} | Borrow: ${bpsToPercent(a.borrowRate)}\n`;
    html += `  Rates may spike soon!\n\n`;
  }
  return html;
}

// ─── WHALE ACTIVITY ────────────────────────────

export function formatWhaleAlerts(alerts) {
  if (!alerts.length) return null;

  let html = '<b>WHALE ACTIVITY</b>\n';
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const a of alerts) {
    const dir = a.change > 0 ? 'LARGE DEPOSIT' : 'LARGE WITHDRAWAL';
    const diff = Math.abs(a.currTvl - a.prevTvl);
    html += `<b>[${a.chain}]</b> ${a.symbol}\n`;
    html += `  ${dir}: ${fmtUsd(diff)} (${a.change > 0 ? '+' : ''}${a.change.toFixed(1)}%)\n\n`;
  }
  return html;
}

// ─── DAILY DIGEST ──────────────────────────────

export function formatDailyDigest(data) {
  let html = '<b>FLUID PROTOCOL - DAILY DIGEST</b>\n';
  html += `<i>${new Date().toISOString().split('T')[0]}</i>\n`;
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const [chainName, chainData] of Object.entries(data)) {
    if (!chainData.lending.length && !chainData.liquidity.length) continue;

    html += `<b>[${chainName}]</b>\n`;

    // Lending fTokens sorted by total rate
    if (chainData.lending.length > 0) {
      html += '<u>Lending (fTokens)</u>\n';
      const sorted = [...chainData.lending].sort((a, b) => b.totalRate - a.totalRate);
      for (const t of sorted) {
        html += `  ${t.symbol}: ${bpsToPercent(t.totalRate)} APR`;
        if (t.rewardsRate > 0) html += ` (${bpsToPercent(t.supplyRate)} + ${bpsToPercent(t.rewardsRate)} rewards)`;
        if (t.totalAssetsUsd > 0) html += ` | ${fmtUsd(t.totalAssetsUsd)}`;
        html += '\n';
      }
      html += '\n';
    }

    // Liquidity tokens sorted by borrow rate
    if (chainData.liquidity.length > 0) {
      html += '<u>Liquidity (Supply/Borrow)</u>\n';
      const sorted = [...chainData.liquidity]
        .filter((t) => t.supplyRate > 0 || t.borrowRate > 0)
        .sort((a, b) => b.borrowRate - a.borrowRate)
        .slice(0, 15);

      for (const t of sorted) {
        const util = (t.utilization / 100).toFixed(1);
        html += `  ${t.symbol}: S:${bpsToPercent(t.supplyRate)} B:${bpsToPercent(t.borrowRate)} | Util:${util}%`;
        if (t.totalSupplyUsd > 0) html += ` | ${fmtUsd(t.totalSupplyUsd)}`;
        html += '\n';
      }
      html += '\n';
    }
  }

  return html;
}
