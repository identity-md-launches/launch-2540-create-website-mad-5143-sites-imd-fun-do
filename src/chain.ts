import {
  createPublicClient,
  fallback,
  http,
  parseAbi,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
export const TOKEN = "0x287676ea314f09b7269d0e3db3ea54bd440f66a2" as Address;
export const FWA = "0xa0df17b5ac76ababa36e1450e2cbcd18a620c845" as Address;
export const POOL_ID =
  "0xc0b4c30da1542a9f998e27c616ca7cf528e83abe3cd8950d2b607ba0a76c0fc5";
export const POOL_KEY = {
  currency0: TOKEN,
  currency1: FWA,
  fee: 12500,
  tickSpacing: 60,
  hooks: "0x784ff9a3ac5d88a30bfff6f7f2a270161fbe6000" as Address,
} as const;
export const ROUTER = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af" as Address;
export const QUOTER = "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203" as Address;
export const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3" as Address;
export const POOL_MANAGER =
  "0x000000000004444c5dc75cb358380d2e3de08a90" as Address;
export const PUBLIC_RPC = "https://ethereum-rpc.publicnode.com";
export const client = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [
      http(PUBLIC_RPC, { timeout: 12_000, retryCount: 1 }),
      http("https://eth.merkle.io", { timeout: 12_000, retryCount: 1 }),
    ],
    { rank: false },
  ),
});
export const quoterAbi = parseAbi([
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)",
]);
export const permitAbi = parseAbi([
  "function allowance(address user,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
export const routerAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
export const stateAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)",
]);
export const STATE_VIEW =
  "0x7ffe42c4a5deea5b0fec41c94c136cf115597227" as Address;
export const EXPLORER = `https://etherscan.io/token/${TOKEN}`;
export const DEX_URL = `https://dexscreener.com/ethereum/${POOL_ID}`;
export const LAUNCH_URL =
  "https://explorer.imd.fun/jobs/6072fbc0-bc06-482a-8cec-68d703d51e17";
export const UNISWAP_URL = `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=${FWA}&outputCurrency=${TOKEN}`;
