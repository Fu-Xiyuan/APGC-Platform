import {
  Activity,
  CheckCircle,
  CircleAlert,
  CircleDollarSign,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  RadioTower,
  RefreshCcw,
  Send,
  ShieldCheck,
  Shuffle,
  Sun,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import {
  api,
  firstCiphertextCommitment,
  shortAddress,
  shortHash,
  type ApiJob,
  type ChainStatus,
  type DemoAccount,
  type DemoSession,
  type DemoTransaction,
  type MonitorEvent,
  type MonitorSummary,
  type PublicAPGCAccount,
  type WalletBalanceResponse,
  type WalletStatus,
} from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive, saveProductIdentity, type ProductIdentity } from "@shared/productIdentity";
import {
  ContractExecutionDiagram,
  ProofAssemblyDiagram,
  RecipientFlowDiagram,
  type TransferVisualTarget,
} from "@shared/transferVisuals";
import { useEffect, useRef, useState } from "react";

type View = "overview" | "transfer" | "broadcast" | "activity" | "chain" | "settings";
type EntryMode = "login" | "register";
type ThemeMode = "dark" | "light";

const WEB_THEME_KEY = "apgc.web.theme";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(WEB_THEME_KEY) === "light" ? "light" : "dark";
}

function applyProductTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.apgcTheme = theme;
}

type ReceiverDraft = {
  participantIndex: number;
  amount: string;
};

const views: Array<{ id: View; label: string; icon: typeof ShieldCheck }> = [
  { id: "overview", label: "Home", icon: ShieldCheck },
  { id: "transfer", label: "Transfer", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "chain", label: "Chain", icon: Database },
  { id: "settings", label: "Settings", icon: WalletCards },
];

const fallbackReceiverCounts = [1, 2, 4, 8, 16, 32];
const powerSetSizes = [2, 4, 8, 16, 32, 64];

type ProcessStage = {
  start: number;
  next: number;
  name: string;
  detail: string;
};

const transferBuildStages: ProcessStage[] = [
  { start: 0, next: 18, name: "Prepare native exporter", detail: "Bind selected accounts, amounts, and shuffled positions" },
  { start: 18, next: 35, name: "Compile transaction builder", detail: "Compile the native APGC export pipeline" },
  { start: 35, next: 72, name: "Generate APGC proof", detail: "Create proof data and encrypted balance updates" },
  { start: 72, next: 80, name: "Load encrypted artifact", detail: "Read the generated transaction records" },
  { start: 80, next: 92, name: "Validate proof payload", detail: "Check structure and proof equations when enabled" },
  { start: 92, next: 101, name: "Seal transaction artifact", detail: "Store the validated contract-ready artifact" },
];

const contractSubmitStages: ProcessStage[] = [
  { start: 0, next: 10, name: "Load private payload", detail: "Open the sealed wallet artifact" },
  { start: 10, next: 35, name: "Check balance snapshot", detail: "Bind to the current encrypted account state" },
  { start: 35, next: 75, name: "Verify proof and execute", detail: "Call transferAPGCETH on the APGC contract" },
  { start: 75, next: 100, name: "Refresh equal account states", detail: "Read ciphertext and nonce updates for every member" },
  { start: 100, next: 101, name: "Finalize receipt", detail: "Record the block result for this wallet" },
];

const transferPhases = ["Recipients", "Privacy set", "Proof + transaction", "Contract execution", "Confirmed"];

