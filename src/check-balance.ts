import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";

const cdp = new CdpClient();
const account = await cdp.evm.getOrCreateAccount({ name: "parallax-agent" });

console.log(`\nParallax CDP Wallet`);
console.log(`Address:  ${account.address}`);
console.log(`Network:  Base mainnet`);
console.log(`---`);

const { balances } = await cdp.evm.listTokenBalances({
  address: account.address,
  network: "base",
});

if (!balances || balances.length === 0) {
  console.log("Balance:  Empty (no tokens)");
  console.log(`\nSend USDC on Base to ${account.address} to fund the agent.`);
} else {
  for (const b of balances) {
    const symbol = b.token?.symbol ?? "???";
    const decimals = (b.amount as any)?.decimals ?? 18;
    const rawStr = String((b.amount as any)?.amount ?? "0");
    const raw = BigInt(rawStr);
    const divisor = BigInt(10 ** decimals);
    const whole = raw / divisor;
    const frac = (raw % divisor).toString().padStart(decimals, "0").replace(/0+$/, "") || "0";
    console.log(`${symbol.padEnd(6)} ${whole}.${frac}`);
  }
}
console.log();
