// Test: Fetch JupLend vault data and inspect structure
import 'dotenv/config';
import { Client } from '@jup-ag/lend/api';

const apiKey = process.env.JUP_API_KEY;
if (!apiKey) {
  console.error('Missing JUP_API_KEY in .env');
  process.exit(1);
}

async function main() {
  const client = new Client({ apiKey });
  console.log('Fetching JupLend vaults...\n');

  const vaults = await client.borrow.getVaults();
  console.log(`Found ${vaults.length} vaults\n`);

  // Print first 3 vault structures in detail
  for (let i = 0; i < Math.min(3, vaults.length); i++) {
    console.log(`=== Vault ${i + 1} ===`);
    console.log(JSON.stringify(vaults[i], null, 2));
    console.log('');
  }

  // Summary of all vaults with meaningful data
  console.log('\n=== ALL VAULTS SUMMARY ===\n');
  for (const v of vaults) {
    const name = v.metadata?.name || v.name || 'unknown';
    const supplySymbol = v.supplyToken?.uiSymbol || v.supplyToken?.symbol || '?';
    const borrowSymbol = v.borrowToken?.uiSymbol || v.borrowToken?.symbol || '?';
    const supplyRate = v.supplyRate != null ? (Number(v.supplyRate) / 100).toFixed(2) : 'n/a';
    const borrowRate = v.borrowRate != null ? (Number(v.borrowRate) / 100).toFixed(2) : 'n/a';
    const totalSupply = v.totalSupply || 0;
    const totalBorrow = v.totalBorrow || 0;
    const supplyPrice = v.supplyToken?.price || 0;
    const borrowPrice = v.borrowToken?.price || 0;
    const supplyDecimals = v.supplyToken?.decimals || 0;
    const borrowDecimals = v.borrowToken?.decimals || 0;
    const supplyUsd = (Number(totalSupply) / Math.pow(10, supplyDecimals)) * supplyPrice;
    const borrowUsd = (Number(totalBorrow) / Math.pow(10, borrowDecimals)) * borrowPrice;

    console.log(`${name} (${supplySymbol}/${borrowSymbol}): supply ${supplyRate}% | borrow ${borrowRate}% | TVL $${(supplyUsd / 1e6).toFixed(2)}M | Borrows $${(borrowUsd / 1e6).toFixed(2)}M`);
  }
}

main().catch(console.error);
