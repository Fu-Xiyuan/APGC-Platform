import { Layout } from "../components/Layout";
import { CheckCircle, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { InlineAlert } from "../components/InlineAlert";
import { TransferFlowHeader } from "../components/TransferFlowHeader";
import { api, shortHash, type ChainStatus, type DemoTransaction } from "@shared/api";
import { useEffect, useState } from "react";

export function ConfirmedScreen() {
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<DemoTransaction | null>(null);
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [activity, chainStatus] = await Promise.all([
          api.activity(),
          api.chainStatus(),
        ]);
        if (cancelled) return;
        setTransaction(activity.find((item) => item.type === "transferAPGCETH") ?? activity[0] ?? null);
        setChain(chainStatus);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "confirmation unavailable");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout activeTab="transfer">
      <div className="wallet-flow-page space-y-4 p-6">
        <TransferFlowHeader
          step={5}
          complete
          title="Transfer confirmed"
          description="The APGC proof was accepted and the encrypted account state is finalized on chain."
        />

        <section className="wallet-success-hero">
          <span><CheckCircle className="h-8 w-8" strokeWidth={2} /></span>
          <div>
            <strong>Private transfer complete</strong>
            <p>Block #{(transaction?.blockNumber ?? chain?.latestBlock ?? 0).toLocaleString("en-US")}</p>
          </div>
        </section>

        <section className="wallet-flow-card p-4">
          <div className="wallet-confirmation-list">
            <div>
              <span className="text-sm text-muted-foreground">Block Number</span>
              <span className="text-sm font-semibold text-foreground">{(transaction?.blockNumber ?? chain?.latestBlock ?? 0).toLocaleString("en-US")}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-semibold text-foreground">{transaction?.status ?? "Confirmed"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Proof Verified</span>
              <Badge className="bg-green-50 text-green-600 border-green-200">
                Valid
              </Badge>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Ledger Updated</span>
              <Badge className="bg-green-50 text-green-600 border-green-200">
                Success
              </Badge>
            </div>
          </div>
        </section>

        <section className="wallet-flow-card space-y-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Transaction hash</div>
              <div className="truncate font-mono text-sm text-foreground" title={transaction?.hash}>
                {transaction ? shortHash(transaction.hash) : "pending"}
              </div>
            </div>
            <button
              type="button"
              aria-label="Copy transaction hash"
              disabled={!transaction?.hash}
              onClick={() => transaction?.hash && navigator.clipboard?.writeText(transaction.hash)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </section>

        {error && <InlineAlert tone="error" title="Confirmation unavailable" message={error} />}

        <div className="grid gap-2">
          <Button
            onClick={() => navigate("/chain")}
            className="h-12 w-full rounded-xl bg-primary text-white hover:bg-primary/90"
          >
            <ExternalLink className="w-4 h-4" />
            View chain activity
          </Button>
          <Button onClick={() => navigate("/transfer")} variant="outline" className="h-12 w-full rounded-xl border-border">
            <RefreshCw className="h-4 w-4" />
            Start another transfer
          </Button>
        </div>
      </div>
    </Layout>
  );
}
