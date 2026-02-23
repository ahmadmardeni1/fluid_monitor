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
      html += `  <b>${a.symbol}</b> | ${a.metric}\n`;
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

// ─── NEW ASSETS ────────────────────────────────

export function formatNewAssetAlerts(alerts) {
  if (!alerts.length) return null;

  let html = '<b>NEW ASSETS DETECTED</b>\n';
  html += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const a of alerts) {
    html += `<b>[${a.chain}]</b> <b>${a.symbol}</b>\n`;
    html += `  Supply: ${bpsToPercent(a.supplyRate)} | Borrow: ${bpsToPercent(a.borrowRate)}`;
    if (a.utilization > 0) html += ` | Util: ${(a.utilization / 100).toFixed(1)}%`;
    html += '\n\n';
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
