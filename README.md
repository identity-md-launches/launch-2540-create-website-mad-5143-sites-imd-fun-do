# MAD trading site

A responsive trading terminal for Mutually Assured Destruction (MAD) on Ethereum. The full contract address is visible and copyable. The buy/sell panel quotes and executes the deployed MAD/FWA Uniswap v4 pool directly.

- MAD: `0x287676ea314f09b7269d0e3db3ea54bd440f66a2`
- Ethereum mainnet, chain ID `1`.
- Buy MAD with FWA; sell MAD for FWA. ETH pays network fees. An external “Get FWA on Uniswap” link is provided in the FWA explanation.
- Pool fee: **1.25%**, included in on-chain quotes. Slippage defaults to 1%, with 0.5% and 2% alternatives.
- Static export: **`dist/index.html`** plus locally bundled scripts, styles, fonts, wallet marks, favicon and share image. Vite uses `base: './'`; navigation uses page anchors.

Requested publishing names: `mad-5143.sites.imd.fun` or `mad-5143.identitymd.eth.limo`. Hosting and domain assignment happen through the network after review. This delivery does not claim either domain is already live.

## Install, run and rebuild

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

Vite prints the local development or preview URL. The publisher serves the existing `dist/` directory. Rebuild after changing source or public assets. No backend, environment file, private API key, wallet key, or WalletConnect project ID is needed. Normal npm installation uses the public package registry; dependency archives are not included in the delivery.

Source is in `src/`; `public/assets/` contains the custom vector mark, 1200×630 share PNG and wallet marks. `DESIGN.md` documents the final design system. `VALIDATION.md` records the checks, findings and limitations.

## Trading behavior

The browser reads Ethereum using public RPC services and fetches indicative USD market data from DexScreener. Failed market reads are shown as unavailable, or explicitly marked as a failed update with the last successful timestamp. USD values are never used to construct a swap.

A visitor can request a quote before connecting a wallet. The wallet control supports EIP-6963 extension discovery, mobile wallet-app links and Coinbase Smart Wallet through the Coinbase SDK. Named extension wallets hide the generic “Browser wallet” row. On another network the control offers a switch to Ethereum. Connections reconnect through wagmi’s browser storage.

Reviewing a trade checks the input, balance, wallet, chain and quote age. A review shows estimated output, minimum received, slippage, pool fee and the separate ETH network fee. Quotes expire after 60 seconds and require refresh. Amounts use exact 18-decimal integers; values outside the router’s uint128 range are rejected.

The review requests only the approvals actually needed:

1. ERC-20 approval of the exact input amount to Permit2, if the existing allowance is insufficient. FWA already exposes an unlimited Permit2 allowance, so this approval is skipped for FWA.
2. Permit2 approval of the exact input amount to the Universal Router, expiring in 30 minutes, if needed.
3. A simulated `V4_SWAP` with `SWAP_EXACT_IN_SINGLE`, `SETTLE_ALL`, and `TAKE_ALL`, enforcing minimum received and a five-minute transaction deadline.

Each transaction requires its own explicit button activation and wallet confirmation. Pending transactions disable repeat submissions; delayed confirmations offer a check-confirmation action. Confirmed transactions link to Etherscan. Cancelled or replaced transactions are not reported as successful swaps. Wallet or chain changes are checked again before sending. A page reload clears the in-progress review; check your wallet or transaction link before starting a replacement trade.

The interface is a direct MAD/FWA route. It does not provide an ETH-to-MAD multihop route or manufacture liquidity when a quote fails.

## Contract provenance

The deployed pool’s `Initialize` event at Ethereum block **26,257,574** was read and checked against the locally calculated pool ID. Both assets report 18 decimals. Pool parameters and deployment addresses are centralized in `src/chain.ts`.

