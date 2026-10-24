import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  parseUnits,
} from "viem";
import { mainnet } from "viem/chains";
const require = createRequire(import.meta.url);
const { chromium, webkit } = await import(process.argv[2] || "playwright");
const upstream = process.argv[3] || "https://ethereum-rpc.publicnode.com";
const withFork = process.argv.includes("--fork");
const account = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x287676ea314f09b7269d0e3db3ea54bd440f66a2";
const FWA = "0xa0df17b5ac76ababa36e1450e2cbcd18a620c845";
const poolManager = "0x000000000004444c5dc75cb358380d2e3de08a90";
let fork;
let nodeFailed = false;
if (withFork) {
  fork = spawn(
    "anvil",
    [
      "--silent",
      "--accounts",
      "0",
      "--auto-impersonate",
      "--fork-url",
      upstream,
      "--port",
      "18547",
    ],
    { stdio: "ignore" },
  );
  fork.on("error", () => {
    nodeFailed = true;
  });
}
const rpcUrl = withFork ? "http://127.0.0.1:18547" : upstream;
const rpc = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl, { retryCount: 0, timeout: 30_000 }),
});
const wallet = createWalletClient({
  chain: mainnet,
  transport: http(rpcUrl),
  account,
});
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://test.invalid").pathname,
    );
    const file = resolve(
      root,
      pathname.replace(/^\/preview\//, "") || "index.html",
    );
    if (!file.startsWith(root + "/")) {
      res.writeHead(404).end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": types[extname(file)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/index.html`;
const browsers = [];
const results = [];
let currentPage;
async function request(payload) {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  return r.json();
}
try {
  if (withFork) {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try {
        await rpc.getBlockNumber();
        ready = true;
        break;
      } catch {
        if (nodeFailed) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    assert(ready, "Anvil fork starts");
    await rpc.request({
      method: "anvil_setBalance",
      params: [account, "0x56bc75e2d63100000"],
    });
    const hash = await wallet.writeContract({
      account: poolManager,
      address: FWA,
      abi: erc20Abi,
      functionName: "transfer",
      args: [account, parseUnits("100", 18)],
      gas: 100000n,
    });
    assert.equal(
      (await rpc.waitForTransactionReceipt({ hash })).status,
      "success",
    );
  }
  for (const [engine, launcher] of [
    ["Chromium", chromium],
    ["WebKit", webkit],
  ]) {
    let browser;
    try {
      browser = await launcher.launch({ headless: true });
      browsers.push(browser);
    } catch (e) {
      results.push({
        engine,
        status: "unavailable",
        reason: e.message.split("\n")[0],
      });
      continue;
    }
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions:
        engine === "Chromium" ? ["clipboard-read", "clipboard-write"] : [],
    });
    let offline = false;
    await context.route(
      /^https:\/\/(ethereum-rpc\.publicnode\.com|eth\.merkle\.io)/,
      async (route) => {
        if (offline) {
          await route.fulfill({ status: 503, body: "Offline test" });
          return;
        }
        try {
          const result = await request(route.request().postDataJSON());
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(result),
          });
        } catch {
          await route.fulfill({ status: 503, body: "RPC unavailable" });
        }
      },
    );
    const page = await context.newPage();
    currentPage = page;
    console.log(engine, "testing responsive layout and primary interactions");
    const errors = [];
    const localFailures = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(new URL(url).origin) && r.status() >= 400)
        localFailures.push(r.url());
    });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector("#trade");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "200%"),
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${engine}: no overflow at 200% text / ${width}`,
      );
      await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    }
    for (const width of [320, 390, 720, 860, 1080, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${engine}: no overflow at ${width}`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const submit = page.getByRole("button", {
      name: "Review buy",
      exact: true,
    });
    assert(
      (await submit.boundingBox()).y + (await submit.boundingBox()).height <=
        844,
      `${engine}: main action above fold`,
    );
    await submit.click();
    assert.equal(
      await page.locator("#amount").getAttribute("aria-invalid"),
      "true",
    );
    assert(
      await page
        .locator("#amount")
        .evaluate((el) => el === document.activeElement),
    );
    await page.getByRole("button", { name: "10", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#receive").textContent !== "0.00",
      null,
      { timeout: 60_000 },
    );
    assert(Number(await page.locator("#receive").textContent()) > 0);
    if (engine === "Chromium") {
      offline = true;
      await page.locator("#amount").fill("17");
      await page
        .getByText("Quote unavailable. Try a smaller amount or refresh.", {
          exact: true,
        })
        .waitFor({ timeout: 60_000 });
      offline = false;
      await page
        .getByRole("button", { name: "Refresh quote", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector("#receive").textContent !== "0.00",
        null,
        { timeout: 60_000 },
      );
    }
    await page.getByRole("button", { name: "Trade settings" }).click();
    await page.getByRole("radio", { name: "0.5%", exact: true }).check();
    assert.equal(
      await page.getByRole("radio", { name: "0.5%", exact: true }).isChecked(),
      true,
    );
    await page.getByRole("button", { name: "Trade settings" }).click();
    await page.getByRole("button", { name: "Sell", exact: true }).click();
    assert.equal(await page.locator("#amount").inputValue(), "");
    await page.getByRole("button", { name: "1,000", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#receive").textContent !== "0.00",
      null,
      { timeout: 60_000 },
    );
    await page
      .getByRole("button", { name: "Review sell", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Connect a wallet" }).waitFor();
    assert(
      await page
        .getByRole("button", { name: "Coinbase Wallet", exact: true })
        .isVisible(),
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      dialog: !!document.activeElement?.closest("dialog"),
    }));
    assert(focused.dialog, `${engine}: focus remains in modal`);
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Connect", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    if (engine === "Chromium") {
      await page.getByRole("button", { name: "Copy contract address" }).click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        TOKEN,
      );
    }
    await page.locator("summary").filter({ hasText: "What is FWA?" }).click();
    assert(
      await page
        .getByText(
          "Fake World Assets (FWA) is the other token in MAD’s liquidity pool.",
          { exact: false },
        )
        .isVisible(),
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".primary")
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration),
      "0s",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
      }));
    });
    assert.equal(
      axe.length,
      0,
      `${engine}: axe violations ${JSON.stringify(axe)}`,
    );
    await page.screenshot({
      path: `test/scratch/${engine.toLowerCase()}-390.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: `test/scratch/${engine.toLowerCase()}-1440.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(localFailures, []);
    results.push({
      engine,
      status: "passed",
      checks:
        "static subpath, 6 widths, first-screen action, validation/focus, presets, both live quotes, settings, RPC failure/retry, wallet dialog, keyboard, FAQ, reduced motion, axe, no page/local-resource errors",
    });
    if (engine === "Chromium") {
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      });
      const m = await mobile.newPage();
      currentPage = m;
      await m.goto(url);
      await m.getByRole("button", { name: "Connect", exact: true }).click();
      for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
        assert(
          await m
            .getByRole("link", { name: `Open in ${name}`, exact: true })
            .isVisible(),
        );
      assert(
        await m
          .getByRole("button", { name: "Coinbase Smart Wallet", exact: true })
          .isVisible(),
      );
      assert.equal(
        await m
          .getByRole("button", { name: "Browser wallet", exact: true })
          .count(),
        0,
      );
      const rabby = new URL(
        await m
          .getByRole("link", { name: "Open in Rabby", exact: true })
          .getAttribute("href"),
      );
      assert.equal(rabby.searchParams.get("_cmd"), "open-dapp");
      assert.equal(rabby.searchParams.get("dapp"), url);
      await m.screenshot({ path: "test/scratch/mobile-wallet-sheet.png" });
      results.push({
        engine: "Chromium phone emulation",
        status: "passed",
        checks:
          "four wallet-app links use current page, Coinbase Smart Wallet, no generic injected row; actual app opening/passkey creation unperformed",
      });
      await mobile.close();
      currentPage = page;
    }
    // EIP-6963 provider fixture exercises the real UI without keys or a live signing wallet.
    if (withFork && engine === "Chromium") {
      const test = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await test.route(
        /^https:\/\/(ethereum-rpc\.publicnode\.com|eth\.merkle\.io)/,
        async (route) => {
          const result = await request(route.request().postDataJSON());
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(result),
          });
        },
      );
      await test.exposeBinding(
        "testWalletRpc",
        async (_source, { method, params }) => {
          if (method === "eth_sendTransaction") {
            const tx = params[0];
            if (!tx.gas) {
              const estimate = await rpc.request({
                method: "eth_estimateGas",
                params: [tx],
              });
              tx.gas = "0x" + ((BigInt(estimate) * 130n) / 100n).toString(16);
            }
          }
          const result = await request({
            jsonrpc: "2.0",
            id: 1,
            method,
            params: params || [],
          });
          if (result.error) throw Error(result.error.message);
          return result.result;
        },
      );
      await test.addInitScript(
        ({ account }) => {
          const listeners = {};
          let connected = false;
          let chain = "0x5";
          const provider = {
            request: async ({ method, params }) => {
              if (method === "eth_requestAccounts") {
                if (window.__rejectWallet) {
                  const e = new Error("User rejected request");
                  e.code = 4001;
                  throw e;
                }
                connected = true;
                return [account];
              }
              if (method === "eth_sendTransaction" && window.__rejectTx) {
                const e = new Error("User rejected request");
                e.code = 4001;
                throw e;
              }
              if (method === "eth_accounts") return connected ? [account] : [];
              if (method === "eth_chainId") return chain;
              if (
                method === "wallet_switchEthereumChain" ||
                method === "wallet_addEthereumChain"
              ) {
                chain = params[0].chainId;
                (listeners.chainChanged || []).forEach((f) => f(chain));
                return null;
              }
              if (method === "wallet_getCapabilities") return {};
              if (method === "wallet_requestPermissions")
                return [{ parentCapability: "eth_accounts" }];
              return window.testWalletRpc({ method, params });
            },
            on: (event, fn) => {
              (listeners[event] ||= []).push(fn);
            },
            removeListener: (event, fn) => {
              listeners[event] = (listeners[event] || []).filter(
                (f) => f !== fn,
              );
            },
          };
          window.__setTestChain = (value) => {
            chain = value;
            (listeners.chainChanged || []).forEach((f) => f(chain));
          };
          window.ethereum = provider;
          const announce = () =>
            window.dispatchEvent(
              new CustomEvent("eip6963:announceProvider", {
                detail: {
                  info: {
                    uuid: "11111111-1111-4111-8111-111111111111",
                    name: "Test browser wallet",
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="blue"/></svg>',
                    rdns: "test.mad.wallet",
                  },
                  provider,
                },
              }),
            );
          window.addEventListener("eip6963:requestProvider", announce);
          announce();
        },
        { account },
      );
      const p = await test.newPage();
      currentPage = p;
      console.log("Chromium testing wallet and fork transactions");
      await p.goto(url);
      await p.getByRole("button", { name: "Connect", exact: true }).click();
      assert.equal(
        await p
          .getByRole("button", { name: "Browser wallet", exact: true })
          .count(),
        0,
      );
      await p.evaluate(() => (window.__rejectWallet = true));
      await p
        .getByRole("button", { name: "Test browser wallet", exact: true })
        .click();
      await p
        .getByText("Request declined in your wallet. You can try again.")
        .waitFor();
      await p.evaluate(() => (window.__rejectWallet = false));
      await p
        .getByRole("button", { name: "Test browser wallet", exact: true })
        .click();
      await p.waitForFunction(() => !document.querySelector("dialog[open]"));
      // wagmi requests Ethereum as part of connection; the provider fixture handles its switch.
      await p.evaluate(() => window.__setTestChain("0x5"));
      const switchControl = p.getByRole("banner").getByRole("button", {
        name: "Switch to Ethereum",
        exact: true,
      });
      await switchControl.waitFor();
      await switchControl.click();
      await p.getByRole("button", { name: "10", exact: true }).click();
      await p.waitForFunction(
        () => document.querySelector("#receive").textContent !== "0.00",
        null,
        { timeout: 60_000 },
      );
      await p
        .getByText("Balance: 100", { exact: true })
        .waitFor({ timeout: 60_000 });
      await p.locator("#amount").fill("1000");
      await p.getByRole("button", { name: "Review buy", exact: true }).click();
      await p
        .getByText(
          "Not enough FWA. Enter a smaller amount or add FWA to your wallet.",
          { exact: true },
        )
        .waitFor();
      await p.getByRole("button", { name: "10", exact: true }).click();
      await p.waitForFunction(
        () => document.querySelector("#receive").textContent !== "0.00",
        null,
        { timeout: 60_000 },
      );
      await p.getByRole("button", { name: "Review buy", exact: true }).click();
      await p.getByRole("dialog", { name: "Review buy" }).waitFor();
      await p
        .getByRole("button", { name: "Allow this trade", exact: true })
        .waitFor({ timeout: 60_000 });
      await p.clock.install();
      await p.clock.fastForward(61_000);
      await p
        .getByRole("dialog", { name: "Review buy" })
        .getByRole("button", { name: "Refresh quote", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Allow this trade", exact: true })
        .waitFor({ timeout: 60_000 });
      await p.evaluate(() => (window.__rejectTx = true));
      await p
        .getByRole("button", { name: "Allow this trade", exact: true })
        .click();
      await p
        .getByRole("dialog")
        .getByText("Request declined in your wallet. You can try again.", {
          exact: true,
        })
        .waitFor();
      await p.evaluate(() => (window.__rejectTx = false));
      await p
        .getByRole("button", { name: "Allow this trade", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Buy MAD", exact: true })
        .waitFor({ timeout: 60_000 });
      await p.getByRole("button", { name: "Buy MAD", exact: true }).click();
      await p
        .getByText("Buy confirmed on Ethereum.", { exact: true })
        .waitFor({ timeout: 90_000 });
      await p.getByRole("button", { name: "Sell", exact: true }).click();
      await p.getByRole("button", { name: "1,000", exact: true }).click();
      await p.waitForFunction(
        () => document.querySelector("#receive").textContent !== "0.00",
        null,
        { timeout: 60_000 },
      );
      await p.getByRole("button", { name: "Review sell", exact: true }).click();
      await p
        .getByRole("button", { name: "Approve MAD", exact: true })
        .waitFor({ timeout: 60_000 });
      await p.getByRole("button", { name: "Approve MAD", exact: true }).click();
      await p
        .getByRole("button", { name: "Allow this trade", exact: true })
        .waitFor({ timeout: 60_000 });
      await p
        .getByRole("button", { name: "Allow this trade", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Sell MAD", exact: true })
        .waitFor({ timeout: 60_000 });
      await p.getByRole("button", { name: "Sell MAD", exact: true }).click();
      await p
        .getByText("Sell confirmed on Ethereum.", { exact: true })
        .waitFor({ timeout: 90_000 });
      const mad = await rpc.readContract({
        address: TOKEN,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      });
      assert(mad > 0n, "Fork buy leaves MAD after selling 1000");
      results.push({
        engine: "Chromium + local Ethereum fork",
        status: "passed",
        checks:
          "named EIP-6963 wallet, generic provider hidden, connection and signing rejection/retry, wrong-chain switch, insufficient balance, quote expiry/refresh, FWA permit, buy receipt, MAD approval, permit, sell receipt; deployed router and pool; no live funds",
      });
      await test.close();
    }
    await context.close();
  }
  await writeFile(
    "test/scratch/browser-results.json",
    JSON.stringify({ results }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ results }, null, 2));
} catch (e) {
  console.error(e.message);
  if (currentPage) {
    await currentPage
      .screenshot({ path: "test/scratch/browser-failure.png", fullPage: true })
      .catch(() => {});
    console.error((await currentPage.locator("body").innerText()).slice(-2500));
  }
  process.exitCode = 1;
} finally {
  for (const b of browsers) await b.close();
  server.close();
  fork?.kill("SIGTERM");
}
