import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TOKEN, POOL_ID, EXPLORER, DEX_URL, LAUNCH_URL, FWA } from "./chain";
import { TradePanel } from "./components/TradePanel";
import { WalletControl } from "./components/WalletControl";
import { Icon } from "./components/Icon";
export default function App() {
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const market = useQuery({
    queryKey: ["market"],
    staleTime: 45_000,
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${TOKEN}`,
        { signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) throw new Error("Market data unavailable");
      const data = await response.json();
      const pair = data.pairs?.find(
        (p: {
          chainId: string;
          pairAddress: string;
          baseToken: { address: string };
        }) =>
          p.chainId === "ethereum" &&
          p.pairAddress?.toLowerCase() === POOL_ID &&
          p.baseToken?.address.toLowerCase() === TOKEN,
      );
      if (
        !pair ||
        !Number.isFinite(Number(pair.priceUsd)) ||
        Number(pair.priceUsd) <= 0
      )
        throw new Error("Pair unavailable");
      return {
        price: Number(pair.priceUsd),
        liquidity: Number(pair.liquidity?.usd ?? NaN),
        volume: Number(pair.volume?.h24 ?? NaN),
        change: Number(pair.priceChange?.h24),
        timestamp: Date.now(),
      };
    },
  });
  const marketValue = (value: number | undefined, small = false) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: small ? 8 : 0,
        }).format(value!)
      : "Unavailable";
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(TOKEN);
      setCopied(true);
      setCopyError("");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError("Copy unavailable. Select the contract address to copy it.");
    }
  };
  return (
    <>
      <a href="#trade" className="skip-link">
        Skip to trade
      </a>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="#" aria-label="MAD home">
            <img src="./assets/mad.svg" width="36" height="36" alt="" />
            <span>
              MAD<span className="brand-period">.</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#trade">Trade</a>
            <a href="#about">About</a>
            <a href={DEX_URL} target="_blank" rel="noopener noreferrer">
              Chart <Icon name="external" size={14} />
            </a>
          </nav>
          <WalletControl open={walletOpen} setOpen={setWalletOpen} />
        </header>
        <main>
          <div className="hero-grid">
            <section className="intro" aria-labelledby="title">
              <h1 id="title">
                Mutually assured
                <br className="desktop-break" /> destruction<span>.</span>
              </h1>
              <p className="hero-description">Buy and sell MAD on Ethereum.</p>
              <div className="contract">
                <div className="contract-heading">
                  <span>Token contract</span>
                  <button
                    className="copy-button"
                    onClick={() => void copyAddress()}
                    aria-label={
                      copied
                        ? "Contract address copied"
                        : "Copy contract address"
                    }
                  >
                    <Icon name={copied ? "check" : "copy"} size={16} />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <a href={EXPLORER} target="_blank" rel="noopener noreferrer">
                  <code>{TOKEN}</code>
                </a>
                <span role="status" className="sr-only">
                  {copied ? "Contract address copied." : copyError}
                </span>
                {copyError && <p className="small">{copyError}</p>}
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-cross art-cross-one">+</div>
                <div className="art-cross art-cross-two">+</div>
                <div className="radiation-ring">
                  <div className="radiation-ring-inner">
                    <img
                      src="./assets/mad.svg"
                      alt=""
                      width="200"
                      height="200"
                    />
                  </div>
                </div>
                <span className="art-annotation">Handle with conviction.</span>
                <div className="art-cross art-cross-three">+</div>
                <div className="art-cross art-cross-four">+</div>
              </div>
            </section>
            <TradePanel onConnect={() => setWalletOpen(true)} />
          </div>
          <section className="market-section" aria-label="MAD market data">
            <div className="market-heading">
              <span>Market overview</span>
              <div className="market-source">
                <span>
                  {market.isError
                    ? market.data
                      ? `Update failed · last ${new Date(market.data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Data unavailable"
                    : market.data
                      ? `Updated ${new Date(market.data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Loading market data…"}
                </span>
                <button
                  className="icon-button"
                  aria-label="Refresh market data"
                  onClick={() => void market.refetch()}
                  disabled={market.isFetching}
                >
                  <Icon name="refresh" size={16} />
                </button>
              </div>
            </div>
            <dl className="market-stats">
              <div>
                <dt>MAD price</dt>
                <dd>{marketValue(market.data?.price, true)}</dd>
              </div>
              <div>
                <dt>24h volume</dt>
                <dd>{marketValue(market.data?.volume)}</dd>
              </div>
              <div>
                <dt>Pool liquidity</dt>
                <dd>{marketValue(market.data?.liquidity)}</dd>
              </div>
              <div>
                <dt>Total supply</dt>
                <dd>1,000,000,000</dd>
              </div>
            </dl>
            <p className="market-note small">
              Indicative USD data from{" "}
              <a href={DEX_URL} target="_blank" rel="noopener noreferrer">
                DexScreener <Icon name="external" size={12} />
              </a>
              . Your trade uses an on-chain quote.
            </p>
          </section>
          <section id="about" className="about-section">
            <div className="about-intro">
              <h2>
                Know what <br />
                you’re trading.
              </h2>
              <p>
                MAD is Mutually Assured Destruction, a token on Ethereum with a
                fixed supply of one billion.
              </p>
              <a
                className="underlined-link"
                href={LAUNCH_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore the token launch <Icon name="arrow" size={18} />
              </a>
            </div>
            <div className="faq-list">
              <details open>
                <summary>
                  How do I buy or sell MAD?
                  <span className="disclosure-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div>
                  <p>
                    Connect a wallet on Ethereum. To buy, enter an amount of
                    FWA. To sell, enter an amount of MAD. Review the quote, then
                    confirm each required step in your wallet.
                  </p>
                  <p>
                    Keep ETH for network fees. The first trade may need two
                    approvals before the swap.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  What is FWA?
                  <span className="disclosure-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div>
                  <p>
                    Fake World Assets (FWA) is the other token in MAD’s
                    liquidity pool. This site trades the MAD/FWA pair directly.
                  </p>
                  <a
                    className="underlined-link"
                    href={`https://etherscan.io/token/${FWA}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View FWA on Etherscan <Icon name="external" size={14} />
                  </a>
                  <p>
                    <a
                      className="underlined-link"
                      href={`https://app.uniswap.org/swap?chain=mainnet&inputCurrency=ETH&outputCurrency=${FWA}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get FWA on Uniswap <Icon name="external" size={14} />
                    </a>
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  What fees will I pay?
                  <span className="disclosure-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div>
                  <p>
                    The pool charges 1.25%, included in the quote. Ethereum also
                    charges a network fee in ETH for each approval and swap.
                    Your wallet shows the network fee before you confirm.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  How does slippage work?
                  <span className="disclosure-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div>
                  <p>
                    The default slippage tolerance is 1%. Change it in trade
                    settings. The review shows the minimum amount you will
                    receive; the swap reverts if it cannot meet that minimum.
                  </p>
                </div>
              </details>
            </div>
          </section>
        </main>
        <footer className="site-footer">
          <a className="footer-brand" href="#">
            MAD.
          </a>
          <p>Trade with intention.</p>
          <div>
            <a href={EXPLORER} target="_blank" rel="noopener noreferrer">
              Etherscan <Icon name="external" size={14} />
            </a>
            <a href={DEX_URL} target="_blank" rel="noopener noreferrer">
              DexScreener <Icon name="external" size={14} />
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
