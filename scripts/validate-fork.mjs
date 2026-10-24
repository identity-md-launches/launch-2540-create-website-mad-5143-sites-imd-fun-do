import { spawn } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  parseUnits,
  formatUnits,
} from "viem";
import { mainnet } from "viem/chains";
import {
  TOKEN,
  FWA,
  POOL_MANAGER,
  PERMIT2,
  ROUTER,
  QUOTER,
  POOL_KEY,
  quoterAbi,
  permitAbi,
  routerAbi,
} from "../src/chain.ts";
import { swapInput, minimumOutput } from "../src/trading.ts";
const node = spawn(
  "anvil",
  [
    "--silent",
    "--accounts",
    "0",
    "--auto-impersonate",
    "--fork-url",
    process.argv[2] || "https://ethereum-rpc.publicnode.com",
    "--port",
    "18547",
  ],
  { stdio: "ignore" },
);
let failed = false;
node.on("error", () => {
  failed = true;
});
const rpc = createPublicClient({
  chain: mainnet,
  transport: http("http://127.0.0.1:18547", { retryCount: 0, timeout: 30_000 }),
});
const account = "0x1111111111111111111111111111111111111111";
const wallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http("http://127.0.0.1:18547"),
});
async function receipt(hash) {
  const r = await rpc.waitForTransactionReceipt({ hash });
  if (r.status !== "success") {
    const tx = await rpc.getTransaction({ hash });
    console.log("Failed fork transaction", {
      to: tx.to,
      from: tx.from,
      gas: tx.gas.toString(),
      gasUsed: r.gasUsed.toString(),
      input: tx.input.slice(0, 10),
    });
    throw Error("Fork transaction failed");
  }
  return r;
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await rpc.getBlockNumber();
      ready = true;
      break;
    } catch {
      if (failed) break;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (!ready) throw Error("Anvil fork could not start");
  await rpc.request({
    method: "anvil_setBalance",
    params: [account, "0x56bc75e2d63100000"],
  });
  const fwaBalance = await rpc.readContract({
    address: FWA,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [POOL_MANAGER],
  });
  console.log(
    "Fork pool manager FWA sufficient:",
    fwaBalance > parseUnits("100", 18),
  );
  await receipt(
    await wallet.writeContract({
      account: POOL_MANAGER,
      address: FWA,
      abi: erc20Abi,
      functionName: "transfer",
      args: [account, parseUnits("100", 18)],
    }),
  );
  for (const side of ["buy", "sell"]) {
    const inputToken = side === "buy" ? FWA : TOKEN;
    const input =
      side === "buy" ? parseUnits("10", 18) : parseUnits("1000", 18);
    const q = await rpc.simulateContract({
      address: QUOTER,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: POOL_KEY,
          zeroForOne: side === "sell",
          exactAmount: input,
          hookData: "0x",
        },
      ],
    });
    const min = minimumOutput(q.result[0], 100);
    const allowance = await rpc.readContract({
      address: inputToken,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, PERMIT2],
    });
    if (allowance < input)
      await receipt(
        await wallet.writeContract({
          address: inputToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [PERMIT2, input],
          gas: 100000n,
        }),
      );
    console.log(side, "ERC-20 approval required:", allowance < input);
    await receipt(
      await wallet.writeContract({
        address: PERMIT2,
        abi: permitAbi,
        functionName: "approve",
        args: [inputToken, ROUTER, input, Math.floor(Date.now() / 1000) + 1800],
        gas: 100000n,
      }),
    );
    const args = [
      "0x10",
      [swapInput(side, input, min)],
      BigInt(Math.floor(Date.now() / 1000) + 300),
    ];
    const sim = await rpc.simulateContract({
      account,
      address: ROUTER,
      abi: routerAbi,
      functionName: "execute",
      args,
    });
    const r = await receipt(
      await wallet.writeContract({ ...sim.request, gas: 500000n }),
    );
    console.log(
      side,
      "fork swap confirmed; minimum output",
      formatUnits(min, 18),
      "gas",
      r.gasUsed.toString(),
    );
  }
  console.log("FORK SWAP VALIDATION PASSED");
} catch (e) {
  console.error(e.shortMessage || e.message);
  process.exitCode = 1;
} finally {
  node.kill("SIGTERM");
}
