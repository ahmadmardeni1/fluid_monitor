import { Client } from '@jup-ag/lend/api';
import { log } from '../utils/logger.js';

/**
 * Fetch JupLend vault data and normalize to match Fluid's liquidity token format.
 *
 * Each vault becomes a "liquidity token" with:
 *   symbol, address, supplyRate, borrowRate, totalSupplyUsd, totalBorrowUsd, utilization
 */
export async function fetchJupLendVaults() {
  const apiKey = process.env.JUP_API_KEY;
  if (!apiKey) {
    log.warn('JUP_API_KEY not set — skipping JupLend.');
    return null;
  }

  try {
    const client = new Client({ apiKey });
    const vaults = await client.borrow.getVaults();

    const liquidity = vaults.map((v) => {
      const supplySymbol = v.supplyToken?.uiSymbol || v.supplyToken?.symbol || '?';
      const borrowSymbol = v.borrowToken?.uiSymbol || v.borrowToken?.symbol || '?';
      const supplyDecimals = v.supplyToken?.decimals || 0;
      const borrowDecimals = v.borrowToken?.decimals || 0;
      const supplyPrice = parseFloat(v.supplyToken?.price || '0');
      const borrowPrice = parseFloat(v.borrowToken?.price || '0');

      const totalSupplyRaw = Number(v.totalSupply || 0);
      const totalBorrowRaw = Number(v.totalBorrow || 0);

      const totalSupplyUsd = (totalSupplyRaw / Math.pow(10, supplyDecimals)) * supplyPrice;
      const totalBorrowUsd = (totalBorrowRaw / Math.pow(10, borrowDecimals)) * borrowPrice;

      // Utilization in bps (same scale as Fluid: value / 100 = %)
      const utilization = totalSupplyUsd > 0
        ? Math.round((totalBorrowUsd / totalSupplyUsd) * 10000)
        : 0;

      return {
        chain: 'JupLend',
        chainId: 'solana',
        type: 'liquidity',
        symbol: `${supplySymbol}/${borrowSymbol}`,
        address: v.address,
        supplyRate: Number(v.supplyRate || 0),
        borrowRate: Number(v.borrowRate || 0),
        totalSupplyUsd,
        totalBorrowUsd,
        utilization,
        totalPositions: v.totalPositions || 0,
      };
    });

    log.info(`[JupLend] Fetched ${liquidity.length} vaults.`);
    return {
      chain: 'JupLend',
      chainId: 'solana',
      lending: [],
      liquidity,
    };
  } catch (error) {
    log.error(`[JupLend] Fetch failed: ${error.message}`);
    return null;
  }
}