| Contract / parameter                                | Value                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| FWA                                                 | `0xa0df17b5ac76ababa36e1450e2cbcd18a620c845`                         |
| Pool ID                                             | `0xc0b4c30da1542a9f998e27c616ca7cf528e83abe3cd8950d2b607ba0a76c0fc5` |
| PoolManager                                         | `0x000000000004444c5dc75cb358380d2e3de08a90`                         |
| Initialization hook                                 | `0x784ff9a3ac5d88a30bfff6f7f2a270161fbe6000`                         |
| Universal Router, original v4-compatible deployment | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af`                         |
| V4 Quoter, matching original deployment             | `0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203`                         |
| Permit2                                             | `0x000000000022d473030f116ddee9f6b43ac78ba3`                         |
| Fee / tick spacing                                  | `12500` / `60`                                                       |

Sources: [MAD’s published launch](https://explorer.imd.fun/jobs/6072fbc0-bc06-482a-8cec-68d703d51e17), [published launch manifest](https://github.com/identity-md-launches/launch-2516-mutually-assured-destruction/blob/main/launch.json), [Uniswap’s deployment history](https://github.com/Uniswap/contracts/blob/main/deployments/1.md), [official v4 routing guide](https://developers.uniswap.org/docs/protocols/v4/guides/swapping/routing), [MAD/FWA market](https://dexscreener.com/ethereum/0xc0b4c30da1542a9f998e27c616ca7cf528e83abe3cd8950d2b607ba0a76c0fc5).

Public browser RPCs are `https://ethereum-rpc.publicnode.com` and viem’s Ethereum fallback `https://eth.merkle.io`. RPC reads and quote availability depend on those services and Ethereum. [PublicNode](https://ethereum.publicnode.com/) answered an origin preflight for the requested site with HTTP 204 and allowed POST/content-type requests. During local validation, chain reads used the worker-provided service for this public chain. No private or machine-local upstream address is embedded in the delivered site.

## Validation

Actual results on this delivery:

- `npm run typecheck`: passed.
- `npm test`: 7 tests passed, including amount boundaries, pool-key identity, slippage rounding and both swap encodings.
- `npm run build`: passed; static assets use relative URLs. Vite emits an externalized `node:worker_threads` warning from an unused dependency path; Ethereum browser interactions passed.
- Chromium: rendered the production export under `/preview/`; checked 320, 390, 720, 860, 1080 and 1440px widths, primary interactions, wallet states and accessibility. Automated axe checks reported no WCAG A/AA violations in the tested page state.
- Local Ethereum fork: actual deployed token, Permit2, router, hook and pool code completed buy and sell transactions. The browser fixture exercised the real interface with a simulated EIP-6963 provider and fork-only transactions. No live funds or wallet signatures were used.
- Pinned `taste@1`: all **16/16** checks passed after corrections.

The durable browser and fork validation scripts accept an optional RPC URL. They use a bounded local preview and stop their browser/server/fork processes on completion. To repeat with the supplied browser runtime and Anvil available:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node scripts/validate-browser.mjs /opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs https://ethereum-rpc.publicnode.com --fork
node --import tsx scripts/validate-fork.mjs https://ethereum-rpc.publicnode.com
```

Omit `--fork` for browser checks without fork transactions. The browser script uses the provided Playwright module; it installs no additional browsers. It writes temporary screenshots and a report to `test/scratch/`, which is excluded from delivery. The pinned probe is an assignment input and is removed after submission; its recorded result is retained in `reports/taste-summary.json`.

The share card can be regenerated after a build using `scripts/create-share.mjs` with a Playwright module path as its first argument, then rebuilding to copy the PNG into `dist/`.

Unperformed checks: Safari/WebKit (launch reported a missing executable), physical phones, native browser zoom, screen readers, hardware wallets, actual wallet-app deep-link opening, Coinbase passkey creation and mainnet signing. Reduced motion, narrow-viewport reflow, keyboard modal behavior and extension-provider discovery were exercised in Chromium. These checks are the worker’s report, not independent certification.

## Attribution

The custom MAD radiation mark is a site illustration, not a claim to be the token’s official published logo. Wallet marks are from [RainbowKit](https://github.com/rainbow-me/rainbowkit) and the supplied wallet connector reference. The [Rabby app link format](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts) uses `_cmd=open-dapp` and `dapp`.

Design guidance is adapted from Jakub Krehel’s [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), MIT. Design documentation guidance is adapted from Paul Bakaus’s [Impeccable](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), Apache-2.0. Combined notices and licenses are retained in `LICENSES/Better-Interface.txt`. Font OFL notices and RainbowKit’s MIT license are also in `LICENSES/`.
