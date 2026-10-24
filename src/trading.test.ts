import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeAbiParameters, parseAbiParameters, parseUnits } from "viem";
import { TOKEN, FWA, POOL_ID } from "./chain";
import {
  parseAmount,
  minimumOutput,
  swapInput,
  computedPoolId,
  MAX_INPUT,
  readableError,
} from "./trading";
test("amounts preserve exact 18-decimal values and reject invalid or out-of-range inputs", () => {
  assert.equal(parseAmount("0.000000000000000001"), 1n);
  assert.equal(parseAmount(".5"), parseUnits("0.5", 18));
  assert.equal(parseAmount("10."), parseUnits("10", 18));
  for (const value of [
    "",
    "0",
    "-1",
    "+1",
    "1e3",
    "1,000",
    "NaN",
    "Infinity",
    "0.0000000000000000001",
    " 10 ",
    "1.2.3",
    "9".repeat(80),
  ])
    assert.equal(parseAmount(value), undefined, value);
  assert.equal(
    parseAmount("340282366920938463463.374607431768211455"),
    MAX_INPUT,
  );
  assert.equal(
    parseAmount("340282366920938463463.374607431768211456"),
    undefined,
  );
});
test("pool key hashes to the observed Ethereum Initialize event pool id", () =>
  assert.equal(computedPoolId, POOL_ID));
test("minimum received rounds down, never grants more slippage, and refuses unknown settings", () => {
  assert.equal(minimumOutput(10001n, 100), 9900n);
  assert.equal(minimumOutput(10_000n, 50), 9950n);
  assert.equal(minimumOutput(10_000n, 200), 9800n);
  assert.throws(() => minimumOutput(10n, 9999));
});
for (const side of ["buy", "sell"] as const)
  test(`${side} encoding settles the correct input, collects output, and enforces the minimum twice`, () => {
    const amount = parseUnits("10", 18),
      minimum = parseUnits("5", 18);
    const [actions, params] = decodeAbiParameters(
      parseAbiParameters("bytes actions,bytes[] params"),
      swapInput(side, amount, minimum),
    );
    assert.equal(actions, "0x060c0f");
    const [swap] = decodeAbiParameters(
      parseAbiParameters(
        "((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)",
      ),
      params[0],
    );
    assert.equal(swap.zeroForOne, side === "sell");
    assert.equal(swap.amountIn, amount);
    assert.equal(swap.amountOutMinimum, minimum);
    assert.equal(swap.hookData, "0x");
    const [settleCurrency, maximumInput] = decodeAbiParameters(
      parseAbiParameters("address,uint256"),
      params[1],
    );
    const [takeCurrency, minimumReceived] = decodeAbiParameters(
      parseAbiParameters("address,uint256"),
      params[2],
    );
    assert.equal(
      settleCurrency.toLowerCase(),
      (side === "buy" ? FWA : TOKEN).toLowerCase(),
    );
    assert.equal(
      takeCurrency.toLowerCase(),
      (side === "buy" ? TOKEN : FWA).toLowerCase(),
    );
    assert.equal(maximumInput, amount);
    assert.equal(minimumReceived, minimum);
  });
test("unsafe router input bounds fail before encoding", () => {
  for (const amount of [0n, -1n, MAX_INPUT + 1n])
    assert.throws(() => swapInput("buy", amount, 1n));
  for (const minimum of [0n, -1n, MAX_INPUT + 1n])
    assert.throws(() => swapInput("buy", 1n, minimum));
});
test("wallet errors are recoverable without exposing raw RPC request data", () => {
  assert.match(
    readableError(new Error("User rejected request 4001")),
    /declined/,
  );
  assert.match(readableError(new Error("insufficient funds")), /ETH/);
  assert.match(readableError(new Error("chain mismatch")), /Ethereum/);
  assert.match(readableError(new Error("HTTP timeout")), /connection/);
  assert.match(
    readableError(new Error("execution reverted")),
    /smaller amount/,
  );
});
