import { Layout } from "../components/Layout";
import { ConfirmActionDialog } from "../components/ConfirmActionDialog";
import { InlineAlert } from "../components/InlineAlert";
import { TransferFlowHeader } from "../components/TransferFlowHeader";
import { Check, ChevronDown, Circle, Loader2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { pollApiJob } from "../apiJobs";
import { formatAmount, getReceivers, getSetSize, parseAmount, TOKEN_SYMBOL } from "../demoState";
import { api, shortHash, type ApiJob, type DemoSession, type DemoTransaction } from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive } from "@shared/productIdentity";
import { ContractExecutionDiagram, type TransferVisualTarget } from "@shared/transferVisuals";
import { useEffect, useMemo, useState } from "react";

type SubmitStatus = "pending" | "active" | "complete" | "failed";

const submitSteps = [
  {
    start: 0,
    next: 10,
    name: "Load private payload",
    detail: "Open the sealed transfer artifact selected by this wallet",
  },
  {
    start: 10,
    next: 35,
    name: "Check encrypted balance snapshot",
    detail: "Bind the transaction to the current APGC account state",
  },
  {
    start: 35,
    next: 75,
    name: "Verify proof and execute contract",
    detail: "Submit transferAPGCETH and mechanically process every selected account",
  },
  {
    start: 75,
    next: 100,
    name: "Refresh equal account states",
    detail: "Read back ciphertexts and nonces without assigning public member roles",
  },
  {
    start: 100,
    next: 101,
    name: "Finalize transaction receipt",
    detail: "Record the block result and expose the wallet-visible confirmation",
  },
];

function getSubmitStatus(
  step: (typeof submitSteps)[number],
  progress: number,
  confirmed: boolean,
  failed: boolean,
  started: boolean,
): SubmitStatus {
  if (confirmed || progress >= step.next) return "complete";
  if (!started) return "pending";
  if (progress >= step.start) return failed ? "failed" : "active";
  return "pending";
}

function statusIcon(status: SubmitStatus) {
  if (status === "complete") return <Check className="h-5 w-5 shrink-0 text-green-500" />;
  if (status === "active") return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />;
  return <Circle className={`h-5 w-5 shrink-0 ${status === "failed" ? "text-destructive" : "text-muted-foreground/60"}`} />;
}

