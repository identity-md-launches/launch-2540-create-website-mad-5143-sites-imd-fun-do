import {
  encodeAbiParameters,
  parseAbiParameters,
  parseUnits,
  formatUnits,
  keccak256,
  type Hex,
} from "viem";
import { POOL_KEY } from "./chain";
export type Side = "buy" | "sell";
export const MAX_INPUT = (1n << 128n) - 1n;
export const QUOTE_LIFETIME = 60_000;
export function parseAmount(value: string): bigint | undefined {
  if (!/^(?:\d+(?:\.\d{0,18})?|\.\d{1,18})$/.test(value) || value.length > 80)
    return;
  try {
    const n = parseUnits(value, 18);
    return n > 0n && n <= MAX_INPUT ? n : undefined;
  } catch {
    return;
  }
}
export function minimumOutput(output: bigint, slippageBps: number) {
  if (![50, 100, 200].includes(slippageBps))
    throw new Error("Unsupported slippage");
  return (output * BigInt(10_000 - slippageBps)) / 10_000n;
}
export function displayAmount(amount: bigint, digits = 6) {
  const full = formatUnits(amount, 18);
  const [whole, fraction] = full.split(".");
  if (!fraction) return whole;
  const kept = fraction.slice(0, digits).replace(/0+$/, "");
  if (whole === "0" && !kept && amount > 0n)
    return `< 0.${"0".repeat(digits - 1)}1`;
  return kept ? `${whole}.${kept}` : whole;
}
const keyType =
  "(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)";
export const computedPoolId = keccak256(
  encodeAbiParameters(parseAbiParameters(keyType), [POOL_KEY]),
);
export function swapInput(side: Side, amount: bigint, minimum: bigint): Hex {
  if (
    amount <= 0n ||
    amount > MAX_INPUT ||
    minimum <= 0n ||
    minimum > MAX_INPUT
  )
    throw new Error("Amount is outside the supported range");
  const input = side === "sell" ? POOL_KEY.currency0 : POOL_KEY.currency1;
  const output = side === "sell" ? POOL_KEY.currency1 : POOL_KEY.currency0;
  const swap = encodeAbiParameters(
    parseAbiParameters(
      `(${keyType} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`,
    ),
    [
      {
        poolKey: POOL_KEY,
        zeroForOne: side === "sell",
        amountIn: amount,
        amountOutMinimum: minimum,
        hookData: "0x",
      },
    ],
  );
  const settle = encodeAbiParameters(
    parseAbiParameters("address currency,uint256 amount"),
    [input, amount],
  );
  const take = encodeAbiParameters(
    parseAbiParameters("address currency,uint256 minAmount"),
    [output, minimum],
  );
  return encodeAbiParameters(
    parseAbiParameters("bytes actions,bytes[] params"),
    ["0x060c0f", [swap, settle, take]],
  );
}
export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|4001/i.test(message))
    return "Request declined in your wallet. You can try again.";
  if (/insufficient funds/i.test(message))
    return "Keep enough ETH in your wallet for network fees, then try again.";
  if (/chain|network.*mismatch/i.test(message))
    return "Switch your wallet to Ethereum and try again.";
  if (/timeout|fetch|http|network|429/i.test(message))
    return "The network did not respond. Check your connection and try again.";
  if (/revert|execution/i.test(message))
    return "This trade could not be simulated. Refresh the quote or try a smaller amount.";
  return "The request could not be completed. Refresh and try again.";
}
