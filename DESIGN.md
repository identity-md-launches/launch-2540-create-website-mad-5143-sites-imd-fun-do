# MAD interface design

## Overview

MAD is a one-page Ethereum trading terminal for visitors who want to verify the token contract and buy or sell MAD. The visual direction is an inferred industrial treatment: deep olive, a pale trading surface, condensed display type and a single radiation mark. The product name and trading panel form the first composition; supporting data and explanations follow.

The shared system lives in `src/style.css`. Component behavior lives in `src/components/`; `src/App.tsx` arranges the page. This document describes the implemented source, not an additional design proposal.

## Colors

The canonical values are hex primitives with semantic aliases in `src/style.css:41`.

| Semantic token    | Value     | Use                                                     |
| ----------------- | --------- | ------------------------------------------------------- |
| `--bg`            | `#151914` | Page and decorative art background                      |
| `--surface`       | `#1e241c` | Dark surface primitive                                  |
| `--surface-hover` | `#2c3428` | Dark utility hover; FWA marker fill                     |
| `--border`        | `#424b3c` | Dark structural separators and art rings                |
| `--text`          | `#f0f0e6` | Primary text on the page                                |
| `--text-muted`    | `#aab1a3` | Supporting text on the page                             |
| `--accent`        | `#e9f56b` | Primary action fill; brand mark and display punctuation |
| `--accent-hover`  | `#d8e553` | Primary action hover                                    |
| `--panel`         | `#f4f4e9` | Trade and modal surfaces                                |
| `--panel-inset`   | `#e9eadd` | Preset and wallet-row control fills                     |
| `--panel-border`  | `#d2d5c5` | Light separators and control borders                    |
| `--panel-text`    | `#151914` | Text on light surfaces                                  |
| `--panel-muted`   | `#59604f` | Supporting text on light surfaces                       |
| `--focus`         | `#647b00` | Focus ring on the panel and dialogs                     |
| `--error`         | `#a02c29` | Errors on light surfaces                                |
| `--success`       | `#2c633a` | Confirmed transaction text                              |

Text, an icon, or an underline accompanies state colors. The native input radio uses the dark control color. There is one site theme; there is no theme switch or second theme block.

Measured token contrast: page text/background 15.50:1, muted page text/background 8.07:1, panel text/panel 16.06:1, muted panel text/panel 5.91:1, primary-button text/accent 15.02:1, error/panel 6.57:1. The focus ring measures 4.33:1 against the panel and 4.05:1 against the primary action. The rendered probe also passed its text-contrast check. These numbers describe these specific solid pairs, not a blanket accessibility certification.

## Typography

Fonts are bundled as WOFF2 through `@font-face` rules in `src/style.css:1`. There are no runtime font-CDN requests.

| Role                      | Family / weights                     | Size and behavior                                                                      |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Body, controls, labels    | Inter, `sans-serif`; 400 / 500 / 600 | 16px body; 14px dense labels and help; unitless line-height 1.6 for prose              |
| Main heading              | Barlow Condensed, `sans-serif`; 600  | 80px desktop, 64px at ≤68rem, 40px at ≤54rem; line-height .99 desktop and 1.05 smaller |
| About heading             | Barlow Condensed; 600                | 40px, line-height 1.05                                                                 |
| Trade/modal headings      | Inter; 600                           | 20px, line-height 1.3                                                                  |
| Amounts and market values | Inter; 500                           | 28px, or 20px for compact market values; tabular numbers                               |
| Contract address          | IBM Plex Mono, `monospace`; 400      | 14px, line-height 1.7 (1.55 on phones), selectable and allowed to wrap anywhere        |

The token scale is 14, 16, 20, 28, 40 and 80px. The 64px intermediate display treatment replaces the largest step at its breakpoint. The probe measured five sizes at 390px and six including single uses at 1440px. There are three families and three weights. Small text has natural tracking; display headings use slight negative tracking. Amount inputs stay at 28px on phones, avoiding small-input zoom. Headings balance; descriptions use pretty wrapping. There are no ellipsized contract addresses.

## Layout

`src/style.css:227` defines the two-column hero. The site shell is at most 1280px, centered, with 48px inner side padding. The right column is 440px; the left column takes the remaining width; the initial gap is 72px. The content spacing is built from 4px increments: 8–12px inside controls, 16–24px within task groups, and 32–80px between page sections.

Breakpoints are implemented at 68rem, 54rem, 45rem and 23rem:

