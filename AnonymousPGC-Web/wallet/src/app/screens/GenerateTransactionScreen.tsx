import { Layout } from "../components/Layout";
import { ArrowRight, Check, ChevronDown, Circle, Loader2, Lock, Send, Shield, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { InlineAlert } from "../components/InlineAlert";
import { TransferFlowHeader } from "../components/TransferFlowHeader";
import { formatAmount, getReceivers, getSetSize, parseAmount, TOKEN_SYMBOL } from "../demoState";
import { api, shortHash, type DemoSession } from "@shared/api";
import { useEffect, useMemo, useState } from "react";

type AssemblyStatus = "pending" | "active" | "complete";

function getAssemblyStatus(index: number, activeStep: number): AssemblyStatus {
  if (index < activeStep) return "complete";
  if (index === activeStep) return "active";
  return "pending";
}

function statusIcon(status: AssemblyStatus) {
  if (status === "complete") {
    return <Check className="w-4 h-4 text-green-600" />;
  }

  if (status === "active") {
    return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  }

  return <Circle className="w-4 h-4 text-muted-foreground/60" />;
}

export function GenerateTransactionScreen() {
  const navigate = useNavigate();
  const receivers = getReceivers();
  const receiverCount = receivers.length;
  const setSize = getSetSize(receiverCount);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [error, setError] = useState("");
  const totalAmount = receivers.reduce((sum, receiver) => sum + parseAmount(receiver.amount), 0);
  const effectiveSetSize = session?.anonIndexes?.length || setSize;
  const effectiveReceiverCount = session?.receiverCount ?? receiverCount;
  const effectiveTotalAmount = session?.transferAmounts?.length
    ? session.transferAmounts.reduce((sum, amount) => sum + parseAmount(amount), 0)
    : totalAmount;
  const feeEstimate = 0.05 + effectiveSetSize * 0.006 + effectiveReceiverCount * 0.01;
  const payloadSize = 1.7 + effectiveReceiverCount * 0.35 + effectiveSetSize * 0.04;
  const txHash = useMemo(() => {
    if (session?.latestTransferId) return shortHash(session.latestTransferId);
    const amountSeed = Math.round(effectiveTotalAmount * 100).toString(16).padStart(8, "0");
    return `0x${effectiveSetSize.toString(16).padStart(2, "0")}${effectiveReceiverCount.toString(16).padStart(2, "0")}...${amountSeed}`;
  }, [effectiveReceiverCount, effectiveSetSize, effectiveTotalAmount, session?.latestTransferId]);
  const assemblySteps = useMemo(
    () => [
      {
        name: "Receiver Outputs",
        detail: `Pack ${effectiveReceiverCount} encrypted receiver commitments`,
        meta: `${formatAmount(effectiveTotalAmount)} ${TOKEN_SYMBOL}`,
      },
      {
        name: "Attach Proof",
        detail: `Bind APGC proof to anonymity set ${effectiveSetSize}`,
        meta: `n=${effectiveSetSize}`,
      },
      {
        name: "Encrypt Memo",
        detail: "Seal transfer memo and sender change output",
        meta: "private",
      },
      {
        name: "Fee & Nonce",
        detail: "Estimate chain fee and assign account nonce",
        meta: `${feeEstimate.toFixed(2)} ${TOKEN_SYMBOL}`,
      },
      {
        name: "Serialize Payload",
        detail: "Prepare transaction bytes for chain broadcast",
        meta: `${payloadSize.toFixed(1)} KB`,
      },
    ],
    [effectiveReceiverCount, effectiveSetSize, effectiveTotalAmount, feeEstimate, payloadSize],
  );
  const [activeStep, setActiveStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const transactionReady = activeStep >= assemblySteps.length;

  useEffect(() => {
    api.session()
      .then((nextSession) => {
        setSession(nextSession);
        setError(nextSession.transferBuilt ? "" : "transfer payload has not been built yet");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "session unavailable"));
  }, []);

  useEffect(() => {
    if (transactionReady) return undefined;

    const timer = window.setTimeout(() => {
      setActiveStep((current) => Math.min(current + 1, assemblySteps.length));
    }, 850);

    return () => clearTimeout(timer);
  }, [activeStep, assemblySteps.length, transactionReady]);

  const progressValue = transactionReady
    ? 100
    : Math.round(((activeStep + 0.45) / assemblySteps.length) * 100);
  const activeLabel = transactionReady ? "Transaction Ready" : assemblySteps[activeStep]?.name ?? "Assembling";

  return (
    <Layout activeTab="transfer">
      <div className="wallet-flow-page space-y-4 p-6">
        <TransferFlowHeader
          step={4}
          title="Assemble transaction"
          description="Package the encrypted outputs, privacy proof, fee and nonce into one broadcast-ready payload."
        />

        <section className="wallet-flow-card space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Transaction Builder</div>
                <div className="text-xs text-muted-foreground">{activeLabel}</div>
              </div>
            </div>
            <Badge className={transactionReady ? "bg-green-50 text-green-600 border-green-200" : "bg-primary/10 text-primary border-primary/20"}>
              {progressValue}%
            </Badge>
          </div>

          <div className="wallet-builder-metrics">
            <div>
              <Users className="h-4 w-4 text-primary" />
              <span>Recipients</span>
              <strong>{effectiveReceiverCount}</strong>
            </div>
            <div>
              <Shield className="h-4 w-4 text-primary" />
              <span>Ring</span>
              <strong>{effectiveSetSize}</strong>
            </div>
            <div>
              <Send className="h-4 w-4 text-primary" />
              <span>Fee</span>
              <strong>{feeEstimate.toFixed(2)} {TOKEN_SYMBOL}</strong>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progressValue} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{transactionReady ? "Payload sealed" : `${activeLabel} running`}</span>
            <span>{payloadSize.toFixed(1)} KB</span>
            </div>
          </div>
        </section>

        <section className="wallet-flow-card space-y-3 p-4">
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            aria-expanded={showDetails}
            aria-controls="transaction-details"
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-medium text-foreground">Assembly Details</div>
              <div className="text-xs text-muted-foreground">
                {showDetails ? "Hide step-by-step payload generation" : "Tap to inspect each generation step"}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`} />
          </button>

          {showDetails && (
            <div id="transaction-details" className="space-y-2">
              {assemblySteps.map((step, index) => {
                const status = getAssemblyStatus(index, activeStep);

                return (
                  <div key={step.name} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
                    <div className="mt-0.5">{statusIcon(status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{step.name}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">{step.meta}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="wallet-flow-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Transfer Payload</span>
            <Badge className="bg-muted text-muted-foreground border-border">
              {session?.transferBuilt ? "Built" : "Local"}
            </Badge>
          </div>
          <div className="truncate font-mono text-sm text-foreground" title={session?.latestTransferId ?? txHash}>{txHash}</div>
        </section>

        {error && <InlineAlert tone="error" title="Transaction assembly unavailable" message={error} />}

        <Button
          onClick={() => navigate("/submit")}
          disabled={!transactionReady || !session?.transferBuilt}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
        >
          {transactionReady ? (
            <>
              Review broadcast
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            "Generating Transaction"
          )}
        </Button>
      </div>
    </Layout>
  );
}
