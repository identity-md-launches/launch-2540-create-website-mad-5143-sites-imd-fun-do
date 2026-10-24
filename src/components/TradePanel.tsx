import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { getAccount } from "wagmi/actions";
import { erc20Abi, formatUnits, type Address, type Hash } from "viem";
import {
  client,
  TOKEN,
  FWA,
  QUOTER,
  quoterAbi,
  POOL_KEY,
  PERMIT2,
  ROUTER,
  permitAbi,
  routerAbi,
  UNISWAP_URL,
} from "../chain";
import { config } from "../wallet";
import {
  parseAmount,
  minimumOutput,
  displayAmount,
  readableError,
  swapInput,
  QUOTE_LIFETIME,
  type Side,
} from "../trading";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
type Quote = {
  amountOut: bigint;
  amount: bigint;
  side: Side;
  timestamp: number;
};
type Review = { quote: Quote; slippage: number; account: Address };
export function TradePanel({ onConnect }: { onConnect: () => void }) {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [debouncedAmount, setDebouncedAmount] = useState("");
  const [slippage, setSlippage] = useState(100);
  const [settings, setSettings] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [success, setSuccess] = useState("");
  const [pendingTx, setPendingTx] = useState<{
    hash: Hash;
    kind: "approval" | "swap";
    side: Side;
    changed?: boolean;
  }>();
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 350);
    return () => clearTimeout(t);
  }, [amount]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const parsed = parseAmount(debouncedAmount);
  const inputSymbol = side === "buy" ? "FWA" : "MAD";
  const outputSymbol = side === "buy" ? "MAD" : "FWA";
  const inputToken = side === "buy" ? FWA : TOKEN;
  const balances = useQuery({
    queryKey: ["balances", address],
    enabled: !!address,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [mad, fwa, eth] = await Promise.all([
        client.readContract({
          address: TOKEN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address!],
        }),
        client.readContract({
          address: FWA,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address!],
        }),
        client.getBalance({ address: address! }),
      ]);
      return { mad, fwa, eth };
    },
  });
  const quoteQuery = useQuery({
    queryKey: ["quote", side, parsed?.toString()],
    enabled: !!parsed,
    retry: false,
    refetchInterval: 25_000,
    staleTime: 15_000,
    queryFn: async (): Promise<Quote> => {
      const result = await client.simulateContract({
        address: QUOTER,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: POOL_KEY,
            zeroForOne: side === "sell",
            exactAmount: parsed!,
            hookData: "0x",
          },
        ],
      });
      if (result.result[0] <= 0n) throw new Error("No output");
      return {
        amountOut: result.result[0],
        amount: parsed!,
        side,
        timestamp: Date.now(),
      };
    },
  });
  const quote =
    amount === debouncedAmount && parsed ? quoteQuery.data : undefined;
  const balance = side === "buy" ? balances.data?.fwa : balances.data?.mad;
  const reviewToken = review?.quote.side === "buy" ? FWA : TOKEN;
  const approvals = useQuery({
    queryKey: ["approvals", review?.account, reviewToken],
    enabled: !!review,
    refetchInterval: review ? 5_000 : false,
    queryFn: async () => {
      const [erc, permit] = await Promise.all([
        client.readContract({
          address: reviewToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [review!.account, PERMIT2],
        }),
        client.readContract({
          address: PERMIT2,
          abi: permitAbi,
          functionName: "allowance",
          args: [review!.account, reviewToken, ROUTER],
        }),
      ]);
      return { erc, permit };
    },
  });
  const expired = !!review && now - review.quote.timestamp >= QUOTE_LIFETIME;
  const reviewInputSymbol = review?.quote.side === "buy" ? "FWA" : "MAD";
  const reviewOutputSymbol = review?.quote.side === "buy" ? "MAD" : "FWA";
  const needErc =
    !!review && approvals.data && approvals.data.erc < review.quote.amount;
  const needPermit =
    !!review &&
    approvals.data &&
    (approvals.data.permit[0] < review.quote.amount ||
      approvals.data.permit[1] <= Math.floor(now / 1000) + 300);
  const reviewAction = needErc
    ? `Approve ${reviewInputSymbol}`
    : needPermit
      ? "Allow this trade"
      : `${review?.quote.side === "buy" ? "Buy" : "Sell"} MAD`;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFieldError("");
    setError("");
    setSuccess("");
    if (pendingTx) {
      setError(
        "A transaction is still pending. Check its confirmation before starting another trade.",
      );
      return;
    }
    const current = parseAmount(amount);
    if (!current) {
      setFieldError(
        "Enter an amount greater than 0, using up to 18 decimal places.",
      );
      inputRef.current?.focus();
      return;
    }
    if (!isConnected || !address) {
      onConnect();
      return;
    }
    if (chainId !== 1) {
      try {
        await switchChainAsync({ chainId: 1 });
      } catch (e) {
        setError(readableError(e));
      }
      return;
    }
    if (balance === undefined) {
      setError("Your balance is unavailable. Refresh balances and try again.");
      return;
    }
    if (current > balance) {
      setFieldError(
        `Not enough ${inputSymbol}. Enter a smaller amount or add ${inputSymbol} to your wallet.`,
      );
      inputRef.current?.focus();
      return;
    }
    if (!balances.data?.eth) {
      setError("Add ETH to your wallet for network fees.");
      return;
    }
    if (
      !quote ||
      quote.amount !== current ||
      Date.now() - quote.timestamp >= QUOTE_LIFETIME
    ) {
      setError("Refresh the quote before reviewing this trade.");
      void quoteQuery.refetch();
      return;
    }
    if (minimumOutput(quote.amountOut, slippage) <= 0n) {
      setFieldError(
        "This amount is too small to trade. Enter a larger amount.",
      );
      inputRef.current?.focus();
      return;
    }
    setHash(undefined);
    setReview({ quote, slippage, account: address });
  };
  const settleTransaction = async (
    tx: Hash,
    kind: "approval" | "swap",
    tradeSide: Side,
    changed = false,
  ) => {
    setHash(tx);
    setPendingTx({ hash: tx, kind, side: tradeSide, changed });
    setStage("Waiting for Ethereum confirmation…");
    let replaced = changed;
    const receipt = await client.waitForTransactionReceipt({
      hash: tx,
      timeout: 180_000,
      onReplaced: (replacement) => {
        setHash(replacement.transaction.hash);
        replaced = replaced || replacement.reason !== "repriced";
        setPendingTx({
          hash: replacement.transaction.hash,
          kind,
          side: tradeSide,
          changed: replaced,
        });
      },
    });
    setPendingTx(undefined);
    if (replaced) {
      setError(
        "Transaction cancelled or replaced in your wallet. Check the transaction before trying again.",
      );
      setStage("");
      return;
    }
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    if (kind === "swap") {
      setSuccess(
        `${tradeSide === "buy" ? "Buy" : "Sell"} confirmed on Ethereum.`,
      );
      setReview(undefined);
      setAmount("");
      setStage("");
      void balances.refetch();
    } else {
      setStage("Approval confirmed. Continue when ready.");
      await approvals.refetch();
    }
  };
  const checkPending = async () => {
    if (!pendingTx || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await settleTransaction(
        pendingTx.hash,
        pendingTx.kind,
        pendingTx.side,
        pendingTx.changed,
      );
    } catch {
      setError(
        "Still waiting for confirmation. Check the transaction or try checking again.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const confirm = async () => {
    if (!review || lock.current || pendingTx) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const stillConnected = () => {
      const active = getAccount(config);
      if (
        !active.address ||
        active.address.toLowerCase() !== review.account.toLowerCase() ||
        active.chainId !== 1
      )
        throw new Error("Wallet or chain changed");
    };
    try {
      stillConnected();
      if (Date.now() - review.quote.timestamp >= QUOTE_LIFETIME) {
        setError("This quote expired. Refresh it before continuing.");
        return;
      }
      setStage("Checking permissions…");
      const [erc, permit] = await Promise.all([
        client.readContract({
          address: reviewToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [review.account, PERMIT2],
        }),
        client.readContract({
          address: PERMIT2,
          abi: permitAbi,
          functionName: "allowance",
          args: [review.account, reviewToken, ROUTER],
        }),
      ]);
      stillConnected();
      let tx: Hash;
      let kind: "approval" | "swap";
      if (erc < review.quote.amount) {
        setStage(`Confirm ${reviewInputSymbol} approval in your wallet…`);
        tx = await writeContractAsync({
          chainId: 1,
          account: review.account,
          address: reviewToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [PERMIT2, review.quote.amount],
        });
        kind = "approval";
      } else if (
        permit[0] < review.quote.amount ||
        permit[1] <= Math.floor(Date.now() / 1000) + 300
      ) {
        setStage("Confirm the trade allowance in your wallet…");
        tx = await writeContractAsync({
          chainId: 1,
          account: review.account,
          address: PERMIT2,
          abi: permitAbi,
          functionName: "approve",
          args: [
            reviewToken,
            ROUTER,
            review.quote.amount,
            Math.floor(Date.now() / 1000) + 1800,
          ],
        });
        kind = "approval";
      } else {
        setStage("Simulating trade…");
        const minimum = minimumOutput(review.quote.amountOut, review.slippage);
        const args = [
          "0x10",
          [swapInput(review.quote.side, review.quote.amount, minimum)],
          BigInt(Math.floor(Date.now() / 1000) + 300),
        ] as const;
        const simulation = await client.simulateContract({
          account: review.account,
          address: ROUTER,
          abi: routerAbi,
          functionName: "execute",
          args,
        });
        stillConnected();
        if (Date.now() - review.quote.timestamp >= QUOTE_LIFETIME) {
          setError("This quote expired. Refresh it before continuing.");
          return;
        }
        setStage("Confirm the trade in your wallet…");
        tx = await writeContractAsync({ ...simulation.request, chainId: 1 });
        kind = "swap";
      }
      await settleTransaction(tx, kind, review.quote.side);
    } catch (e) {
      setError(readableError(e));
      setStage("");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const refreshReview = async () => {
    if (!review) return;
    setBusy(true);
    setError("");
    setStage("Refreshing quote…");
    try {
      const result = await client.simulateContract({
        address: QUOTER,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: POOL_KEY,
            zeroForOne: review.quote.side === "sell",
            exactAmount: review.quote.amount,
            hookData: "0x",
          },
        ],
      });
      if (result.result[0] <= 0n) throw new Error("Quote unavailable");
      setReview({
        ...review,
        quote: {
          ...review.quote,
          amountOut: result.result[0],
          timestamp: Date.now(),
        },
      });
      setStage("");
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="trade-panel" id="trade" aria-labelledby="trade-title">
      <div className="trade-title">
        <h2 id="trade-title">Trade MAD</h2>
        <span className="network">
          <span className="network-dot" />
          Ethereum
        </span>
      </div>
      <div className="trade-toolbar">
        <div className="segmented" role="group" aria-label="Trade direction">
          <button
            type="button"
            aria-pressed={side === "buy"}
            onClick={() => {
              setSide("buy");
              setAmount("");
              setFieldError("");
              setError("");
              setSuccess("");
            }}
          >
            Buy
          </button>
          <button
            type="button"
            aria-pressed={side === "sell"}
            onClick={() => {
              setSide("sell");
              setAmount("");
              setFieldError("");
              setError("");
              setSuccess("");
            }}
          >
            Sell
          </button>
        </div>
        <button
          className="icon-button settings-button"
          aria-label="Trade settings"
          aria-expanded={settings}
          onClick={() => setSettings((v) => !v)}
        >
          <Icon name="settings" />
        </button>
      </div>
      {settings && (
        <fieldset className="slippage">
          <legend>Slippage tolerance</legend>
          {[50, 100, 200].map((bps) => (
            <label key={bps}>
              <input
                type="radio"
                name="slippage"
                value={bps}
                checked={slippage === bps}
                onChange={() => setSlippage(bps)}
              />
              {bps / 100}%
            </label>
          ))}
          <p className="small muted">
            Your trade reverts if the output falls below the minimum received.
          </p>
        </fieldset>
      )}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="amount-block">
          <div className="field-top">
            <label htmlFor="amount">You pay</label>
            <span className="small">
              {isConnected
                ? balance === undefined
                  ? "Balance unavailable"
                  : `Balance: ${displayAmount(balance, 4)}`
                : "Wallet not connected"}
            </span>
          </div>
          <div className="amount-line">
            <input
              ref={inputRef}
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "amount-error" : "pair-help"}
              onChange={(e) => {
                setAmount(e.target.value);
                setFieldError("");
                setError("");
              }}
            />
            <span className="token-chip">
              <TokenMark symbol={inputSymbol} />
              {inputSymbol}
            </span>
          </div>
          <div className="presets">
            {(side === "buy"
              ? ["10", "50", "100"]
              : ["1000", "10000", "50000"]
            ).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => {
                  setAmount(value);
                  setFieldError("");
                  setError("");
                }}
              >
                {Number(value).toLocaleString("en-US")}
              </button>
            ))}
            {isConnected && (
              <button
                type="button"
                disabled={balance === undefined}
                onClick={() => {
                  if (balance !== undefined)
                    setAmount(formatUnits(balance, 18));
                }}
              >
                Max
              </button>
            )}
          </div>
        </div>
        <div className="swap-divider">
          <span>
            <Icon name="down" size={18} />
          </span>
        </div>
        <div className="receive-block">
          <label htmlFor="receive">
            You receive <span className="small">(estimated)</span>
          </label>
          <div className="amount-line">
            <output id="receive" className="receive-amount" aria-live="off">
              {quote ? displayAmount(quote.amountOut) : "0.00"}
            </output>
            <span className="token-chip">
              <TokenMark symbol={outputSymbol} />
              {outputSymbol}
            </span>
          </div>
        </div>
        <p className="field-error" id="amount-error" role="status">
          {fieldError}
        </p>
        <div className="quote-meta">
          <span>Slippage {slippage / 100}%</span>
          <button
            type="button"
            className="refresh-quote"
            onClick={() => {
              if (parsed) void quoteQuery.refetch();
            }}
            aria-label="Refresh quote"
            disabled={!parsed || quoteQuery.isFetching}
          >
            <Icon name="refresh" size={14} />
            {quoteQuery.isFetching && parsed
              ? "Getting quote…"
              : quote
                ? now - quote.timestamp >= QUOTE_LIFETIME
                  ? "Quote expired"
                  : "Live quote"
                : "Enter an amount"}
          </button>
        </div>
        <button
          className="primary trade-submit"
          type="submit"
          disabled={switching}
        >
          {switching
            ? "Switching network…"
            : isConnected && chainId !== 1
              ? "Switch to Ethereum"
              : `Review ${side}`}
          <Icon name="arrow" />
        </button>
        <p className="trade-help small" id="pair-help">
          {side === "buy"
            ? "Buy with FWA. Keep ETH for network fees."
            : "Sell MAD for FWA. Keep ETH for network fees."}
        </p>
        {parsed && quoteQuery.isError && (
          <p className="error-message" role="status">
            Quote unavailable. Try a smaller amount or refresh.
          </p>
        )}
        {!review && (
          <p className="error-message" role="status">
            {error}
          </p>
        )}
        {isConnected && balances.isError && (
          <button
            type="button"
            className="text-button"
            onClick={() => void balances.refetch()}
          >
            Refresh balances
          </button>
        )}
        <p className="success-message" role="status">
          {success}
        </p>
        {hash && !review && (
          <a
            className="transaction-link"
            href={`https://etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View transaction <Icon name="external" size={14} />
          </a>
        )}
      </form>
      <div className="trade-route">
        <span>Via Uniswap v4 · 1.25% pool fee</span>
        <a
          href={UNISWAP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open MAD on Uniswap"
        >
          <Icon name="external" size={16} />
        </a>
      </div>
      <Modal
        open={!!review}
        onClose={() => {
          if (!busy && !pendingTx) {
            setReview(undefined);
            setError("");
          }
        }}
        title={`Review ${review?.quote.side ?? side}`}
        busy={busy || !!pendingTx}
      >
        {review && (
          <>
            <dl className="review-details">
              <div>
                <dt>You pay</dt>
                <dd>
                  {formatUnits(review.quote.amount, 18)} {reviewInputSymbol}
                </dd>
              </div>
              <div>
                <dt>Estimated received</dt>
                <dd>
                  {displayAmount(review.quote.amountOut, 8)}{" "}
                  {reviewOutputSymbol}
                </dd>
              </div>
              <div>
                <dt>Minimum received</dt>
                <dd>
                  {displayAmount(
                    minimumOutput(review.quote.amountOut, review.slippage),
                    8,
                  )}{" "}
                  {reviewOutputSymbol}
                </dd>
              </div>
              <div>
                <dt>Slippage</dt>
                <dd>{review.slippage / 100}%</dd>
              </div>
              <div>
                <dt>Pool fee (in quote)</dt>
                <dd>1.25%</dd>
              </div>
              <div>
                <dt>Network fee</dt>
                <dd>ETH · shown in wallet</dd>
              </div>
            </dl>
            <p className="small muted">
              {needErc
                ? `First, approve exactly ${formatUnits(review.quote.amount, 18)} ${reviewInputSymbol} for Permit2. `
                : ""}
              {needErc || needPermit
                ? "Then allow this amount for the Uniswap router for 30 minutes. Each step is a separate transaction with a network fee."
                : "The quote includes the pool fee. Confirming submits your swap to Ethereum."}
            </p>
            <p className="small quote-expiry">
              {expired
                ? "Quote expired. Refresh to continue."
                : `Quote expires in ${Math.max(0, Math.ceil((QUOTE_LIFETIME - (now - review.quote.timestamp)) / 1000))}s`}
            </p>
            <p className="small" role="status">
              {stage}
            </p>
            <p className="error-message" role="status">
              {error}
            </p>
            {approvals.isError && (
              <p className="error-message">
                Could not check allowances.{" "}
                <button
                  className="text-button"
                  onClick={() => void approvals.refetch()}
                >
                  Try again
                </button>
              </p>
            )}
            {hash && (
              <a
                className="transaction-link"
                href={`https://etherscan.io/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View transaction <Icon name="external" size={14} />
              </a>
            )}
            <button
              className="primary"
              disabled={busy || (!pendingTx && !expired && !approvals.data)}
              onClick={() =>
                void (pendingTx
                  ? checkPending()
                  : expired
                    ? refreshReview()
                    : confirm())
              }
            >
              {busy
                ? "Waiting for confirmation…"
                : pendingTx
                  ? "Check confirmation"
                  : expired
                    ? "Refresh quote"
                    : !approvals.data
                      ? "Checking allowances…"
                      : reviewAction}
              <Icon name="arrow" />
            </button>
          </>
        )}
      </Modal>
    </section>
  );
}
function TokenMark({ symbol }: { symbol: string }) {
  return symbol === "MAD" ? (
    <img src="./assets/mad.svg" width="24" height="24" alt="" />
  ) : (
    <span className="fwa-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="m9 1 7 4v8l-7 4-7-4V5zM2 5l7 4 7-4M9 9v8"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    </span>
  );
}