export function SubmitScreen() {
  const navigate = useNavigate();
  const [identity] = useState(() => getProductIdentity());
  const [receivers] = useState(() => getReceivers());
  const receiverCount = receivers.length;
  const setSize = getSetSize(receiverCount);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [job, setJob] = useState<ApiJob<{ transaction?: DemoTransaction }> | null>(null);
  const [transaction, setTransaction] = useState<DemoTransaction | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const totalAmount = receivers.reduce((sum, receiver) => sum + parseAmount(receiver.amount), 0);
  const effectiveSetSize = session?.anonIndexes?.length || setSize;
  const effectiveReceiverCount = session?.receiverCount ?? receiverCount;
  const effectiveAmounts = session?.transferAmounts?.length
    ? session.transferAmounts
    : receivers.map((receiver) => receiver.amount);
  const effectiveTotalAmount = effectiveAmounts.reduce((sum, amount) => sum + parseAmount(amount), 0) || totalAmount;
  const feeEstimate = 0.05 + effectiveSetSize * 0.006 + effectiveReceiverCount * 0.01;
  const confirmed = Boolean(transaction) || job?.status === "succeeded" || Boolean(session?.transferSubmitted);
  const progressValue = confirmed ? 100 : job?.progress ?? 0;
  const active = busy || job?.status === "pending" || job?.status === "running";
  const canBroadcast = Boolean(session?.transferBuilt && session.latestTransferId && !confirmed && !busy);

  const visualTargets: TransferVisualTarget[] = (session?.receiverIndexes?.length
    ? session.receiverIndexes
    : receivers.map((receiver) => receiver.participantIndex)
  ).map((participantIndex, index) => ({
    id: `${participantIndex}-${index}`,
    label: `Receiver ${index + 1}`,
    amount: `${formatAmount(parseAmount(effectiveAmounts[index] ?? "0"))} ${TOKEN_SYMBOL}`,
  }));

  const txHash = useMemo(() => {
    const latestTransfer = session?.transactions.find((item) => item.type === "transferAPGCETH");
    if (transaction?.hash) return transaction.hash;
    if (latestTransfer?.hash) return latestTransfer.hash;
    const amountSeed = Math.round(effectiveTotalAmount * 100).toString(16).padStart(8, "0");
    return `0x${effectiveSetSize.toString(16).padStart(2, "0")}${effectiveReceiverCount.toString(16).padStart(2, "0")}9f3c...${amountSeed}`;
  }, [effectiveReceiverCount, effectiveSetSize, effectiveTotalAmount, session?.transactions, transaction?.hash]);

  useEffect(() => {
    if (!identity) {
      navigate("/", { replace: true });
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      setError("");
      try {
        const [walletStatus, currentSession] = await Promise.all([api.walletStatus(), api.session()]);
        if (cancelled) return;
        if (!productIdentityIsActive(identity, walletStatus)) {
          clearProductIdentity();
          navigate("/", { replace: true });
          return;
        }
        setSession(currentSession);

        if (currentSession.transferSubmitted) {
          setTransaction(currentSession.transactions.find((item) => item.type === "transferAPGCETH") ?? null);
          return;
        }
        if (!currentSession.transferBuilt) setError("Build a transfer proof before broadcasting to chain.");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "session unavailable");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [identity, navigate]);

  const broadcast = async () => {
    if (!session?.latestTransferId) {
      setError("No transfer artifact is ready for broadcast.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const started = await api.submitTransfer(session.latestTransferId, identity?.token ?? "");
      const completed = await pollApiJob<{ transaction?: DemoTransaction }>(started.jobId, setJob);
      setJob(completed);
      setTransaction(completed.result?.transaction ?? null);
      setSession(await api.session());
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit failed");
    } finally {
      setBusy(false);
    }
  };

  const activeLabel = confirmed
    ? "Encrypted account state finalized"
    : job?.step ?? (busy ? "Submitting the sealed APGC artifact" : "Ready for contract submission");

  return (
    <Layout activeTab="transfer">
      <div className="wallet-flow-page space-y-4 p-6">
        <TransferFlowHeader
          step={4}
          title="Submit to the APGC contract"
          description="Watch the sender-known payment enter the contract while every anonymity member receives the same public state-update treatment."
        />

        <ContractExecutionDiagram
          targets={visualTargets}
          total={`${formatAmount(effectiveTotalAmount)} ${TOKEN_SYMBOL}`}
          setSize={effectiveSetSize}
          active={active}
          confirmed={confirmed}
          progress={progressValue}
        />

        <section className="wallet-flow-card space-y-4 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium text-foreground" title={activeLabel}>{activeLabel}</span>
              <Badge className={confirmed ? "border-green-200 bg-green-50 text-green-600" : "border-primary/20 bg-primary/10 text-primary"}>
                {progressValue}%
              </Badge>
            </div>
            <Progress value={progressValue} />
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            aria-expanded={showDetails}
            aria-controls="submit-details"
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-medium text-foreground">Contract execution stages</div>
              <div className="text-xs text-muted-foreground">Actual submission and encrypted-state checkpoints</div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`} />
          </button>

          {showDetails && (
            <div id="submit-details" className="wallet-stage-list">
              {submitSteps.map((step) => {
                const status = getSubmitStatus(step, progressValue, confirmed, Boolean(error), active || progressValue > 0);
                return (
                  <div key={step.name} className={`wallet-stage-row ${status}`}>
                    <span className="wallet-stage-icon">{statusIcon(status)}</span>
                    <span className="min-w-0">
                      <b>{step.name}</b>
                      <small>{step.detail}</small>
                    </span>
                    <span className="wallet-stage-state">{status === "complete" ? "done" : status === "active" ? "live" : status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="wallet-flow-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Transaction Hash</span>
            <Badge className={confirmed ? "border-green-200 bg-green-50 text-green-600" : "border-primary/20 bg-primary/10 text-primary"}>
              {confirmed ? "Finalized" : busy ? "Submitting" : "Review"}
            </Badge>
          </div>
          <div className="truncate font-mono text-sm text-foreground" title={txHash}>{shortHash(txHash)}</div>
          <div className="wallet-review-grid border-t border-border pt-3">
            <div><span className="text-muted-foreground">Set Size</span><span className="font-semibold text-foreground">{effectiveSetSize}</span></div>
            <div><span className="text-muted-foreground">Recipients</span><span className="font-semibold text-foreground">{effectiveReceiverCount}</span></div>
            <div><span className="text-muted-foreground">Amount</span><span className="font-semibold text-foreground">{formatAmount(effectiveTotalAmount)} {TOKEN_SYMBOL}</span></div>
            <div><span className="text-muted-foreground">Estimated fee</span><span className="font-semibold text-foreground">{feeEstimate.toFixed(2)} {TOKEN_SYMBOL}</span></div>
          </div>
        </section>

        {error && <InlineAlert tone="error" title="Broadcast unavailable" message={error} />}

        {confirmed ? (
          <Button onClick={() => navigate("/confirmed")} className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            View Confirmation
          </Button>
        ) : (
          <ConfirmActionDialog
            title="Submit private transfer?"
            description="This sends the sealed APGC artifact to the local contract. The contract verifies the proof and updates all selected encrypted account states uniformly."
            confirmLabel="Submit"
            disabled={!canBroadcast}
            onConfirm={broadcast}
          >
            <Button disabled={!canBroadcast} className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Submitting" : "Submit to APGC Contract"}
            </Button>
          </ConfirmActionDialog>
        )}
      </div>
    </Layout>
  );
}