- At ≤68rem, the shell has 32px padding, the trade column is 410px and the hero gap is 40px.
- At ≤54rem, the trade column becomes 380px, the headline is 40px and the gap is 28px.
- At ≤45rem, the hero becomes a single normal-flow column, with the title, contract, then trade panel. The decorative radiation diagram and desktop navigation are hidden. The header keeps the brand and wallet control. Side padding is 20px; the trade panel has 22px padding. Market metrics use a two-column grid and the about section stacks.
- At ≤23rem, the shell uses 16px padding and trade panel 18px padding.

At 390×844, the product, full contract and Review buy action appear on the first screen. The action is in normal flow. Measurements found no horizontal overflow at 320, 390, 720, 860, 1080 and 1440px. The header and footer utilities wrap when enlarged text needs another row, and the main title can break an oversized word instead of escaping its column; a separate 200% CSS text-enlargement check at 320, 390 and 1440px passed after this correction. This is not a native browser zoom test. Addresses wrap, amount fields can scroll their editable value, and output amounts can wrap. The about heading includes an explicit word space when its desktop line break is hidden.

Dialogs are centered on desktop. At ≤45rem they become full-width bottom sheets, with safe-area bottom padding and a maximum height of the dynamic viewport minus 24px. Long content can scroll within the native dialog.

## Elevation & Depth

The interface is flat. A light surface distinguishes the transaction task from the dark page. Borders structure navigation, groups and data; there are no card shadows, gradients or stacked content cards. Decorative concentric rings frame the desktop mark. Native dialogs enter the browser’s top layer with a 65% black backdrop and inert background content.

## Shapes

The trade panel uses a 12px radius; desktop dialogs use 16px. Primary buttons and wallet rows use 6px, presets and icon buttons 4px. Token marks are circles. The radiation SVG is shared by the brand, token marker, decorative art, favicon and share card. It is a custom site illustration rather than the launch’s official token logo.

## Components

- **TradePanel**, `src/components/TradePanel.tsx`: buy/sell button group, labeled amount input, presets, estimated output, slippage fieldset, quote refresh and review action. `onConnect` opens the shared wallet sheet. Quote, invalid input, unavailable quote, balance error, wrong network, approval, pending, expired, success and retry states are explicit. The review freezes the trade values while approvals happen; minimum received and deadlines are enforced in `src/trading.ts` and the router call.
- **WalletControl**, `src/components/WalletControl.tsx`: one header connect control and native dialog. Extension names/icons come from EIP-6963; generic Browser wallet is hidden when discovery found a named wallet. On phones without a provider it shows MetaMask, Coinbase Wallet, Rabby and Phantom links and Coinbase Smart Wallet. Connected, it shows the shortened checksummed wallet address and offers Disconnect. On another chain it offers Switch to Ethereum.
- **Modal**, `src/components/Modal.tsx`: native `dialog.showModal()` supplies background inertness, focus containment and restoration. Escape, backdrop and the labeled close button dismiss it. Transaction confirmation disables dismissal while processing or tracking an unresolved transaction.
- **Icon**, `src/components/Icon.tsx`: small decorative stroke icons inherit current color and have no redundant accessible name. Icon-only controls supply their own action label.
- **Contract pattern**, `src/App.tsx:96`: full linked address, separate copy action, and a stable status region announcing success or copy failure. The address is selectable when clipboard access fails.
- **Market pattern**, `src/App.tsx:140`: indicative data with source, timestamp, refresh and unavailable/stale-update handling. It is separate from the on-chain swap quote.
- **FAQ pattern**, `src/App.tsx`: native `details` and `summary`, with a visible disclosure mark. Answers explain the actual route and fees beside supporting links.

Controls have distinct backgrounds, borders or placement zones. Primary actions are at least 52px high. Wallet rows are at least 52px. Presets are 32px and sufficiently separated; they meet the 24px target baseline but are smaller than the 44px comfort target. Keyboard focus has a 2px outline offset by 4px. Hover styles only apply on hover-capable devices. Under reduced motion transitions and press scaling are absent; otherwise color/opacity transitions are 120ms and primary-button press scaling is .96. There is no entrance or endless animation.

## Do’s and Don’ts

- Reuse the semantic tokens and current type scale. Keep dense UI text in Inter and reserve the condensed family for display headings.
- Put the actual task ahead of supporting explanations. Keep wallet access in the header and the trade action within the panel.
- Keep contract addresses visible and selectable; allow wrapping instead of truncation.
- Keep approval, signing, broadcast and confirmed states distinct. A wallet rejection or pending transaction must not produce a success message.
- Use native links, buttons, fieldsets, dialogs and disclosures. Preserve visible keyboard focus and reduced-motion behavior.
- Add supporting information with the existing section spacing and heading styles. Use page anchors or explicitly exported static routes; the current host has no route-rewrite dependency.
- Keep source-derived facts in this document. Unverified Safari, physical-device, screen-reader and live-wallet behavior belongs in the validation limitations.
