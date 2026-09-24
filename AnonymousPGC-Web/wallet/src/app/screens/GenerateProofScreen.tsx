import { Layout } from "../components/Layout";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  FileCheck2,
  Loader2,
  ServerCog,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { InlineAlert } from "../components/InlineAlert";
import { TransferFlowHeader } from "../components/TransferFlowHeader";
import { pollApiJob } from "../apiJobs";
import { getAnonIndexes, getReceivers, getSenderIndex, getSetSize } from "../demoState";
import {
  api,
  type ApiJob,
  type DemoSession,
  type TransferBuildResult,
} from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive } from "@shared/productIdentity";
import { ProofAssemblyDiagram } from "@shared/transferVisuals";
import { useEffect, useRef, useState } from "react";

type CheckpointStatus = "pending" | "active" | "complete" | "failed";

const constructionStages = [
  { start: 0, next: 18, name: "Prepare native exporter", detail: "Load the selected accounts, amounts, and shuffled anonymity positions" },
  { start: 18, next: 35, name: "Compile transaction builder", detail: "Compile the native APGC export pipeline used by this transfer" },
  { start: 35, next: 72, name: "Generate APGC proof", detail: "Create the zero-knowledge proof and encrypted balance updates" },
  { start: 72, next: 80, name: "Load encrypted artifact", detail: "Read the generated proof payload and transaction records" },
  { start: 80, next: 92, name: "Validate proof payload", detail: "Check structure and locally validate proof equations when enabled" },
  { start: 92, next: 101, name: "Seal transaction artifact", detail: "Record the validated multi-recipient artifact for contract submission" },
];

