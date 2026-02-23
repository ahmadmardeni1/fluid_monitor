import { THRESHOLDS } from '../config/thresholds.js';
import { percentChange } from '../utils/rateMath.js';

/**
 * Compare current data with previous state (liquidity tokens only).
 *
 * Alert types:
 * - rateChanges:      supply/borrow rate spikes
 * - tvlChanges:       large deposit/withdrawal (>5% AND >$100k)
 * - newAssets:        new tokens appearing
 * - highUtilization:  markets nearing capacity (>90%)
 */
export function compareRates(currentData, previousData) {
  const alerts = {
    rateChanges: [],
    tvlChanges: [],
    newAssets: [],
    highUtilization: [],
  };

  for (const [chainName, chainData] of Object.entries(currentData)) {
    const prevChain = previousData[chainName];

    for (const token of chainData.liquidity) {
      const prev = prevChain?.liquidity?.find((p) => p.address === token.address);

      if (!prev) {
        alerts.newAssets.push({
          chain: chainName,
          symbol: token.symbol,
          supplyRate: token.supplyRate,
          borrowRate: token.borrowRate,
          utilization: token.utilization,
        });
        continue;
      }

      // Supply rate change
      const supChg = percentChange(prev.supplyRate, token.supplyRate);
      if (
        isFinite(supChg) &&
        Math.abs(supChg) >= THRESHOLDS.rateChangePercent &&
        Math.max(token.supplyRate, prev.supplyRate) >= THRESHOLDS.minRateForAlert
      ) {
        alerts.rateChanges.push({
          chain: chainName,
          symbol: token.symbol,
          metric: 'Supply Rate',
          prev: prev.supplyRate,
          curr: token.supplyRate,
          change: supChg,
        });
      }

      // Borrow rate change
      const borChg = percentChange(prev.borrowRate, token.borrowRate);
      if (
        isFinite(borChg) &&
        Math.abs(borChg) >= THRESHOLDS.rateChangePercent &&
        Math.max(token.borrowRate, prev.borrowRate) >= THRESHOLDS.minRateForAlert
      ) {
        alerts.rateChanges.push({
          chain: chainName,
          symbol: token.symbol,
          metric: 'Borrow Rate',
          prev: prev.borrowRate,
          curr: token.borrowRate,
          change: borChg,
        });
      }

      // TVL change (supply side) — requires both >$100k absolute move AND >5% change
      const prevTvl = prev.totalSupplyUsd || 0;
      const currTvl = token.totalSupplyUsd || 0;
      const tvlDiff = Math.abs(currTvl - prevTvl);
      if (prevTvl > 1000) {
        const tvlChg = ((currTvl - prevTvl) / prevTvl) * 100;
        if (Math.abs(tvlChg) >= THRESHOLDS.tvlChangePercent && tvlDiff >= THRESHOLDS.minTvlChangeUsd) {
          alerts.tvlChanges.push({
            chain: chainName,
            symbol: token.symbol,
            prevTvl,
            currTvl,
            change: tvlChg,
          });
        }
      }

      // Borrow volume change — requires both >$100k absolute move AND >5% change
      const prevBor = prev.totalBorrowUsd || 0;
      const currBor = token.totalBorrowUsd || 0;
      const borDiff = Math.abs(currBor - prevBor);
      if (prevBor > 1000) {
        const borTvlChg = ((currBor - prevBor) / prevBor) * 100;
        if (Math.abs(borTvlChg) >= THRESHOLDS.tvlChangePercent && borDiff >= THRESHOLDS.minTvlChangeUsd) {
          alerts.tvlChanges.push({
            chain: chainName,
            symbol: `${token.symbol} (borrows)`,
            prevTvl: prevBor,
            currTvl: currBor,
            change: borTvlChg,
          });
        }
      }

      // High utilization warning — crossed threshold this cycle
      const utilPct = token.utilization / 100;
      const prevUtilPct = (prev.utilization || 0) / 100;
      if (utilPct >= THRESHOLDS.utilizationWarning && prevUtilPct < THRESHOLDS.utilizationWarning) {
        alerts.highUtilization.push({
          chain: chainName,
          symbol: token.symbol,
          utilization: utilPct,
          borrowRate: token.borrowRate,
          supplyRate: token.supplyRate,
        });
      }
    }
  }

  return alerts;
}
