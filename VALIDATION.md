# Delivery validation

## Scope and assumptions

This is the worker’s validation of the single-page MAD site, the source and the production export in `dist/`. The assignment supplies the token address and desired publishing names. The public launch, deployed Ethereum event and token reads establish the token name, network, MAD/FWA pool and 1.25% pool fee. A direct FWA/MAD route was selected from that actual pool. Domain publication is after review and was not attempted.

The site uses React, TypeScript, Vite, wagmi, viem and the Coinbase SDK. Essential assets are local. Quotes and balances require Ethereum RPC access; indicative USD data requires DexScreener. No deployment handoff was supplied and no contract was deployed or changed.

## Checks and results

| Check                          | Actual result                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript `npm run typecheck` | Passed                                                                                                                                                        |
| Unit `npm test`                | 7 tests passed, 0 failures                                                                                                                                    |
| Production `npm run build`     | Passed, static export produced                                                                                                                                |
| Pinned `taste@1`               | 16/16 checks passed after corrections; detailed results in `reports/taste-summary.json`                                                                       |
| Export at a subpath            | Chromium loaded `/preview/index.html`, scripts, CSS, fonts, SVGs and PNG from relative URLs; no missing local responses or page exceptions                    |
| Responsive layout              | No horizontal overflow at 320, 390, 720, 860, 1080 and 1440px; probe also checked overlap, clipping and floating controls at its widths                       |
| 200% text enlargement          | CSS root-font enlargement at 320, 390 and 1440px passed after header/footer wrapping correction; this does not claim native browser zoom                      |
| First screen                   | At 390×844, product name, full token contract and Review buy are visible; screenshot viewed                                                                   |
| Rendered accessibility         | axe WCAG 2 A/AA, 2.1 AA and 2.2 AA tags: no violations in the tested normal page state                                                                        |
| Keyboard                       | Invalid amount receives focus; native modal contains focus, closes on Escape and restores focus to the trigger                                                |
| Forms and quotes               | Empty input, preset amounts, side reversal, quote loading, live buy/sell quotes, slippage selection, RPC failure and successful refresh exercised             |
| Wallet discovery               | Named EIP-6963 fixture appears; generic Browser wallet row disappears when a named provider exists; connection rejection returns a recoverable inline message |
| Wrong network                  | Fixture switched to another chain; header displayed Switch to Ethereum and returned to Ethereum through the wallet method                                     |
| Phone wallet sheet             | All four Open in links and Coinbase Smart Wallet present at 390px; no generic Browser wallet row; URLs encode the current page                                |
| Review protections             | Insufficient FWA rejected; 60-second expiry advanced with Playwright’s browser clock; refresh restored confirmation; signing rejection and retry exercised    |
| Executed swaps                 | Actual deployed pool/router/Permit2/token code on a local Ethereum fork completed buy and sell from the browser interface                                     |
| Receipt handling               | Approval and swap pending labels, successful receipts, transaction links and post-swap balances exercised on the fork                                         |
| Reduced motion                 | Chromium emulation: primary action transition duration 0s; probe found no endless animation or `transition: all`                                              |
| Clipboard / FAQ                | Clipboard equaled the exact requested address; FWA disclosure opened and displayed its answer                                                                 |
| Metadata                       | Title, favicon, description, og:title and og:image present; share PNG inspected at 1200×630                                                                   |
| Public RPC CORS                | Origin preflight for the requested domain returned 204, allowed POST/content-type and allowed the origin                                                      |

The production build emits one dependency warning: a `node:worker_threads` import in ox’s unrelated Tempo implementation is externalized for browsers. The delivered Ethereum flow was executed without page exceptions. Coinbase’s SDK is explicitly installed and bundled as a local lazy chunk; its passkey service was not exercised.

## Better Interface coverage

The pinned workflow and the core principles of all six domains were read and applied while building. The final system is documented in `DESIGN.md`.

| Domain        | Coverage and evidence                                                                                                                                                                                                         | Explicit limits                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility | **Checked.** Native buttons/links/labels, fieldsets, output, disclosures and modal; stable status regions; keyboard/focus and axe; 2px visible focus treatment confirmed in keyboard screenshots; disabled and pending states | No screen-reader session, hardware wallet or physical touch-device session; no forced-colors rendered session                                                 |
| Layout        | **Checked.** Shared shell/grid, normal-flow actions, source reading order, responsive widths and actual screenshots; 390px first action confirmed; long full addresses wrap                                                   | 200% CSS text enlargement also checked at 320, 390 and 1440px. Native browser zoom and RTL mirror unperformed; CSS text enlargement is not a native zoom test |
| Writing       | **Checked.** Labels match actual actions, FWA and ETH roles are explicit, quotes are estimates, errors include recovery, pool fee is correct, transaction review exposes minimum received                                     | Live service availability and the requester’s eventual domain assignment are outside this build                                                               |
| Typography    | **Checked.** Local WOFF2, font readiness and rendered screenshots; three families and three weights; 5 sizes at 390px / 6 including single uses at 1440px; tabular values and unclipped contract                              | No broad language/localization suite; interface is English                                                                                                    |
| Colors        | **Checked.** Semantic token review, rendered solid-text probe and measured contrast pairs recorded in DESIGN.md; selected state also has an underline and text                                                                | No second theme exists; the probe’s solid-background measurement does not certify every hypothetical overlay/state                                            |
| UI            | **Checked.** Flat surfaces, consistent controls/icons, hover gating, focus, input/quote errors, wallet loading/rejection, review expiry, pending and success; reduced-motion emulation                                        | Slow-motion animation-panel replay unperformed; there is no staged or continuous animation                                                                    |

