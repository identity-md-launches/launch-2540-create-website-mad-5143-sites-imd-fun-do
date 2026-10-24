import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { getAddress } from "viem";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { readableError } from "../trading";
const walletLinks = [
  {
    id: "metamask",
    name: "MetaMask",
    href: (url: string) =>
      `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    href: (url: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: "rabby",
    name: "Rabby",
    href: (url: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
  },
  {
    id: "phantom",
    name: "Phantom",
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];
export function WalletControl({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending, variables } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const [error, setError] = useState("");
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !("ethereum" in window);
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && (!mobile || c.type !== "injected"),
  );
  const short = address
    ? `${getAddress(address).slice(0, 6)}…${getAddress(address).slice(-4)}`
    : "";
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected, setOpen]);
  const connectWallet = async (connector: Connector) => {
    setError("");
    try {
      await connectAsync({ connector, chainId: 1 });
    } catch (e) {
      setError(
        /provider.*not found/i.test(String(e))
          ? "No browser wallet found. Install a wallet extension or choose Coinbase Wallet."
          : readableError(e),
      );
    }
  };
  const switchNetwork = async () => {
    setError("");
    try {
      await switchChainAsync({ chainId: 1 });
    } catch (e) {
      setError(readableError(e));
      setOpen(true);
    }
  };
  return (
    <>
      <button
        className="wallet-button"
        onClick={() => {
          setError("");
          if (isConnected && chainId !== 1) void switchNetwork();
          else setOpen(true);
        }}
        disabled={switching}
      >
        <Icon name="wallet" size={18} />
        <span>
          {switching
            ? "Switching…"
            : isConnected
              ? chainId === 1
                ? short
                : "Switch to Ethereum"
              : "Connect"}
        </span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isConnected ? "Your wallet" : "Connect a wallet"}
      >
        {isConnected ? (
          <>
            <p className="muted">
              Connected on {chainId === 1 ? "Ethereum" : "another network"}.
            </p>
            <code className="full-address">
              {address && getAddress(address)}
            </code>
            {chainId !== 1 && (
              <button
                className="primary"
                disabled={switching}
                onClick={() => void switchNetwork()}
              >
                Switch to Ethereum
              </button>
            )}
            <button
              className="secondary full"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              {mobile
                ? "Open this page in your wallet, or connect with a passkey."
                : "Choose a browser wallet or connect with Coinbase."}
            </p>
            <div className="wallet-list">
              {mobile &&
                walletLinks.map((w) => (
                  <a
                    key={w.id}
                    className="wallet-row"
                    href={w.href(location.href)}
                  >
                    <img
                      src={`./assets/${w.id}.svg`}
                      width="28"
                      height="28"
                      alt=""
                    />
                    <span>Open in {w.name}</span>
                    <Icon name="arrow" size={18} />
                  </a>
                ))}
              {listed.map((c) => (
                <button
                  className="wallet-row"
                  key={c.uid}
                  disabled={isPending}
                  onClick={() => void connectWallet(c)}
                >
                  {c.icon ? (
                    <img src={c.icon} width="28" height="28" alt="" />
                  ) : c.id === "coinbaseWalletSDK" ? (
                    <img
                      src="./assets/coinbase.svg"
                      width="28"
                      height="28"
                      alt=""
                    />
                  ) : (
                    <Icon name="wallet" size={28} />
                  )}
                  <span>
                    {c.id === "injected"
                      ? "Browser wallet"
                      : c.id === "coinbaseWalletSDK"
                        ? mobile
                          ? "Coinbase Smart Wallet"
                          : "Coinbase Wallet"
                        : c.name}
                    {isPending && variables?.connector === c
                      ? " · opening…"
                      : ""}
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              ))}
            </div>
            <p className="small muted">
              A connection lets this site read your public address. Trades
              require separate wallet confirmation.
            </p>
          </>
        )}
        <p className="error-message" role="status">
          {error}
        </p>
      </Modal>
    </>
  );
}