function parseAmount(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPositiveInteger(value: string) {
  return /^[1-9]\d*$/.test(value.trim());
}

function statusBadge(ok?: boolean, okLabel = "Connected", badLabel = "Offline") {
  return <span className={`badge ${ok ? "ok" : "danger"}`}>{ok ? okLabel : badLabel}</span>;
}

async function pollJob<T = unknown>(id: string, onJob: (job: ApiJob<T>) => void) {
  for (;;) {
    const job = await api.job<T>(id);
    onJob(job);
    if (job.status === "succeeded") return job;
    if (job.status === "failed") throw new Error(job.error || `${job.type} failed`);
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
}

function shuffle(values: number[]) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function minPowerOfTwo(value: number) {
  let power = 2;
  while (power < value) power *= 2;
  return power;
}

function buildAnonIndexes(accounts: PublicAPGCAccount[], senderIndex: number, receivers: ReceiverDraft[], size: number) {
  const required = [senderIndex, ...receivers.map((receiver) => receiver.participantIndex)];
  const requiredSet = new Set(required);
  const decoys = shuffle(accounts.map((account) => account.participantIndex).filter((index) => !requiredSet.has(index)))
    .slice(0, Math.max(0, size - required.length));
  return shuffle([...required, ...decoys]);
}

function defaultReceivers(status: WalletStatus | null, identity: ProductIdentity | null, count = 1): ReceiverDraft[] {
  if (!identity) return [];
  return (status?.accounts ?? [])
    .filter((account) => account.participantIndex !== identity.user.participantIndex)
    .slice(0, count)
    .map((account) => ({ participantIndex: account.participantIndex, amount: "1" }));
}

function transactionTitle(tx: DemoTransaction) {
  if (tx.type === "deposit" || tx.type === "walletRegisterDeposit") return "Encrypted APGC deposit";
  if (tx.type === "fund") return "External ETH funding";
  return "Anonymous transfer";
}

function walletTransactionTitle(tx: DemoTransaction, account: DemoAccount | null, identity: ProductIdentity | null) {
  if (tx.type === "transferAPGCETH") {
    if (identity && tx.participant === identity.user.participantIndex) return "Outgoing anonymous transfer";
    if (account?.lastTx === tx.hash) return "Encrypted APGC state update";
    return "Anonymous transfer";
  }
  return transactionTitle(tx);
}

function walletRelevantTransactions(transactions: DemoTransaction[], account: DemoAccount | null, identity: ProductIdentity | null) {
  if (!identity) return [];
  return transactions.filter((tx) => (
    tx.participant === identity.user.participantIndex ||
    (tx.type === "transferAPGCETH" && account?.lastTx === tx.hash)
  ));
}

function StatCard(props: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <section className="stat-card">
      <div className="stat-icon">{props.icon}</div>
      <div>
        <div className="stat-label">{props.label}</div>
        <div className="stat-value">{props.value}</div>
        <div className="stat-detail">{props.detail}</div>
      </div>
    </section>
  );
}

const topologyLinks = [
  "M94 392 C198 302 286 278 410 334 S636 440 836 284",
  "M116 218 C276 166 356 214 458 306 S642 432 820 438",
  "M174 504 C276 432 374 420 490 346 S690 206 846 166",
  "M286 154 C376 244 466 270 554 334 S702 438 868 528",
  "M72 324 C236 356 324 454 470 374 S686 156 864 260",
  "M232 588 C322 452 418 430 526 354 S672 300 798 150",
];

const topologyNodes = [
  { x: 94, y: 392, kind: "outer" },
  { x: 116, y: 218, kind: "outer" },
  { x: 174, y: 504, kind: "outer" },
  { x: 286, y: 154, kind: "decoy" },
  { x: 232, y: 588, kind: "decoy" },
  { x: 410, y: 334, kind: "relay" },
  { x: 458, y: 306, kind: "relay" },
  { x: 490, y: 346, kind: "relay" },
  { x: 554, y: 334, kind: "relay" },
  { x: 636, y: 440, kind: "relay" },
  { x: 642, y: 432, kind: "relay" },
  { x: 690, y: 206, kind: "decoy" },
  { x: 702, y: 438, kind: "relay" },
  { x: 798, y: 150, kind: "outer" },
  { x: 820, y: 438, kind: "outer" },
  { x: 836, y: 284, kind: "outer" },
  { x: 846, y: 166, kind: "outer" },
  { x: 864, y: 260, kind: "outer" },
  { x: 868, y: 528, kind: "outer" },
];

function TopologyBackdrop() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Native SVG gradient animations need explicit pausing, unlike CSS animations.
    const syncMotion = () => {
      const svg = svgRef.current;
      if (!svg) return;
      if (motionPreference.matches || document.hidden) svg.pauseAnimations();
      else svg.unpauseAnimations();
    };
    syncMotion();
    motionPreference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncMotion);
    return () => {
      motionPreference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
    };
  }, []);

  return (
    <div className="topology-stage topology-flow-reference" aria-hidden="true">
      <svg ref={svgRef} className="topology-svg" viewBox="0 0 960 680" preserveAspectRatio="xMidYMid slice" role="presentation">
        <defs>
          <linearGradient id="topologyLine" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#14F1D9" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#F2B84B" />
          </linearGradient>
          <linearGradient id="topologyCore" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1CF2D2" />
            <stop offset="100%" stopColor="#276DF2" />
          </linearGradient>
          {/* Moving gradient treatment: Magic UI Animated Beam / Aceternity Background Beams. */}
          {topologyLinks.map((_, index) => {
            const reverse = index === 2 || index === 5;
            return (
              <linearGradient
                key={index}
                id={`topologyBeam${index}`}
                gradientUnits="userSpaceOnUse"
                x1={reverse ? 260 : 0}
                x2={reverse ? 0 : 260}
                y1="0"
                y2="0"
              >
                <stop offset="0%" stopColor="#14F1D9" stopOpacity="0" />
                <stop offset="35%" stopColor="#14F1D9" stopOpacity="0.45" />
                <stop offset="75%" stopColor="#38BDF8" />
                <stop offset="92%" stopColor="#87F4F2" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  from={reverse ? "1000 0" : "-300 0"}
                  to={reverse ? "-300 0" : "1000 0"}
                  dur={`${7 + index * 0.65}s`}
                  begin={`${-index * 1.4 - 1}s`}
                  repeatCount="indefinite"
                />
              </linearGradient>
            );
          })}
        </defs>
        <g className="topology-orbit">
          <ellipse cx="510" cy="338" rx="282" ry="154" />
          <ellipse cx="510" cy="338" rx="386" ry="220" />
        </g>
        <g>
          {topologyLinks.map((link, index) => (
            <path key={`link-${link}`} className={`topology-link topology-link-${index}`} d={link} />
          ))}
        </g>
        <g className="topology-beams">
          {topologyLinks.map((link, index) => (
            <g key={link} stroke={`url(#topologyBeam${index})`}>
              <path className="topology-beam-bloom" d={link} />
              <path className="topology-beam-line" d={link} />
            </g>
          ))}
        </g>
        <g>
          {topologyLinks.slice(0, 4).map((link, index) => (
            <path key={`packet-${link}`} className={`topology-packet topology-packet-${index}`} d={link} />
          ))}
        </g>
        <g>
          {topologyNodes.map((node, index) => (
            <g
              key={`${node.x}-${node.y}`}
              className={`topology-node topology-node-${node.kind}`}
              style={{ animationDelay: `${index * 0.16}s` }}
              transform={`translate(${node.x} ${node.y})`}
            >
              <circle className="topology-node-aura" r={node.kind === "relay" ? 18 : 15} />
              <circle className="topology-node-dot" r={node.kind === "relay" ? 6 : 5} />
            </g>
          ))}
        </g>
        <g className="topology-core" transform="translate(510 338)">
          <circle className="topology-core-shell" r="108" />
          <circle className="topology-core-fill" r="76" />
          <text
            className="topology-core-title"
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="central"
          >
            APGC
          </text>
        </g>
      </svg>
    </div>
  );
}

