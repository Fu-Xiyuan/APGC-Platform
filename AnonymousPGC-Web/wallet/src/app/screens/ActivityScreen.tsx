import { Layout } from "../components/Layout";
import { ArrowDownLeft, ArrowUpRight, CheckCircle, Shield, Users } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { InlineAlert } from "../components/InlineAlert";
import { formatAmount, TOKEN_SYMBOL } from "../demoState";
import { api, shortHash, type DemoAccount, type DemoTransaction } from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive } from "@shared/productIdentity";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  return `${Math.round(minutes / 60)} hours ago`;
}

export function ActivityScreen() {
  const navigate = useNavigate();
  const [identity] = useState(() => getProductIdentity());
  const [apiTransactions, setApiTransactions] = useState<DemoTransaction[]>([]);
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!identity) {
      navigate("/", { replace: true });
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [activity, session, walletStatus] = await Promise.all([
          api.activity(),
          api.session().catch(() => null),
          api.walletStatus(),
        ]);
        if (!cancelled) {
          if (!productIdentityIsActive(identity, walletStatus)) {
            clearProductIdentity();
            navigate("/", { replace: true });
            return;
          }
          setApiTransactions(activity);
          setAccount(session?.accounts.find((item) => item.index === identity.user.participantIndex) ?? null);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "activity unavailable");
      }
    };
    load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [identity?.token, navigate]);

  const transactions = apiTransactions.filter((transaction) => (
    transaction.participant === identity?.user.participantIndex ||
    (transaction.type === "transferAPGCETH" && account?.lastTx === transaction.hash)
  ));

  const titleFor = (transaction: DemoTransaction) => {
    if (transaction.type === "deposit" || transaction.type === "walletRegisterDeposit") return "Encrypted APGC Deposit";
    if (transaction.type === "fund") return "External Funding";
    if (transaction.participant === identity?.user.participantIndex) return "Outgoing Private Transfer";
    return "Encrypted State Update";
  };

  const iconFor = (transaction: DemoTransaction) => {
    if (transaction.type === "deposit" || transaction.type === "walletRegisterDeposit") return <ArrowDownLeft className="w-6 h-6 text-primary" />;
    return <ArrowUpRight className="w-6 h-6 text-primary" />;
  };

  return (
    <Layout activeTab="activity">
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Wallet Activity</h2>
          <p className="text-sm text-muted-foreground">Actions signed by this wallet and encrypted state updates visible to this account.</p>
        </div>

        {error && <InlineAlert tone="error" title="Activity unavailable" message={error} />}

        {transactions.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border">
            <div className="text-sm font-medium text-foreground">No transfers yet</div>
            <p className="text-xs text-muted-foreground mt-1">
              Wallet-visible APGC deposits and private transfer state updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {iconFor(transaction)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{titleFor(transaction)}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatTime(transaction.createdAt)}</p>
                      </div>
                      <Badge className="bg-green-50 text-green-600 border-green-200 flex-shrink-0">
                        {transaction.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-muted/40 p-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          Receivers
                        </div>
                        <div className="text-sm font-semibold text-foreground">{transaction.receiverCount || "-"}</div>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Shield className="w-3.5 h-3.5" />
                          Set Size
                        </div>
                        <div className="text-sm font-semibold text-foreground">{transaction.anonSetSize || "-"}</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Amount</span>
                        <span className="text-sm font-semibold text-foreground">
                          {transaction.amount ? formatAmount(Number(transaction.amount)) : "-"} {transaction.amount ? TOKEN_SYMBOL : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Block</span>
                        <span className="text-xs font-mono text-muted-foreground">#{transaction.blockNumber}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Tx</span>
                        <span className="text-xs font-mono text-muted-foreground">{shortHash(transaction.hash)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {transaction.type === "transferAPGCETH" ? "APGC proof verified and ledger updated" : "Transaction confirmed on local chain"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
