import { Layout } from "../components/Layout";
import { CheckCircle, Shield } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { InlineAlert } from "../components/InlineAlert";
import { formatAmount, TOKEN_SYMBOL } from "../demoState";
import { api, shortAddress, shortCiphertext, shortHash, type DemoTransaction, type MonitorSummary } from "@shared/api";
import { useEffect, useState } from "react";

function titleFor(transaction: DemoTransaction) {
  if (transaction.type === "deposit" || transaction.type === "walletRegisterDeposit") return "Encrypted APGC Deposit";
  if (transaction.type === "fund") return "External Funding";
  if (transaction.type === "transferAPGCETH") return "Anonymous APGC Transfer";
  return transaction.type;
}

export function ChainScreen() {
  const [monitor, setMonitor] = useState<MonitorSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const summary = await api.monitorSummary();
        if (!cancelled) {
          setMonitor(summary);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "chain monitor unavailable");
      }
    };
    load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const transactions: DemoTransaction[] = monitor?.transactions ?? [];
  const latestBlock = monitor?.chain.latestBlock ?? transactions[0]?.blockNumber ?? 0;
  const accountCount = monitor?.accounts.length ?? 0;
  const transferCount = transactions.filter((tx) => tx.type === "transferAPGCETH").length;

  return (
    <Layout activeTab="chain">
      <div className="wallet-chain-screen p-6 space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">APGC Contract State</h2>
          <p className="text-sm text-muted-foreground">Public chain view: public keys, ciphertext commitments, nonces, and confirmed transaction references.</p>
        </div>

        {error && <InlineAlert tone="error" title="Chain monitor unavailable" message={error} />}

        <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">{monitor?.chain.connected ? "Ganache connected" : "Ganache offline"}</h3>
              <p className="text-xs text-muted-foreground">
                {monitor?.chain.rpcUrl ?? "http://127.0.0.1:8545"}
              </p>
            </div>
            <Badge className={monitor?.chain.connected ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"}>
              {monitor?.chain.connected ? "Active" : "Offline"}
            </Badge>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">APGCSystem</div>
            <div className="mt-1 truncate font-mono text-xs font-semibold text-foreground">{shortAddress(monitor?.chain.contracts?.APGCSystem)}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">Block</div>
            <div className="mt-1 text-base font-semibold text-foreground">{latestBlock ? latestBlock.toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">Accounts</div>
            <div className="mt-1 text-base font-semibold text-foreground">{accountCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">Transfers</div>
            <div className="mt-1 text-base font-semibold text-foreground">{transferCount}</div>
          </div>
        </section>

        <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border space-y-4">
          <h3 className="text-sm font-semibold text-foreground">APGC internal accounts</h3>
          {monitor?.accounts.length ? (
            <div className="space-y-3">
              {monitor.accounts.slice(0, 10).map((account) => (
                <article key={account.index} className="rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-semibold text-primary">{shortHash(account.publicKey.join(":"))}</div>
                      <div className="mt-1 text-[10px] uppercase text-muted-foreground">public key fingerprint</div>
                    </div>
                    <Badge className="border-primary/20 bg-primary/10 text-primary">{account.depositTx ? "on chain" : "pending"}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-card px-3 py-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Ciphertext</div>
                      <div className="mt-1 truncate font-mono font-semibold text-foreground">{shortCiphertext(account.ciphertext)}</div>
                    </div>
                    <div className="rounded-xl bg-card px-3 py-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Nonce</div>
                      <div className="mt-1 font-mono font-semibold text-foreground">{account.nonce || "0"}</div>
                    </div>
                    <div className="col-span-2 rounded-xl bg-card px-3 py-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Last transaction</div>
                      <div className="mt-1 truncate font-mono font-semibold text-foreground">{shortHash(account.lastTx)}</div>
                    </div>
                  </div>
                </article>
              ))}
              {monitor.accounts.length > 10 && (
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Showing first 10 of {monitor.accounts.length} public APGC accounts.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">No APGC accounts initialized.</div>
          )}
        </div>

        <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Public contract transactions</h3>

          {transactions.length === 0 ? (
            <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
              Confirmed public chain transactions will be added to this ledger view.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 4).map((transaction) => (
                <div key={transaction.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground mb-1">{titleFor(transaction)}</div>
                    <div className="text-xs text-muted-foreground font-mono mb-1">
                      Tx: {shortHash(transaction.hash)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Block: #{transaction.blockNumber}</span>
                      <span>{transaction.amount ? formatAmount(Number(transaction.amount)) : "-"} {transaction.amount ? TOKEN_SYMBOL : ""}</span>
                    </div>
                    {transaction.type === "transferAPGCETH" && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {transaction.receiverCount || 0} receivers / {transaction.anonSetSize || "-"} member set
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