## Findings and corrections

| Severity / source                                                  | Observation and impact                                                                                                                                  | Correction and recheck                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High, `package.json:14`                                            | An early export contained a generated throw for unresolved `@coinbase/wallet-sdk`; selecting Coinbase would fail                                        | Installed the SDK explicitly, rebuilt, and confirmed a local 96KB SDK chunk replaced the unresolved module. Final browser checks see the Coinbase row. Passkey creation remains unperformed |
| Medium, `src/App.tsx:190`                                          | The first probe flagged the former “01 /” index as a kicker above the about heading at 1440px. The initial full desktop screenshot confirmed it         | Removed the decorative index and its style. The heading closes up using its existing margin. Final probe: no kicker labels                                                                  |
| Low, `src/App.tsx:192`                                             | A hidden mobile `<br>` joined “what” and “you’re” in the about heading; observed on the 390px screenshot                                                | Added an explicit word space before the desktop break. Rebuilt and checked the final mobile render                                                                                          |
| Medium, `src/components/WalletControl.tsx:30`                      | The initial guessed Rabby URL did not match the current upstream app handler                                                                            | Used the primary Rabby source’s `_cmd=open-dapp&dapp=` format. Mobile browser validation checks both query values and the current-page URL. Actual native-app opening is unperformed        |
| Medium, `src/style.css:175`, the main title and footer utility row | At 320px with CSS text enlarged to 200%, the unwrapped header and footer produced 385px document width; screenshot confirmed controls escaping the page | Enabled wrapping for the header and footer utility groups and allowed the oversized title to wrap. Retested the enlarged page at 320, 390 and 1440px without horizontal overflow            |

Additional source review corrections made before validation: the pending-transaction guard retains unresolved receipts and offers Check confirmation; cancellations/replacements do not produce success; quotes have an explicit expiry; market update failures retain a last-success timestamp rather than presenting cached numbers as newly fetched data. Normal receipt and expiry paths passed the fork UI tests. A separate rendered check induced a market refresh failure and confirmed the last-success timestamp. Forced receipt timeout and replacement/cancellation were not individually induced in the final automated suite.

## Reproduction and evidence

Commands run, with the public RPC spelling shown in place of the worker’s supplied Ethereum service:

```sh
npm run typecheck
npm test
npm run build
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node scripts/validate-browser.mjs /opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs https://ethereum-rpc.publicnode.com --fork
node --import tsx scripts/validate-fork.mjs https://ethereum-rpc.publicnode.com
```

For worker validation, the chain service supplied for Ethereum was used in place of the public RPC above; the displayed public address is the reproducible source, not the machine-local service. The browser script routes RPC reads to that service or the local fork during validation. This exercises real chain/fork responses without claiming direct browser availability of every public fallback. The separate CORS preflight covered the public primary endpoint.

Browser transaction tests use a named EIP-6963 fixture. It has no private key and sends only to a local Anvil fork. The standalone fork script also uses only fork transactions. Both use the deployed Universal Router, Quoter, Permit2 and actual MAD/FWA pool rather than a mock AMM. The pool key hash matched the observed Initialize event; quotes were positive in both directions. A 10 FWA buy and 1000 MAD sell completed, with output meeting the quoted slippage floor.

Screenshots generated and viewed during work: `test/scratch/taste/shots/390.png`, `390-full.png`, `1440.png`, `1440-full.png`, and `test/scratch/chromium-390.png`. The mobile wallet sheet is at `test/scratch/mobile-wallet-sheet.png`. Focus states were viewed in `test/scratch/keyboard-focus.png`, `wallet-keyboard-focus.png` and `trade-keyboard-focus.png`; enlarged layouts in `test/scratch/enlarged-320.png`, `enlarged-390.png` and `enlarged-1440.png`. Temporary screenshots and browser fixtures are not part of the delivery; the retained probe summary is in `reports/taste-summary.json`.

The browser connector itself reported “Transport closed,” so rendered checks used the supplied Playwright Chromium runtime directly. WebKit launch reported a missing executable and was recorded unavailable. No additional browsers were installed.

## Completion and limitations

**Complete for the stated implementation and Chromium validation scope.** The production site, complete relative static export, source, lockfile, README and design documentation are delivered. Safari/WebKit, physical phones, screen readers, native zoom, actual wallet-app opening, Coinbase passkey creation and live mainnet signing remain unverified. No mainnet transaction, hosting command or domain publication was attempted. Pending review state is held in memory; after a reload, consult wallet transaction history before starting another trade.

The worker’s results do not confer independent behavioral certification. The assignment’s structural verifier checks paths and bytes.

Delivery packaging check: approximately 1.2 MB of candidate files, including the complete 0.88 MB static export, below the 8 MiB limit. The required source, lockfile, documentation and `dist/index.html` are eligible for submission. No dependency directories, caches, source maps, archives, symlinks or submodules are included. No ignore file or Git metadata was modified.
