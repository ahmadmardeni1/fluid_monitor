export const THRESHOLDS = {
  // Rate change: fire when % change exceeds this (relative change)
  rateChangePercent: Number(process.env.RATE_CHANGE_THRESHOLD) || 10,

  // TVL change: fire when % change exceeds this
  tvlChangePercent: Number(process.env.TVL_CHANGE_THRESHOLD) || 5,

  // Reward rate change: fire when rewards rate changes >10%
  rewardRateChangePercent: Number(process.env.REWARD_RATE_CHANGE_THRESHOLD) || 10,

  // Utilization warning: when borrow utilization exceeds this %
  utilizationWarning: Number(process.env.UTILIZATION_WARNING_THRESHOLD) || 90,

  // Minimum rate in bps to avoid noise (rate going 1bp->2bp is 100% but irrelevant)
  minRateForAlert: 10, // 0.10%

  // Minimum TVL (in raw token units / 10^decimals) to avoid dust pool alerts
  minTvlUsd: 10000,
};