function JobPanel({ job }: { job: ApiJob | null }) {
  if (!job) {
    return (
      <section className="panel">
        <div className="panel-title"><Loader2 size={18} /> Job Status</div>
        <div className="empty">No active wallet job.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title"><Loader2 size={18} /> Job Status</div>
      <div className="job-head">
        <div>
          <div className="job-type">{job.type}</div>
          <div className="job-step">{job.step}</div>
        </div>
        <span className={`badge ${job.status === "failed" ? "danger" : job.status === "succeeded" ? "ok" : "neutral"}`}>{job.status}</span>
      </div>
      <div className="progress"><div style={{ width: `${job.progress}%` }} /></div>
      <div className="logs">
        {job.logs.length ? job.logs.slice(-7).map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : "Waiting for backend logs."}
        {job.error && <div className="log-error">{job.error}</div>}
      </div>
    </section>
  );
}

function ProductEntry(props: {
  status: WalletStatus | null;
  chain: ChainStatus | null;
  theme: ThemeMode;
  onComplete: (identity: ProductIdentity) => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
}) {
  const [mode, setMode] = useState<EntryMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [initialBalance, setInitialBalance] = useState("8");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const ready = Boolean(props.status?.ready);

  const submit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "register") {
        await api.walletRegister({ username: username.trim(), password, initialBalance });
        setMode("login");
        setPassword("");
        setNotice("Account registered on APGC. Log in with the same credentials to enter the wallet.");
        await props.onRefresh();
        return;
      }
      const auth = await api.walletLogin({ username: username.trim(), password });
      props.onComplete(saveProductIdentity({ token: auth.token, user: auth.user }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="entry-shell">
      <section className="entry-card" aria-label="AnonymousPGC account access">
        <div className="entry-visual">
          <TopologyBackdrop />
          <div className="entry-brand">
            <div className="brand-mark"><ShieldCheck size={24} /></div>
            <div>
              <div className="brand-title">AnonymousPGC</div>
              <div className="brand-subtitle">Ethereum Anonymous Payment Layer</div>
            </div>
          </div>

          <div className="entry-visual-body">
            <div className="entry-copy">
              <div className="eyebrow">Smart-contract verified privacy wallet</div>
              <h1>Privacy Preserving Account-Based Cryptocurrency</h1>
              <p>
                No one can read your balance or uncover your identity.
              </p>
            </div>
          </div>
        </div>

        <div className="entry-access">
          <div className="entry-access-shell">
            <button
              type="button"
              className="theme-toggle entry-theme-toggle"
              onClick={props.onToggleTheme}
              aria-label={`Switch to ${props.theme === "dark" ? "light" : "dark"} theme`}
            >
              {props.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              {props.theme === "dark" ? "Light" : "Dark"}
            </button>
            <div className="entry-access-header">
              <span>Wallet access</span>
              <h2>{ready ? "Sign in to AnonymousPGC" : "Genesis required before access"}</h2>
              <p>
                {ready
                  ? "Use your APGC account credentials to enter the encrypted wallet."
                  : "The wallet opens after the monitor initializes the APGC contract and genesis state."}
              </p>
            </div>

            {!ready ? (
              <div className="locked-panel">
                <div className="locked-icon"><ShieldCheck size={22} /></div>
                <div>
                  <strong>Wallet gate locked</strong>
                  <p>{props.status?.reason ?? "Waiting for APGC API and genesis status."}</p>
                  <button type="button" className="button secondary" onClick={props.onRefresh}><RefreshCcw size={15} /> Refresh status</button>
                </div>
              </div>
            ) : (
              <div className="entry-auth-card">
                <div className="entry-tabs" role="tablist" aria-label="Account access mode">
                  <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}><LogIn size={16} /> Login</button>
                  <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}><UserPlus size={16} /> Register</button>
                </div>

                <div className="entry-form">
                  <label htmlFor="entry-name">Username
                    <input id="entry-name" value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
                  </label>
                  <label htmlFor="entry-password">Password
                    <input id="entry-password" type="password" value={password} autoComplete={mode === "login" ? "current-password" : "new-password"} onChange={(event) => setPassword(event.target.value)} />
                  </label>
                  {mode === "register" && (
                    <label htmlFor="entry-balance">Demo initial APGC
                      <input id="entry-balance" value={initialBalance} inputMode="numeric" onChange={(event) => setInitialBalance(event.target.value)} />
                    </label>
                  )}
                </div>

                <div className="actions">
                  <button type="button" className="button primary" onClick={submit} disabled={busy}>
                    {busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
                    {mode === "login" ? "Enter Wallet" : "Register APGC Account"}
                  </button>
                </div>
              </div>
            )}

            {notice && <div className="alert success inline" role="status"><CheckCircle size={17} /> {notice}</div>}
            {error && <div className="alert inline" role="alert"><CircleAlert size={17} /> {error}</div>}

            <div className="entry-network-strip" aria-label="APGC runtime status">
              <div>
                <span>Chain</span>
                {statusBadge(Boolean(props.chain?.connected), "Connected", "Offline")}
              </div>
              <div>
                <span>API</span>
                <strong className="mono">{api.baseUrl.replace(/^https?:\/\//, "")}</strong>
              </div>
              <div>
                <span>Access</span>
                <strong className={ready ? "entry-network-ok" : ""}>{ready ? "Open" : "Locked"}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AccountTable(props: {
  accounts: DemoAccount[];
  publicAccounts?: PublicAPGCAccount[];
  selectedIndex?: number;
}) {
  if (!props.accounts.length) return <div className="empty">No APGC accounts initialized.</div>;

  return (
    <div className="public-account-grid">
      {props.accounts.map((account) => {
        const selected = account.index === props.selectedIndex;
        const publicAccount = props.publicAccounts?.find((item) => item.participantIndex === account.index);
        const fingerprint = publicAccount?.publicKeyFingerprint ?? shortHash(account.publicKey.join(":"));
        const ciphertextPreview = firstCiphertextCommitment(publicAccount?.ciphertext, account.ciphertext);
        return (
          <article key={account.index} className={`public-account-card ${selected ? "selected" : ""}`}>
            <div className="public-account-top">
              <span className="badge neutral">{selected ? "current wallet" : publicAccount?.registered ? "claimed" : "public key"}</span>
              <span className="mono">{account.nonce || "0"}</span>
            </div>
            <div className="public-account-fingerprint mono">{fingerprint}</div>
            <div className="public-account-row">
              <span>Balance ciphertext</span>
              <strong className="mono">{ciphertextPreview ? shortHash(ciphertextPreview) : "pending"}</strong>
            </div>
            <div className="public-account-row">
              <span>Last transaction</span>
              <strong className="mono">{shortHash(account.lastTx)}</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TransactionList(props: {
  transactions: DemoTransaction[];
  titleFor?: (transaction: DemoTransaction) => string;
  emptyText?: string;
}) {
  const titleFor = props.titleFor ?? transactionTitle;
  if (!props.transactions.length) return <div className="empty">{props.emptyText ?? "No transactions recorded yet."}</div>;

  return (
    <div className="tx-list">
      {props.transactions.slice(0, 12).map((tx) => (
        <article key={tx.id} className="tx-item tx-row">
          <div className="tx-icon"><Activity size={18} /></div>
          <div className="tx-title">{titleFor(tx)}</div>
          <div className="tx-meta">block #{tx.blockNumber || "-"} / gas {tx.gasUsed || "-"} / {tx.status}</div>
          <div className="mono tx-hash">{shortHash(tx.hash)}</div>
          <div className="tx-amount">{tx.amount ? `${tx.amount} APGC` : "-"}</div>
        </article>
      ))}
    </div>
  );
}

function EventTimeline({ events }: { events: MonitorEvent[] }) {
  if (!events.length) return <div className="empty">Events will appear after deposit or transfer.</div>;

  return (
    <div className="timeline">
      {events.slice(0, 12).map((event, index) => (
        <article key={`${event.txHash}-${index}`} className="timeline-item event-row">
          <div className="timeline-dot" />
          <div className="timeline-type">{event.type}</div>
          <div className="timeline-summary">{event.summary}</div>
          <div className="mono timeline-meta">#{event.blockNumber || "-"} / {shortHash(event.txHash)}</div>
        </article>
      ))}
    </div>
  );
}

function RingPreview(props: { anonIndexes: number[]; senderIndex: number; receivers: ReceiverDraft[] }) {
  const indexes = props.anonIndexes.length ? props.anonIndexes : [props.senderIndex, ...props.receivers.map((receiver) => receiver.participantIndex)];
  const receiverSet = new Set(props.receivers.map((receiver) => receiver.participantIndex));
  const count = Math.max(2, indexes.length);

  return (
    <div className="anonymity-ring" aria-label="Anonymity ring preview">
      <svg className="ring-svg" viewBox="0 0 420 420" role="img" aria-label={`${count} participant APGC anonymity ring`}>
        <defs>
          <linearGradient id="desktopRingCore" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1CF2D2" />
            <stop offset="100%" stopColor="#276DF2" />
          </linearGradient>
          <linearGradient id="desktopRingSignal" x1="30" x2="390" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14F1D9" stopOpacity="0" />
            <stop offset="48%" stopColor="#14F1D9" />
            <stop offset="78%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx="210" cy="210" r="154" />
        <circle className="ring-inner-track" cx="210" cy="210" r="92" />
        <circle className="ring-signal" cx="210" cy="210" r="154" stroke="url(#desktopRingSignal)" />
        <circle className="ring-signal inner" cx="210" cy="210" r="92" stroke="url(#desktopRingSignal)" />
        {indexes.map((globalIndex, localIndex) => {
          const angle = -90 + (360 / count) * localIndex;
          const x = 210 + 154 * Math.cos((angle * Math.PI) / 180);
          const y = 210 + 154 * Math.sin((angle * Math.PI) / 180);
          const role = globalIndex === props.senderIndex ? "sender" : receiverSet.has(globalIndex) ? "receiver" : "decoy";
          return (
            <g key={`${globalIndex}-${localIndex}`} className={`ring-participant ${role}`}>
              <circle cx={x} cy={y} r={count > 32 ? 8 : 12} />
              {count <= 32 && <text x={x} y={y + 4}>{role === "sender" ? "S" : role === "receiver" ? "R" : "D"}</text>}
            </g>
          );
        })}
        <circle className="ring-center-shell" cx="210" cy="210" r="76" />
        <circle className="ring-center-core" cx="210" cy="210" r="58" fill="url(#desktopRingCore)" />
        <text className="ring-center-title" x="210" y="202">APGC</text>
        <text className="ring-center-subtitle" x="210" y="224">{count} MEMBERS</text>
      </svg>
      <div className="ring-legend" aria-hidden="true">
        <span><i className="legend-dot sender" />Sender</span>
        <span><i className="legend-dot receiver" />Receiver</span>
        <span><i className="legend-dot decoy" />Decoy</span>
      </div>
    </div>
  );
}

function ProcessStageList(props: { stages: ProcessStage[]; progress: number; complete?: boolean; failed?: boolean; started?: boolean }) {
  return (
    <div className="desktop-process-stages">
      {props.stages.map((stage) => {
        const complete = props.complete || props.progress >= stage.next;
        const active = !complete && props.started !== false && props.progress >= stage.start;
        const failed = active && props.failed;
        return (
          <div key={stage.name} className={`desktop-process-stage ${complete ? "complete" : failed ? "failed" : active ? "active" : "pending"}`}>
            <span className="desktop-process-dot">{complete ? <CheckCircle size={14} /> : active ? <Loader2 size={14} /> : null}</span>
            <span><strong>{stage.name}</strong><small>{stage.detail}</small></span>
            <b>{complete ? "DONE" : failed ? "FAILED" : active ? "LIVE" : "PENDING"}</b>
          </div>
        );
      })}
    </div>
  );
}

function TransferPhaseStrip(props: { current: number; complete?: boolean }) {
  return (
    <div className="desktop-transfer-phases" aria-label={`Private transfer stage ${props.complete ? "complete" : props.current}`}>
      {transferPhases.map((phase, index) => {
        const position = index + 1;
        const state = props.complete || position < props.current ? "complete" : position === props.current ? "active" : "pending";
        return (
          <div key={phase} className={`desktop-transfer-phase ${state}`}>
            <span>{position}</span>
            <strong>{phase}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function App() {
  const [view, setView] = useState<View>("overview");
  const [identity, setIdentity] = useState<ProductIdentity | null>(() => getProductIdentity());
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [walletBalance, setWalletBalance] = useState<WalletBalanceResponse | null>(null);
  const [showDecryptedBalance, setShowDecryptedBalance] = useState(false);
  const [job, setJob] = useState<ApiJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [receivers, setReceivers] = useState<ReceiverDraft[]>([]);
  const [anonIndexes, setAnonIndexes] = useState<number[]>([]);

  useEffect(() => {
    applyProductTheme(theme);
    window.localStorage.setItem(WEB_THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => current === "dark" ? "light" : "dark");
  };

  const refresh = async () => {
    const [nextChain, nextSession, nextSummary, nextWalletStatus] = await Promise.all([
      api.chainStatus(),
      api.session().catch(() => null),
      api.monitorSummary().catch(() => null),
      api.walletStatus().catch(() => null),
    ]);
    setChain(nextChain);
    setSession(nextSession);
    setSummary(nextSummary);
    setWalletStatus(nextWalletStatus);
    if (identity) {
      api.walletBalance(identity.token).then(setWalletBalance).catch(() => setWalletBalance(null));
    } else {
      setWalletBalance(null);
    }
    if (identity && nextWalletStatus && !productIdentityIsActive(identity, nextWalletStatus)) {
      clearProductIdentity();
      setIdentity(null);
      setView("overview");
      setReceivers([]);
      setAnonIndexes([]);
      return;
    }
    setReceivers((current) => current.length ? current : defaultReceivers(nextWalletStatus, identity, 1));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await refresh();
        if (!cancelled) setError("");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "APGC API unavailable");
      }
    };
    load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [identity?.token]);

  useEffect(() => {
    if (!identity || !walletStatus) return;
    const minSize = minPowerOfTwo(receivers.length + 1);
    const size = powerSetSizes.find((candidate) => candidate >= minSize && candidate <= walletStatus.accounts.length) ?? minSize;
    if (!anonIndexes.length || anonIndexes.length < minSize) {
      setAnonIndexes(buildAnonIndexes(walletStatus.accounts, identity.user.participantIndex, receivers, size));
    }
  }, [identity, walletStatus, receivers.length]);

  const accounts = summary?.accounts ?? session?.accounts ?? [];
  const currentAccount = identity ? accounts.find((account) => account.index === identity.user.participantIndex) ?? null : null;
  const currentPublicAccount = identity
    ? walletStatus?.accounts.find((account) => account.participantIndex === identity.user.participantIndex) ?? null
    : null;
  const transactions = summary?.transactions ?? session?.transactions ?? [];
  const walletTransactions = walletRelevantTransactions(transactions, currentAccount, identity);
  const events = summary?.events ?? [];
  const totalTransferAmount = receivers.reduce((sum, receiver) => sum + parseAmount(receiver.amount), 0);
  const transferVisualTargets: TransferVisualTarget[] = receivers.map((receiver, index) => ({
    id: `${receiver.participantIndex}-${index}`,
    label: `Receiver ${index + 1}`,
    amount: `${parseAmount(receiver.amount)} APGC`,
  }));
  const balance = parseAmount(walletBalance?.balance ?? "0");
  const supportedReceiverCounts = walletStatus?.receiverCounts?.length ? walletStatus.receiverCounts : fallbackReceiverCounts;
  const allowedReceiverCounts = supportedReceiverCounts.filter((count) => count <= Math.max(0, (walletStatus?.accounts.length ?? 1) - 1));
  const allowedSetSizes = powerSetSizes.filter((size) => size >= minPowerOfTwo(receivers.length + 1) && size <= (walletStatus?.accounts.length ?? 0));
  const viewTitle = view === "broadcast" ? "Broadcast" : views.find((item) => item.id === view)?.label ?? "Home";
  const ciphertextPreview = firstCiphertextCommitment(walletBalance?.ciphertext, currentPublicAccount?.ciphertext, currentAccount?.ciphertext);
  const privateBalanceValue = showDecryptedBalance && walletBalance
    ? `${walletBalance.balance} APGC`
    : ciphertextPreview ? "Ciphertext" : "Pending";
  const showInspector = view === "transfer" || view === "broadcast" || job?.status === "running";
  const walletOwnsTransfer = Boolean(session?.transferBuilt && session.senderIndex === identity?.user.participantIndex);

  const completeEntry = (nextIdentity: ProductIdentity) => {
    setIdentity(nextIdentity);
    setView("overview");
    setReceivers(defaultReceivers(walletStatus, nextIdentity, 1));
  };

  const logout = () => {
    clearProductIdentity();
    setIdentity(null);
    setView("overview");
  };

  const updateReceiverCount = (count: number) => {
    if (!walletStatus || !identity) return;
    const available = walletStatus.accounts.filter((account) => account.participantIndex !== identity.user.participantIndex);
    const next = available.slice(0, count).map((account, index) => receivers[index] && available.some((item) => item.participantIndex === receivers[index].participantIndex)
      ? receivers[index]
      : { participantIndex: account.participantIndex, amount: "1" });
    setReceivers(next);
    setAnonIndexes([]);
  };

  const updateReceiver = (position: number, patch: Partial<ReceiverDraft>) => {
    setReceivers((current) => current.map((receiver, index) => index === position ? { ...receiver, ...patch } : receiver));
    setAnonIndexes([]);
  };

  const rerandomize = (size = anonIndexes.length) => {
    if (!identity || !walletStatus) return;
    setAnonIndexes(buildAnonIndexes(walletStatus.accounts, identity.user.participantIndex, receivers, size));
  };

  const validateTransfer = () => {
    if (!identity) return "Log in before building a transfer.";
    if (!walletStatus?.ready) return walletStatus?.reason ?? "AnonymousPGC is not ready.";
    if (!currentAccount) return "Current account is not synchronized.";
    if (!allowedReceiverCounts.includes(receivers.length)) return `Receiver count must be one of ${allowedReceiverCounts.join(", ")}.`;
    if (new Set(receivers.map((receiver) => receiver.participantIndex)).size !== receivers.length) return "Receivers must be unique.";
    if (receivers.some((receiver) => receiver.participantIndex === identity.user.participantIndex)) return "Sender cannot also be a receiver.";
    if (receivers.some((receiver) => !isPositiveInteger(receiver.amount))) return "Each receiver amount must be a positive integer.";
    if (!walletBalance) return "Wallet balance is still syncing from the encrypted chain state.";
    if (totalTransferAmount >= balance) return "Transfer total must be smaller than your current APGC balance.";
    if (!anonIndexes.length) return "Randomize an anonymity set before proof generation.";
    return "";
  };

  const buildProof = async () => {
    const validation = validateTransfer();
    if (validation) {
      setError(validation);
      return;
    }
    setJob(null);
    setBusy("proof");
    setError("");
    try {
      const started = await api.buildTransfer({
        authToken: identity?.token,
        senderIndex: identity?.user.participantIndex,
        receiverIndexes: receivers.map((receiver) => receiver.participantIndex),
        amounts: receivers.map((receiver) => receiver.amount),
        anonIndexes,
        participants: anonIndexes.length,
      });
      await pollJob(started.jobId, setJob);
      await refresh();
      setView("broadcast");
    } catch (err) {
      setError(err instanceof Error ? err.message : "proof generation failed");
    } finally {
      setBusy("");
    }
  };

  const broadcast = async () => {
    if (!session?.latestTransferId) {
      setError("No transfer artifact is ready for broadcast.");
      return;
    }
    setJob(null);
    setBusy("broadcast");
    setError("");
    try {
      const started = await api.submitTransfer(session.latestTransferId, identity?.token ?? "");
      await pollJob(started.jobId, setJob);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "broadcast failed");
    } finally {
      setBusy("");
    }
  };

  const renderView = () => {
    if (view === "overview") {
      return (
        <>
          <section className="stats-grid">
            <StatCard icon={<WalletCards size={22} />} label="My Account" value={identity?.user.username ?? "-"} detail={identity?.user.publicKeyFingerprint ?? "No wallet identity"} />
            <StatCard icon={<CircleDollarSign size={22} />} label="Private Balance" value={privateBalanceValue} detail={showDecryptedBalance && walletBalance?.verified ? "opened with wallet key" : "encrypted chain state"} />
            <StatCard icon={<Send size={22} />} label="Activity" value={String(walletTransactions.length)} detail="wallet-visible chain updates" />
          </section>
          <section className="panel wide account-state-panel">
            <div className="panel-title"><ShieldCheck size={18} /> Encrypted account state</div>
            <div className="review-grid">
              <div><span>State nonce</span><strong className="mono">{walletBalance?.nonce ?? currentPublicAccount?.nonce ?? currentAccount?.nonce ?? "-"}</strong></div>
              <div><span>Balance ciphertext</span><strong className="mono">{ciphertextPreview ? shortHash(ciphertextPreview) : "pending"}</strong></div>
              <div><span>APGCSystem</span><strong className="mono">{shortAddress(chain?.contracts?.APGCSystem ?? session?.contractAddress)}</strong></div>
            </div>
            <div className="actions">
              <button type="button" className="button secondary" disabled={!walletBalance} onClick={() => setShowDecryptedBalance((value) => !value)}>
                {showDecryptedBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                {showDecryptedBalance ? "Hide Balance" : "Decrypt Balance"}
              </button>
            </div>
          </section>
        </>
      );
    }

    if (view === "transfer") {
      const publicAccounts = (walletStatus?.accounts ?? []).filter((account) => account.participantIndex !== identity?.user.participantIndex);
      const buildingTransfer = busy === "proof";
      const buildProgress = job?.type === "transfer-build" ? job.progress : 0;
      return (
        <section className="panel wide">
          <div className="panel-title"><Users size={18} /> Transfer Builder</div>
          <TransferPhaseStrip current={buildingTransfer ? 3 : 2} />
          <RecipientFlowDiagram
            targets={transferVisualTargets}
            total={`${totalTransferAmount} APGC`}
            size="wide"
          />
          <div className="split">
            <div className="form-stack">
              <div className="summary-line"><span>Sender</span><strong>{identity?.user.publicKeyFingerprint} / {walletBalance ? `${balance} APGC` : "syncing balance"}</strong></div>
              <label>Receiver Count
                <select value={receivers.length} onChange={(event) => updateReceiverCount(Number(event.target.value))}>
                  {allowedReceiverCounts.map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>
              {receivers.map((receiver, index) => {
                const selected = new Set(receivers.map((item) => item.participantIndex));
                const available = publicAccounts.filter((account) => !selected.has(account.participantIndex) || account.participantIndex === receiver.participantIndex);
                return (
                  <div key={index} className="receiver-row">
                    <label>Receiver {index + 1}
                      <select value={receiver.participantIndex} onChange={(event) => updateReceiver(index, { participantIndex: Number(event.target.value) })}>
                        {available.map((account) => <option key={account.participantIndex} value={account.participantIndex}>{account.publicKeyFingerprint}</option>)}
                      </select>
                    </label>
                    <label>Amount
                      <input value={receiver.amount} inputMode="numeric" onChange={(event) => updateReceiver(index, { amount: event.target.value })} />
                    </label>
                  </div>
                );
              })}
              <label>Anonymity Set Size
                <select value={anonIndexes.length || allowedSetSizes[0] || 0} onChange={(event) => rerandomize(Number(event.target.value))}>
                  {allowedSetSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <div className="summary-line"><span>Total</span><strong>{totalTransferAmount} APGC</strong></div>
              <div className="actions">
                <button type="button" className="button secondary" onClick={() => rerandomize()}><Shuffle size={16} /> Randomize Ring</button>
                <button type="button" className="button primary" onClick={buildProof} disabled={Boolean(busy)}><ShieldCheck size={16} /> Build Proof + Transaction</button>
              </div>
            </div>
            {buildingTransfer ? (
              <div className="desktop-build-visual">
                <ProofAssemblyDiagram
                  progress={buildProgress}
                  setSize={anonIndexes.length}
                  receiverCount={receivers.length}
                  ready={job?.type === "transfer-build" && job.status === "succeeded"}
                />
                <ProcessStageList
                  stages={transferBuildStages}
                  progress={buildProgress}
                  failed={Boolean(error) || job?.status === "failed"}
                  started={buildingTransfer}
                />
              </div>
            ) : (
              <RingPreview anonIndexes={anonIndexes} senderIndex={identity?.user.participantIndex ?? 0} receivers={receivers} />
            )}
          </div>
        </section>
      );
    }

    if (view === "broadcast") {
      const broadcastReceivers = session?.receiverIndexes?.length
        ? session.receiverIndexes.map((participantIndex, index) => ({ participantIndex, amount: session.transferAmounts?.[index] ?? "1" }))
        : receivers;
      const broadcastTargets: TransferVisualTarget[] = broadcastReceivers.map((receiver, index) => ({
        id: `${receiver.participantIndex}-${index}`,
        label: `Receiver ${index + 1}`,
        amount: `${parseAmount(receiver.amount)} APGC`,
      }));
      const confirmed = Boolean(session?.transferSubmitted);
      const submitProgress = confirmed ? 100 : job?.type === "transfer-submit" ? job.progress : 0;
      return (
        <section className="panel wide">
          <div className="panel-title"><Send size={18} /> Contract Submission</div>
          <TransferPhaseStrip current={confirmed ? 5 : 4} complete={confirmed} />
          <ContractExecutionDiagram
            targets={broadcastTargets}
            total={`${broadcastReceivers.reduce((sum, receiver) => sum + parseAmount(receiver.amount), 0)} APGC`}
            setSize={session?.anonIndexes?.length || anonIndexes.length}
            active={busy === "broadcast"}
            confirmed={confirmed}
            progress={submitProgress}
            size="wide"
          />
          <div className="desktop-submit-status">
            <div className="job-head">
              <div>
                <div className="job-type">{confirmed ? "Encrypted account state finalized" : job?.step || "Ready for APGC contract submission"}</div>
                <div className="job-step">Every selected account is processed uniformly inside the contract view.</div>
              </div>
              <span className={`badge ${confirmed ? "ok" : "neutral"}`}>{submitProgress}%</span>
            </div>
            <div className="progress"><div style={{ width: `${submitProgress}%` }} /></div>
            <ProcessStageList
              stages={contractSubmitStages}
              progress={submitProgress}
              complete={confirmed}
              failed={Boolean(error) || job?.status === "failed"}
              started={busy === "broadcast" || submitProgress > 0}
            />
          </div>
          <div className="review-grid">
            <div><span>Sender</span><strong className="mono">{identity?.user.publicKeyFingerprint}</strong></div>
            <div><span>Receivers</span><strong>{broadcastReceivers.length}</strong></div>
            <div><span>Amounts</span><strong>{(session?.transferAmounts?.length ? session.transferAmounts : receivers.map((receiver) => receiver.amount)).join(", ")}</strong></div>
            <div><span>Anon Set</span><strong>{session?.anonIndexes?.length || anonIndexes.length}</strong></div>
            <div><span>Contract</span><strong className="mono">{shortAddress(chain?.contracts?.APGCSystem ?? session?.contractAddress)}</strong></div>
            <div><span>Artifact</span><strong className="mono">{shortHash(session?.latestTransferId)}</strong></div>
          </div>
          {confirmed && (
            <div className="desktop-transfer-success">
              <CheckCircle size={22} />
              <span><strong>Private transfer confirmed</strong><small>The proof was accepted and all selected encrypted account states were updated.</small></span>
            </div>
          )}
          <div className="actions">
            {confirmed ? (
              <button type="button" className="button primary" onClick={() => setView("chain")}><Database size={16} /> View Contract State</button>
            ) : (
              <button type="button" className="button primary" onClick={broadcast} disabled={Boolean(busy) || !walletOwnsTransfer}><Send size={16} /> Submit to APGC Contract</button>
            )}
            <button type="button" className="button secondary" onClick={() => setView("transfer")}>{confirmed ? "Start Another Transfer" : "Back to Transfer"}</button>
          </div>
        </section>
      );
    }

    if (view === "chain") {
      return (
        <>
          <section className="panel wide">
            <div className="panel-title"><Database size={18} /> APGC Contract State</div>
            <p className="panel-copy compact">
              Public chain view: APGC accounts expose public keys, ciphertext commitments, nonce values, and transaction references. Plain balances are not displayed here.
            </p>
            <AccountTable accounts={accounts} publicAccounts={walletStatus?.accounts} selectedIndex={identity?.user.participantIndex} />
          </section>
          <section className="content-grid">
            <section className="panel"><div className="panel-title"><Activity size={18} /> Public Transactions</div><TransactionList transactions={transactions} /></section>
            <section className="panel"><div className="panel-title"><KeyRound size={18} /> Contract Events</div><EventTimeline events={events} /></section>
          </section>
        </>
      );
    }

    if (view === "settings") {
      return (
        <section className="panel wide">
          <div className="panel-title"><WalletCards size={18} /> Settings</div>
          <div className="review-grid">
            <div><span>Username</span><strong>{identity?.user.username}</strong></div>
            <div><span>Public key</span><strong className="mono">{identity?.user.publicKeyFingerprint}</strong></div>
            <div><span>API</span><strong className="mono">{api.baseUrl}</strong></div>
            <div><span>Network</span><strong>{chain?.connected ? chain.networkName : "offline"}</strong></div>
          </div>
          <div className="actions">
            <button type="button" className="button secondary" onClick={refresh}><RefreshCcw size={16} /> Refresh State</button>
            <button type="button" className="button secondary" onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              {theme === "dark" ? "Light Theme" : "Dark Theme"}
            </button>
            <button type="button" className="button danger" onClick={logout}><LogOut size={16} /> Sign Out</button>
          </div>
        </section>
      );
    }

    return (
      <section className="panel wide">
        <div className="panel-title"><Activity size={18} /> Wallet Activity</div>
        <p className="panel-copy compact">
          Wallet view: shows actions authored by this account plus encrypted state updates that this wallet can observe locally.
        </p>
        <TransactionList
          transactions={walletTransactions}
          titleFor={(tx) => walletTransactionTitle(tx, currentAccount, identity)}
          emptyText="No wallet-visible activity yet."
        />
      </section>
    );
  };

  if (!identity) {
    return (
      <ProductEntry
        status={walletStatus}
        chain={chain}
        theme={theme}
        onComplete={completeEntry}
        onRefresh={refresh}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="APGC web wallet navigation">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={22} /></div>
          <div>
            <div className="brand-title">AnonymousPGC</div>
            <div className="brand-subtitle">Web Wallet</div>
          </div>
        </div>
        <div className="identity-card">
          <div className="identity-name">{identity.user.username}</div>
          <div className="identity-index mono">{identity.user.publicKeyFingerprint}</div>
        </div>
        <nav className="nav-list">
          {views.map((item) => {
            const Icon = item.icon;
            const active = item.id === view;
            return (
              <button key={item.id} type="button" className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => setView(item.id)}>
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">APGC Web Wallet</div>
            <h1>{viewTitle}</h1>
          </div>
          <div className="status-group">
            {statusBadge(Boolean(chain?.connected), "Ganache connected", "Ganache offline")}
            <span className={walletStatus?.ready ? "badge ok" : "badge neutral"}>{walletStatus?.ready ? "Wallets open" : "Wallets locked"}</span>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button type="button" className="button secondary compact" onClick={refresh}><RefreshCcw size={15} /> Refresh</button>
          </div>
        </header>

        <section className="chain-strip">
          <div><div className="strip-label">RPC</div><div className="strip-value">{chain?.rpcUrl ?? "http://127.0.0.1:8545"}</div></div>
          <div><div className="strip-label">APGCSystem</div><div className="strip-value mono">{shortAddress(chain?.contracts?.APGCSystem ?? session?.contractAddress)}</div></div>
          <div><div className="strip-label">Block</div><div className="strip-value">{chain?.latestBlock ?? "-"}</div></div>
          <div><div className="strip-label">Session</div><div className="strip-value">{session?.status ?? "none"}</div></div>
        </section>

        {error && <section className="alert" role="alert"><CircleAlert size={17} /> {error}</section>}
        {busy && <section className="busy" role="status"><Loader2 size={16} className="spin" /> Running {busy}...</section>}

        <div className={`content-layout ${showInspector ? "" : "single"}`}>
          <div className="workspace">{renderView()}</div>
          {showInspector && (
            <aside className="inspector">
              <JobPanel job={job} />
              <section className="panel">
                <div className="panel-title"><RadioTower size={18} /> Transfer Session</div>
                <div className="kv"><span>APGC accounts</span><strong>{walletStatus?.accounts.length ?? accounts.length}</strong></div>
                <div className="kv"><span>Anon set</span><strong>{anonIndexes.length || session?.anonIndexes?.length || "-"}</strong></div>
                <div className="kv"><span>Transfer Built</span><strong>{session?.transferBuilt ? "yes" : "no"}</strong></div>
                <div className="kv"><span>Submitted</span><strong>{session?.transferSubmitted ? "yes" : "no"}</strong></div>
              </section>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