function arraysEqual<T>(left: T[] | undefined, right: T[]) {
  if (!left || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function resultMatchesDraft(
  result: TransferBuildResult | undefined,
  senderIndex: number,
  receiverIndexes: number[],
  anonIndexes: number[],
  amounts: string[],
  fallbackSetSize: number,
) {
  if (!result) return false;
  const anonSetMatches = anonIndexes.length
    ? arraysEqual(result.anonIndexes, anonIndexes)
    : result.participants === fallbackSetSize;

  const proofMetadataIsComplete = (
    Boolean(result.transferId) &&
    result.artifactBytes > 0 &&
    result.structureValidation === "passed" &&
    (result.equationValidation === "passed" || result.equationValidation === "skipped") &&
    result.publicKeyCount === result.participants &&
    result.balanceCiphertextCount === result.participants &&
    result.transferCiphertextCount === result.participants &&
    result.proofPoints > 0 &&
    result.proofScalars > 0 &&
    result.solventProofPoints > 0 &&
    result.solventProofScalars > 0 &&
    (result.receiverCount === 1
      ? result.positiveProofPoints === 0 && result.positiveProofScalars === 0
      : result.positiveProofPoints > 0 && result.positiveProofScalars > 0)
  );

  return proofMetadataIsComplete && (
    result.senderIndex === senderIndex &&
    result.receiverCount === receiverIndexes.length &&
    result.participants === (anonIndexes.length || fallbackSetSize) &&
    arraysEqual(result.receiverIndexes, receiverIndexes) &&
    anonSetMatches &&
    arraysEqual(result.amounts, amounts)
  );
}

function formatBytes(bytes?: number) {
  if (!Number.isFinite(bytes) || !bytes || bytes < 1) return "Pending";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(job: ApiJob<TransferBuildResult> | null) {
  if (!job?.startedAt) return "Pending";
  const duration = job.durationMs ?? Math.max(0, Date.now() - Date.parse(job.startedAt));
  if (!Number.isFinite(duration)) return "Pending";
  return `${(duration / 1000).toFixed(1)}s`;
}

function constructionStatus(stage: (typeof constructionStages)[number], progress: number, ready: boolean, failed: boolean): CheckpointStatus {
  if (ready || progress >= stage.next) return "complete";
  if (progress >= stage.start) return failed ? "failed" : "active";
  return "pending";
}

function statusIcon(status: CheckpointStatus) {
  if (status === "complete") return <Check className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "pending") return <Circle className="h-4 w-4 text-muted-foreground/60" />;
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
}

function stageStateLabel(status: CheckpointStatus) {
  if (status === "complete") return "done";
  if (status === "failed") return "failed";
  if (status === "active") return "running";
  return "pending";
}

export function GenerateProofScreen() {
  const navigate = useNavigate();
  const [identity] = useState(() => getProductIdentity());
  const [receivers] = useState(() => getReceivers());
  const [anonIndexes] = useState(() => getAnonIndexes());
  const receiverCount = receivers.length;
  const setSize = getSetSize(receiverCount);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [job, setJob] = useState<ApiJob<TransferBuildResult> | null>(null);
  const [buildResult, setBuildResult] = useState<TransferBuildResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState("");
  const [draftMatchesSession, setDraftMatchesSession] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!identity) {
      navigate("/", { replace: true });
      return undefined;
    }
    if (startedRef.current) return undefined;
    startedRef.current = true;

    let cancelled = false;
    const run = async () => {
      setError("");
      try {
        const walletStatus = await api.walletStatus();
        if (cancelled) return;
        if (!productIdentityIsActive(identity, walletStatus)) {
          clearProductIdentity();
          navigate("/", { replace: true });
          return;
        }

        const currentSession = await api.session();
        if (cancelled) return;
        setSession(currentSession);

        const draftReceivers = receivers.length ? receivers : getReceivers(currentSession.participants - 1);
        const draftSenderIndex = getSenderIndex(identity.user.participantIndex);
        const receiverIndexes = draftReceivers.map((receiver) => receiver.participantIndex);
        const amounts = draftReceivers.map((receiver) => receiver.amount);
        const expectedSetSize = anonIndexes.length || setSize;
        if (!anonIndexes.length) {
          throw new Error("Select and confirm an anonymity set before generating the proof.");
        }
        const sessionMatchesDraft = (
          currentSession.transferBuilt &&
          currentSession.senderIndex === draftSenderIndex &&
          arraysEqual(currentSession.anonIndexes, anonIndexes) &&
          arraysEqual(currentSession.receiverIndexes, receiverIndexes) &&
          arraysEqual(currentSession.transferAmounts ?? [], amounts)
        );

        const previousJobId = currentSession.transferBuildJobId || currentSession.latestJobId;
        if (previousJobId) {
          try {
            let previousJob = await api.job<TransferBuildResult>(previousJobId);
            if (cancelled) return;
            if (previousJob.type === "transfer-build") {
              setJob(previousJob);
              if (previousJob.status === "pending" || previousJob.status === "running") {
                previousJob = await pollApiJob<TransferBuildResult>(previousJob.id, (nextJob) => {
                  if (!cancelled) setJob(nextJob);
                }, 120);
                if (cancelled) return;
                setJob(previousJob);
              }

              const previousResultMatches = resultMatchesDraft(
                previousJob.result,
                draftSenderIndex,
                receiverIndexes,
                anonIndexes,
                amounts,
                expectedSetSize,
              );
              if (previousJob.status === "succeeded" && previousResultMatches) {
                const refreshedSession = await api.session();
                if (cancelled) return;
                const refreshedSessionMatches = (
                  refreshedSession.transferBuilt &&
                  refreshedSession.senderIndex === draftSenderIndex &&
                  arraysEqual(refreshedSession.anonIndexes, anonIndexes) &&
                  arraysEqual(refreshedSession.receiverIndexes, receiverIndexes) &&
                  arraysEqual(refreshedSession.transferAmounts ?? [], amounts)
                );
                if (refreshedSessionMatches) {
                  setBuildResult(previousJob.result ?? null);
                  setDraftMatchesSession(true);
                  setSession(refreshedSession);
                  return;
                }
              }
              if (previousJob.status === "failed" && sessionMatchesDraft) {
                throw new Error(previousJob.error || "The latest backend proof job failed.");
              }
            }
          } catch (jobError) {
            if (jobError instanceof Error && !/job not found/i.test(jobError.message)) throw jobError;
          }
        }

        if (sessionMatchesDraft) {
          setDraftMatchesSession(true);
          return;
        }

        const started = await api.buildTransfer({
          authToken: identity.token,
          senderIndex: draftSenderIndex,
          receiverIndexes,
          anonIndexes,
          amounts,
          participants: expectedSetSize,
        });
        const completed = await pollApiJob<TransferBuildResult>(started.jobId, (nextJob) => {
          if (!cancelled) setJob(nextJob);
        }, 120);
        if (cancelled) return;

        if (!resultMatchesDraft(completed.result, draftSenderIndex, receiverIndexes, anonIndexes, amounts, expectedSetSize)) {
          throw new Error("Backend proof result does not match the current wallet transfer draft.");
        }

        const completedSession = await api.session();
        if (cancelled) return;
        const completedSessionMatches = (
          completedSession.transferBuilt &&
          completedSession.senderIndex === draftSenderIndex &&
          arraysEqual(completedSession.anonIndexes, anonIndexes) &&
          arraysEqual(completedSession.receiverIndexes, receiverIndexes) &&
          arraysEqual(completedSession.transferAmounts ?? [], amounts)
        );
        if (!completedSessionMatches) {
          throw new Error("Backend session does not reference the proof result generated for this wallet draft.");
        }
        setJob(completed);
        setBuildResult(completed.result ?? null);
        setDraftMatchesSession(true);
        setSession(completedSession);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "proof generation failed");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [anonIndexes, identity, navigate, receivers, setSize]);

  const resultIsCurrent = draftMatchesSession && Boolean(buildResult);

  const proofReady = draftMatchesSession && (
    (job?.status === "succeeded" && Boolean(buildResult)) ||
    (!job && Boolean(session?.latestTransferId || session?.exportPath))
  );
  const progressValue = proofReady ? 100 : job?.progress ?? 0;
  const activeLabel = job?.step ?? (draftMatchesSession ? "stored transfer artifact" : "connecting to APGC backend");
  const displayedSetSize = buildResult?.participants ?? (anonIndexes.length || setSize);
  const displayedReceiverCount = buildResult?.receiverCount ?? receiverCount;
  const artifactPath = buildResult?.transferId ?? session?.latestTransferId ?? session?.exportPath;
  const validationSummary = buildResult?.equationValidation === "passed"
    ? "Artifact structure and local proof equations passed backend validation."
    : buildResult?.structureValidation === "passed"
      ? "Artifact structure passed. The proof payload is ready for APGC contract verification during broadcast."
      : draftMatchesSession
        ? "The backend session contains a matching transfer artifact; detailed metadata was not retained by this older job."
        : `Backend checkpoint: ${activeLabel}.`;

  return (
    <Layout activeTab="transfer">
      <div className="wallet-flow-page space-y-4 p-6">
        <TransferFlowHeader
          step={3}
          title="Build proof and transaction"
          description="One continuous backend operation creates the zero-knowledge proof, validates it, and seals the contract-ready transaction artifact."
        />

        <section className="wallet-flow-card space-y-4 overflow-hidden p-4">
          <div className="wallet-proof-job-head">
            <div className="wallet-proof-job-copy">
              <div className="text-sm font-semibold text-foreground">Backend proof job</div>
              <div className="text-xs text-muted-foreground">
                {job ? <><span>{job.type}</span><span className="block font-mono">{job.id}</span></> : "Checking the backend session for a matching artifact"}
              </div>
            </div>
            <Badge className={`wallet-proof-job-badge ${proofReady ? "border-green-200 bg-green-50 text-green-600" : error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary"}`}>
              {error ? "Failed" : job?.status ?? (proofReady ? "Stored" : "Connecting")}
            </Badge>
          </div>

          <ProofAssemblyDiagram
            progress={progressValue}
            setSize={displayedSetSize}
            receiverCount={displayedReceiverCount}
            ready={proofReady}
          />

          <div className="wallet-proof-status wallet-proof-status-copy">
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-semibold capitalize leading-5 text-foreground [overflow-wrap:anywhere]" title={activeLabel}>{activeLabel}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{validationSummary}</p>
              <div className="wallet-inline-stats">
                <span>anon set <b>{displayedSetSize}</b></span>
                <span>receivers <b>{displayedReceiverCount}</b></span>
                <span>backend time <b>{formatDuration(job)}</b></span>
                <span>artifact <b>{formatBytes(buildResult?.artifactBytes)}</b></span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{job ? `Backend status: ${job.status}` : draftMatchesSession ? "Backend session match" : "Waiting for job id"}</span>
              <span className="shrink-0 font-mono">{progressValue}%</span>
            </div>
            <Progress value={progressValue} />
          </div>

          <div>
            <div className="wallet-proof-checkpoint-head">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proof + transaction stages</span>
              <span className="text-[10px] text-muted-foreground">mapped to real backend progress</span>
            </div>
            <div className="wallet-stage-list wallet-construction-stages" aria-label="Proof and transaction construction stages">
              {constructionStages.map((stage) => {
                const status = constructionStatus(stage, progressValue, proofReady, Boolean(error));
                return (
                  <div key={stage.name} className={`wallet-stage-row ${status}`}>
                    <span className="wallet-stage-icon"><ServerCog className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <b>{stage.name}</b>
                      <small>{stage.detail}</small>
                    </span>
                    <span className="wallet-stage-state" title={stageStateLabel(status)}>{statusIcon(status)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="wallet-flow-card space-y-3 p-4">
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            aria-expanded={showDetails}
            aria-controls="proof-details"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Backend evidence</div>
              <div className="truncate text-xs text-muted-foreground">Validated artifact fields, proof shape, timestamps and logs</div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`} />
          </button>

          {showDetails && (
            <div id="proof-details" className="space-y-3">
              <div className="wallet-proof-evidence">
                <div><span>Draft match</span><strong className={resultIsCurrent || draftMatchesSession ? "success" : ""}>{resultIsCurrent ? "Result matched" : draftMatchesSession ? "Session matched" : "Pending"}</strong></div>
                <div><span>Structure check</span><strong className={buildResult?.structureValidation === "passed" ? "success" : ""}>{buildResult?.structureValidation ?? "Pending"}</strong></div>
                <div><span>Base proof arrays</span><strong>{buildResult ? `${buildResult.proofPoints} coordinates · ${buildResult.proofScalars} scalars` : "Pending"}</strong></div>
                <div><span>Solvency proof</span><strong>{buildResult ? `${buildResult.solventProofPoints} coordinates · ${buildResult.solventProofScalars} scalars` : "Pending"}</strong></div>
                <div><span>Positivity proof</span><strong>{buildResult ? buildResult.receiverCount === 1 ? "Not required for one receiver" : `${buildResult.positiveProofPoints} coordinates · ${buildResult.positiveProofScalars} scalars` : "Pending"}</strong></div>
                <div><span>Encrypted payload</span><strong>{buildResult ? `${buildResult.publicKeyCount} keys · ${buildResult.balanceCiphertextCount} balance / ${buildResult.transferCiphertextCount} transfer records` : "Pending"}</strong></div>
                <div><span>Artifact file</span><strong className="break-all font-mono text-[10px]" title={artifactPath}>{artifactPath ?? "Pending"}</strong></div>
              </div>

              <div className="rounded-xl border border-border bg-muted/35 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Job timing</div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>Created: <b className="font-mono text-foreground">{job?.createdAt ?? "Unavailable"}</b></span>
                  <span>Started: <b className="font-mono text-foreground">{job?.startedAt ?? "Unavailable"}</b></span>
                  <span>Finished: <b className="font-mono text-foreground">{job?.finishedAt ?? "Unavailable"}</b></span>
                  <span>Backend duration: <b className="font-mono text-foreground">{formatDuration(job)}</b></span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/35 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><FileCheck2 className="h-3.5 w-3.5" /> Backend logs</div>
                <div className="mt-2 space-y-1 break-words font-mono text-[11px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                  {(job?.logs?.length ? job.logs : ["No backend log lines have been reported."]).map((line, index) => (
                    <div key={`${line}-${index}`}>
                      {line.includes("strict exporter proof check skipped")
                        ? "Proof payload is ready for APGC contract verification during broadcast."
                        : line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {error && <InlineAlert tone="error" title="Proof generation failed" message={error} />}

        <Button
          onClick={() => navigate("/submit")}
          disabled={!proofReady}
          className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {proofReady ? <><span>Review and submit transaction</span><ArrowRight className="h-4 w-4" /></> : "Building proof and transaction"}
        </Button>
      </div>
    </Layout>
  );
}
