import { THRESHOLDS } from '../config/thresholds.js';
import { percentChange } from '../utils/rateMath.js';

/**
 * Compare current data with previous state.
 *
 * Alert types:
 * - rateChanges:      supply/borrow rate spikes (lending + liquidity)
 * - tvlChanges:       large deposit/withdrawal (>5% TVL move)
 * - rewardChanges:    reward rate changes >10%
 * - newAssets:        new tokens appearing
 * - highUtilization:  markets nearing capacity (>90%)
 * - whaleActivity:    large single-cycle TVL moves (>10%)
 */
export function compareRates(currentData, previousData) {
  const alerts = {
    rateChanges: [],
    tvlChanges: [],
    rewardChanges: [],
    newAssets: [],
    highUtilization: [],
    whaleActivity: [],
  };

  for (const [chainName, chainData] of Object.entries(currentData)) {
    const prevChain = previousData[chainName];

    // ── LENDING (fTokens) ──
    for (const token of chainData.lending) {
      const prev = prevChain?.lending?.find((p) => p.address === token.address);

      if (!prev) {
        alerts.newAssets.push({
          chain: chainName,
          assetType: 'fToken',
          symbol: token.symbol,
          assetSymbol: token.assetSymbol,
          supplyRate: token.supplyRate,
          rewardsRate: token.rewardsRate,
          totalRate: token.totalRate,
          totalAssetsUsd: token.totalAssetsUsd,
        });
        continue;
      }

      // Supply rate change
      const supplyChg = percentChange(prev.supplyRate, token.supplyRate);
      if (
        isFinite(supplyChg) &&
        Math.abs(supplyChg) >= THRESHOLDS.rateChangePercent &&
        Math.max(token.supplyRate, prev.supplyRate) >= THRESHOLDS.minRateForAlert
      ) {
        alerts.rateChanges.push({
          chain: chainName,
          source: 'lending',
          symbol: token.symbol,
          metric: 'Supply Rate',
          prev: prev.supplyRate,
          curr: token.supplyRate,
          change: supplyChg,
        });
      }

      // Total rate change (supply + rewards) — only if supply didn't already trigger
      if (!(isFinite(supplyChg) && Math.abs(supplyChg) >= THRESHOLDS.rateChangePercent)) {
        const totalChg = percentChange(prev.totalRate, token.totalRate);
        if (
          isFinite(totalChg) &&
          Math.abs(totalChg) >= THRESHOLDS.rateChangePercent &&
          Math.max(token.totalRate, prev.totalRate) >= THRESHOLDS.minRateForAlert
        ) {
          alerts.rateChanges.push({
            chain: chainName,
            source: 'lending',
            symbol: token.symbol,
            metric: 'Total APR',
            prev: prev.totalRate,
            curr: token.totalRate,
            change: totalChg,
          });
        }
      }

      // Reward rate change
      const rewardChg = percentChange(prev.rewardsRate, token.rewardsRate);
      if (
        isFinite(rewardChg) &&
        Math.abs(rewardChg) >= THRESHOLDS.rewardRateChangePercent &&
        Math.max(token.rewardsRate, prev.rewardsRate) >= THRESHOLDS.minRateForAlert
      ) {
        alerts.rewardChanges.push({
          chain: chainName,
          source: 'lending',
          symbol: token.symbol,
          prev: prev.rewardsRate,
          curr: token.rewardsRate,
          change: rewardChg,
        });
      }

      // Also check individual reward token rates
      for (const reward of token.rewards) {
        const prevReward = prev.rewards?.find((r) => r.tokenSymbol === reward.tokenSymbol);
        if (prevReward) {
          const rChg = percentChange(prevReward.rate, reward.rate);
          if (
            isFinite(rChg) &&
            Math.abs(rChg) >= THRESHOLDS.rewardRateChangePercent &&
            Math.max(reward.rate, prevReward.rate) >= THRESHOLDS.minRateForAlert
          ) {
            alerts.rewardChanges.push({
              chain: chainName,
              source: 'lending',
              symbol: `${token.symbol} (${reward.tokenSymbol} reward)`,
              prev: prevReward.rate,
              curr: reward.rate,
              change: rChg,
            });
          }
        }
      }

      // TVL change
      const prevTvl = prev.totalAssetsUsd || 0;
      const currTvl = token.totalAssetsUsd || 0;
      if (prevTvl > 1000) {
        // Only track if TVL > $1k
        const tvlChg = ((currTvl - prevTvl) / prevTvl) * 100;
        if (Math.abs(tvlChg) >= THRESHOLDS.tvlChangePercent) {
          const entry = {
            chain: chainName,
            source: 'lending',
            symbol: token.symbol,
            prevTvl,
            currTvl,
            change: tvlChg,
          };
          alerts.tvlChanges.push(entry);
          if (Math.abs(tvlChg) >= 10) alerts.whaleActivity.push(entry);
        }
      }
    }

    // ── LIQUIDITY TOKENS ──
    for (const token of chainData.liquidity) {
      const prev = prevChain?.liquidity?.find((p) => p.address === token.address);

      if (!prev) {
        alerts.newAssets.push({
          chain: chainName,
          assetType: 'liquidity',
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
          source: 'liquidity',
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
          source: 'liquidity',
          symbol: token.symbol,
          metric: 'Borrow Rate',
          prev: prev.borrowRate,
          curr: token.borrowRate,
          change: borChg,
        });
      }

      // TVL change (supply side)
      const prevTvl = prev.totalSupplyUsd || 0;
      const currTvl = token.totalSupplyUsd || 0;
      if (prevTvl > 1000) {
        const tvlChg = ((currTvl - prevTvl) / prevTvl) * 100;
        if (Math.abs(tvlChg) >= THRESHOLDS.tvlChangePercent) {
          const entry = {
            chain: chainName,
            source: 'liquidity',
            symbol: token.symbol,
            prevTvl,
            currTvl,
            change: tvlChg,
          };
          alerts.tvlChanges.push(entry);
          if (Math.abs(tvlChg) >= 10) alerts.whaleActivity.push(entry);
        }
      }

      // Borrow volume change
      const prevBor = prev.totalBorrowUsd || 0;
      const currBor = token.totalBorrowUsd || 0;
      if (prevBor > 1000) {
        const borTvlChg = ((currBor - prevBor) / prevBor) * 100;
        if (Math.abs(borTvlChg) >= THRESHOLDS.tvlChangePercent) {
          alerts.tvlChanges.push({
            chain: chainName,
            source: 'liquidity',
            symbol: `${token.symbol} (borrows)`,
            prevTvl: prevBor,
            currTvl: currBor,
            change: borTvlChg,
          });
        }
      }

      // High utilization warning — crossed threshold this cycle
      const utilPct = token.utilization / 100; // convert bps to %
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
