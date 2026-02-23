import { API_BASE, CHAINS } from '../config/chains.js';
import { fetchJupLendVaults } from './jupLendFetcher.js';
import { log } from '../utils/logger.js';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/**
 * Lending tokens (fTokens): supply rates, rewards, TVL.
 * GET /v2/lending/{chainId}/tokens
 */
async function fetchLendingTokens(chain) {
  try {
    const json = await fetchJson(`${API_BASE}/v2/lending/${chain.id}/tokens`);
    const items = json.data || [];

    return items.map((t) => ({
      chain: chain.name,
      chainId: chain.id,
      type: 'lending',
      symbol: t.symbol,
      name: t.name,
      address: t.address,
      decimals: t.decimals,
      assetSymbol: t.asset?.symbol || '?',
      assetPrice: parseFloat(t.asset?.price || '0'),
      supplyRate: parseInt(t.supplyRate || '0'),
      rewardsRate: parseInt(t.rewardsRate || '0'),
      totalRate: parseInt(t.totalRate || '0'),
      totalAssets: t.totalAssets || '0',
      totalAssetsUsd:
        parseFloat(t.asset?.price || '0') *
        (parseInt(t.totalAssets || '0') / Math.pow(10, t.decimals || 18)),
      rewards: (t.rewards || []).map((r) => ({
        tokenSymbol: r.token?.symbol || '?',
        rate: parseInt(r.rate || '0'),
        endTime: r.endTime,
      })),
    }));
  } catch (error) {
    log.error(`[${chain.name}] Lending fetch failed: ${error.message}`);
    return [];
  }
}

/**
 * Liquidity tokens: supply/borrow rates, utilization, TVL.
 * GET /{chainId}/liquidity/tokens
 */
async function fetchLiquidityTokens(chain) {
  try {
    const items = await fetchJson(`${API_BASE}/${chain.id}/liquidity/tokens`);

    return items.map((t) => ({
      chain: chain.name,
      chainId: chain.id,
      type: 'liquidity',
      symbol: t.symbol,
      name: t.name,
      address: t.address,
      decimals: t.decimals,
      price: parseFloat(t.price || '0'),
      supplyRate: parseInt(t.supplyRate || '0'),
      borrowRate: parseInt(t.borrowRate || '0'),
      totalSupply: t.totalSupply || '0',
      totalBorrow: t.totalBorrow || '0',
      totalSupplyUsd:
        parseFloat(t.price || '0') *
        (parseInt(t.totalSupply || '0') / Math.pow(10, t.decimals || 18)),
      totalBorrowUsd:
        parseFloat(t.price || '0') *
        (parseInt(t.totalBorrow || '0') / Math.pow(10, t.decimals || 18)),
      utilization: parseInt(t.lastStoredUtilization || '0'),
      maxUtilization: parseInt(t.maxUtilization || '10000'),
      fee: parseInt(t.fee || '0'),
    }));
  } catch (error) {
    log.error(`[${chain.name}] Liquidity fetch failed: ${error.message}`);
    return [];
  }
}

/**
 * Fetch everything across all chains in parallel.
 */
export async function fetchAllData() {
  const results = await Promise.allSettled(
    CHAINS.map(async (chain) => {
      const [lending, liquidity] = await Promise.all([
        fetchLendingTokens(chain),
        fetchLiquidityTokens(chain),
      ]);
      return { chain: chain.name, chainId: chain.id, lending, liquidity };
    }),
  );

  const data = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const d = result.value;
      if (d.lending.length > 0 || d.liquidity.length > 0) {
        data[d.chain] = d;
      } else {
        log.warn(`[${d.chain}] No data returned.`);
      }
    } else {
      log.error('Chain fetch failed:', result.reason?.message);
    }
  }

  // Fetch JupLend vaults (Solana)
  try {
    const jupLend = await fetchJupLendVaults();
    if (jupLend && jupLend.liquidity.length > 0) {
      data[jupLend.chain] = jupLend;
    }
  } catch (error) {
    log.error('JupLend fetch failed:', error.message);
  }

  return data;
}
