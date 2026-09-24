import {
  api,
  shortAddress,
  shortCiphertext,
  shortHash,
  type ApiConfig,
  type ApiJob,
  type DemoAccount,
  type DemoSession,
  type DemoTransaction,
  type MonitorEvent,
  type MonitorSummary,
  type WalletStatus,
} from "@shared/api";
import {
  Activity,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Database,
  KeyRound,
  Loader2,
  Moon,
  Play,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Sun,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type GenesisStage = "idle" | "session" | "deploy" | "accounts" | "deposit" | "complete" | "failed";
type ThemeMode = "dark" | "light";

const MONITOR_THEME_KEY = "apgc.monitor.theme";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(MONITOR_THEME_KEY) === "light" ? "light" : "dark";
}

function applyMonitorTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.apgcTheme = theme;
}

type GenesisForm = {
  participants: number;
  initialBalance: string;
};

function statusClass(connected?: boolean) {
  return connected ? "badge ok" : "badge danger";
}

function positiveAccounts(accounts: DemoAccount[]) {
  return accounts.filter((account) => account.ciphertext.length > 0).length;
}

function ciphertextAccounts(accounts: DemoAccount[]) {
  return accounts.filter((account) => account.ciphertext.length > 0).length;
}

function transactionTitle(tx: DemoTransaction) {
  if (tx.type === "deposit" || tx.type === "walletRegisterDeposit") return "Encrypted APGC deposit";
  if (tx.type === "fund") return "External ETH funding";
  return "Anonymous transfer";
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

function GenesisStep(props: { title: string; detail: string; active: boolean; complete: boolean }) {
  return (
    <div className={`genesis-step ${props.active ? "active" : ""} ${props.complete ? "complete" : ""}`}>
      <div className="step-icon">
        {props.complete ? <CheckCircle2 size={17} /> : props.active ? <Loader2 size={17} className="spin" /> : <span />}
      </div>
      <div>
        <div className="step-title">{props.title}</div>
        <div className="step-detail">{props.detail}</div>
      </div>
    </div>
  );
}

const topologyLinks = [
  "M77 212 C146 162 204 149 286 180 S435 238 567 152",
  "M92 116 C198 87 250 114 318 164 S439 234 557 237",
  "M130 273 C198 234 262 227 339 186 S471 109 574 87",
  "M204 81 C264 130 323 145 381 180 S479 237 588 287",
  "M63 174 C171 192 229 246 326 202 S468 82 586 139",
  "M169 320 C228 245 291 233 363 191 S459 161 542 79",
];

function MonitorTopology() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    <div className="monitor-topology monitor-flow-reference" aria-hidden="true">
      <svg ref={svgRef} viewBox="0 0 680 360" role="presentation">
        <defs>
          <linearGradient id="monitorTopologyLine" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1CF2D2" />
            <stop offset="58%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#F2B84B" />
          </linearGradient>
          <linearGradient id="monitorTopologyCore" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1CF2D2" />
            <stop offset="100%" stopColor="#276DF2" />
          </linearGradient>
          {topologyLinks.map((_, index) => {
            const reverse = index === 2 || index === 5;
            return (
              <linearGradient
                key={index}
                id={`monitorBeam${index}`}
                gradientUnits="userSpaceOnUse"
                x1={reverse ? 190 : 0}
                x2={reverse ? 0 : 190}
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
                  from={reverse ? "720 0" : "-220 0"}
                  to={reverse ? "-220 0" : "720 0"}
                  dur={`${6.6 + index * 0.55}s`}
                  begin={`${-index * 1.15 - 0.8}s`}
                  repeatCount="indefinite"
                />
              </linearGradient>
            );
          })}
        </defs>
        <g className="monitor-orbits">
          <ellipse cx="352" cy="182" rx="186" ry="85" />
          <ellipse cx="352" cy="182" rx="255" ry="121" />
        </g>
        <g>
          {topologyLinks.map((link, index) => (
            <path key={link} className={`monitor-link monitor-link-${index}`} d={link} />
          ))}
        </g>
        <g className="monitor-beams">
          {topologyLinks.map((link, index) => (
            <g key={`beam-${link}`} stroke={`url(#monitorBeam${index})`}>
              <path className="monitor-beam-bloom" d={link} />
              <path className="monitor-beam-line" d={link} />
            </g>
          ))}
        </g>
        <g>
          {topologyLinks.slice(0, 4).map((link, index) => (
            <path key={`packet-${link}`} className={`monitor-packet monitor-packet-${index}`} d={link} />
          ))}
        </g>
        <g className="monitor-core" transform="translate(352 182)">
          <circle className="monitor-core-shell" r="72" />
          <circle className="monitor-core-fill" r="50" />
          <text className="monitor-core-title" textAnchor="middle" y="-6">APGC</text>
          <text className="monitor-core-subtitle" textAnchor="middle" y="25">PRIVATE</text>
        </g>
      </svg>
    </div>
  );
}

function JobPanel({ job }: { job: ApiJob | null }) {
  if (!job) {
    return <div className="job-empty">No active job. Start genesis initialization to stream backend progress.</div>;
  }

  return (
    <section className="job-panel">
      <div className="job-top">
        <div>
          <div className="job-type">{job.type}</div>
          <div className="job-step">{job.step || job.status}</div>
        </div>
        <span className={`badge ${job.status === "failed" ? "danger" : job.status === "succeeded" ? "ok" : "neutral"}`}>
          {job.progress}%
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${job.progress}%` }} />
      </div>
      <div className="log-box">
        {(job.logs ?? []).slice(-8).map((line, index) => (
          <div key={`${line}-${index}`} className="mono">{line}</div>
        ))}
        {job.error && <div className="log-error">{job.error}</div>}
      </div>
    </section>
  );
}

function AccountTable({ accounts }: { accounts: DemoAccount[] }) {
  if (!accounts.length) return <div className="empty">No APGC accounts initialized.</div>;

  return (
    <div className="account-grid">
      {accounts.map((account) => (
        <article key={account.index} className="account-card">
          <div className="account-primary">
            <span className="mono account-index">{account.publicKeyFingerprint ?? shortHash(account.publicKey.join(":"))}</span>
            <span className="role role-decoy">{account.depositTx ? "on chain" : "pending"}</span>
          </div>
          <div className="account-field">
            <span>pk</span>
            <strong className="mono">{shortAddress(account.publicKey[0])}</strong>
          </div>
          <div className="account-field">
            <span>ciphertext</span>
            <strong className="mono">{shortCiphertext(account.ciphertext)}</strong>
          </div>
          <div className="account-field compact">
            <span>nonce</span>
            <strong>{account.nonce || "0"}</strong>
          </div>
          <div className="account-field">
            <span>Last tx</span>
            <strong className="mono">{shortHash(account.lastTx)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}

function TransactionList({ transactions }: { transactions: DemoTransaction[] }) {
  if (!transactions.length) return <div className="empty">No chain transactions recorded yet.</div>;

  return (
    <div className="tx-list">
      {transactions.slice(0, 12).map((tx) => (
        <article key={tx.id} className="tx-item tx-row">
          <div className="tx-icon"><Activity size={18} /></div>
          <div className="tx-title">{transactionTitle(tx)}</div>
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

async function waitForJob(jobId: string, onJob: (job: ApiJob) => void) {
  for (;;) {
    const job = await api.job(jobId);
    onJob(job);
    if (job.status === "succeeded") return job;
    if (job.status === "failed") throw new Error(job.error || `${job.type} failed`);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
  }
}

function allowedGenesisParticipants(value: number | undefined, allowed: number[], fallback: number) {
  return value && allowed.includes(value) ? value : fallback;
}

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [form, setForm] = useState<GenesisForm>({
    participants: 8,
    initialBalance: "8",
  });
  const [stage, setStage] = useState<GenesisStage>("idle");
  const [job, setJob] = useState<ApiJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    applyMonitorTheme(theme);
    window.localStorage.setItem(MONITOR_THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => current === "dark" ? "light" : "dark");
  };

  const load = async () => {
    const [nextSummary, nextStatus, nextConfig, nextSession] = await Promise.all([
      api.monitorSummary(),
      api.walletStatus(),
      api.config(),
      api.session().catch(() => null),
    ]);
    setSummary(nextSummary);
    setWalletStatus(nextStatus);
    setConfig(nextConfig);
    setSession(nextSession);
    setForm((current) => ({
      participants: allowedGenesisParticipants(
        nextSession?.participants,
        nextConfig.participantsAllowed,
        allowedGenesisParticipants(current.participants, nextConfig.participantsAllowed, nextConfig.defaultParticipants),
      ),
      initialBalance: nextSession?.initialBalance || current.initialBalance,
    }));
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        await load();
        if (!cancelled) setError("");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "APGC API unavailable");
      }
    };
    tick();
    const timer = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const stats = useMemo(() => {
    const accounts = summary?.accounts ?? [];
    const transactions = summary?.transactions ?? [];
    return {
      accountCount: accounts.length,
      positiveCount: positiveAccounts(accounts),
      ciphertextCount: ciphertextAccounts(accounts),
      transferCount: transactions.filter((tx) => tx.type === "transferAPGCETH").length,
    };
  }, [summary]);

  const genesisComplete = Boolean(walletStatus?.ready);
  const hasContracts = Boolean(session?.contracts?.APGCSystem || session?.contractAddress);
  const hasAccounts = Boolean(summary?.accounts.length);
  const hasDeposits = Boolean(summary?.accounts.length && summary.accounts.every((account) => account.depositTx));

  const startGenesis = async () => {
    setBusy(true);
    setError("");
    setJob(null);
    const defaultReceiverCount = config?.defaultReceiverCount || 2;
    const defaultTransferAmount = "2";
    try {
      setStage("session");
      await api.createSession({
        participants: form.participants,
        receiverCount: defaultReceiverCount,
        initialBalance: form.initialBalance,
        transferAmount: defaultTransferAmount,
      });
      await load();

      setStage("deploy");
      const deploy = await api.deploy();
      await waitForJob(deploy.jobId, setJob);
      await load();

      setStage("accounts");
      const init = await api.initAccounts({
        participants: form.participants,
        receiverCount: defaultReceiverCount,
        initialBalance: form.initialBalance,
        transferAmount: defaultTransferAmount,
      });
      await waitForJob(init.jobId, setJob);
      await load();

      setStage("deposit");
      const deposit = await api.deposit([]);
      await waitForJob(deposit.jobId, setJob);
      await load();

      setStage("complete");
    } catch (err) {
      setStage("failed");
      setError(err instanceof Error ? err.message : "Genesis initialization failed");
    } finally {
      setBusy(false);
    }
  };

  const resetGenesis = async () => {
    setBusy(true);
    setError("");
    try {
      await api.resetSession();
      setStage("idle");
      setJob(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const participantOptions = config?.participantsAllowed ?? [8, 16, 32, 64];
  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">AnonymousPGC Local Demo</div>
          <h1>Genesis Monitor</h1>
        </div>
        <div className="status-group">
          <span className={statusClass(summary?.chain.connected)}>
            <RadioTower size={15} />
            {summary?.chain.connected ? "Ganache connected" : "Ganache offline"}
          </span>
          <span className={genesisComplete ? "badge ok" : "badge warn"}>
            <ShieldCheck size={15} />
            {genesisComplete ? "Wallets open" : "Wallets locked"}
          </span>
          <span className="badge neutral">API {api.baseUrl}</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {error && <section className="alert">{error}</section>}

      <section className="hero-grid">
        <section className="genesis-card">
          <div className="genesis-main">
            <div className="panel-title large">
              <Database size={20} />
              AnonymousPGC Genesis
            </div>
            <p className="panel-copy">
              Initialize the local chain before opening wallet clients. This creates the demo session, deploys contracts, generates APGC internal accounts, and deposits encrypted balances into APGCSystem.
            </p>

            <div className="form-grid">
              <label>
                <span>Genesis accounts</span>
                <select
                  value={form.participants}
                  disabled={busy}
                  onChange={(event) => setForm((current) => ({ ...current, participants: Number(event.target.value) }))}
                >
                  {participantOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span>Initial APGC</span>
                <input
                  value={form.initialBalance}
                  disabled={busy}
                  onChange={(event) => setForm((current) => ({ ...current, initialBalance: event.target.value }))}
                />
              </label>
            </div>

            <div className="steps">
              <GenesisStep title="Create session" detail="Prepare parameters and lock wallet access" active={stage === "session"} complete={Boolean(session)} />
              <GenesisStep title="Deploy contracts" detail="Deploy verifier, setup, and APGCSystem" active={stage === "deploy"} complete={hasContracts} />
              <GenesisStep title="Generate accounts" detail="Create APGC keypairs and ciphertext states" active={stage === "accounts"} complete={hasAccounts} />
              <GenesisStep title="Deposit balances" detail="Fund ETH accounts and commit encrypted balances" active={stage === "deposit"} complete={hasDeposits} />
            </div>

            <div className="action-row">
              <button className="primary-action" disabled={busy} onClick={startGenesis}>
                {busy ? <Loader2 size={17} className="spin" /> : <Play size={17} />}
                {genesisComplete ? "Reinitialize Genesis" : "Initialize Genesis"}
              </button>
              <button className="secondary-action" disabled={busy} onClick={resetGenesis}>
                <RefreshCw size={17} />
                Reset Session
              </button>
            </div>
          </div>

          <div className="genesis-orbit-panel">
            <MonitorTopology />
            <div className="orbit-caption">
              <span>Public contract state</span>
              <strong>{genesisComplete ? "wallet gate open" : "awaiting genesis"}</strong>
            </div>
          </div>
        </section>

        <section className="panel live-panel">
          <div className="panel-title">
            <Activity size={18} />
            Live Backend Job
          </div>
          <JobPanel job={job} />
          <div className="wallet-gate">
            <div>
              <div className="gate-label">Wallet gate</div>
              <div className="gate-value">{walletStatus?.reason ?? "Checking wallet readiness"}</div>
            </div>
            <span className={genesisComplete ? "badge ok" : "badge warn"}>{genesisComplete ? "Ready" : "Locked"}</span>
          </div>
        </section>
      </section>

      <section className="chain-strip">
        <div>
          <div className="strip-label">RPC</div>
          <div className="strip-value">{summary?.chain.rpcUrl ?? "http://127.0.0.1:8545"}</div>
        </div>
        <div>
          <div className="strip-label">APGCSystem</div>
          <div className="strip-value mono">{shortAddress(session?.contractAddress ?? session?.contracts?.APGCSystem)}</div>
        </div>
        <div>
          <div className="strip-label">Block</div>
          <div className="strip-value">{summary?.chain.latestBlock ?? "-"}</div>
        </div>
        <div>
          <div className="strip-label">Address Source</div>
          <div className="strip-value">{hasContracts ? "session" : "-"}</div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon={<WalletCards size={22} />} label="APGC Accounts" value={String(stats.accountCount)} detail={`${stats.positiveCount} encrypted states synced`} />
        <StatCard icon={<CircleDollarSign size={22} />} label="Ciphertext States" value={String(stats.ciphertextCount)} detail="public encrypted balance commitments" />
        <StatCard icon={<ShieldCheck size={22} />} label="Anonymous Transfers" value={String(stats.transferCount)} detail="verified transferAPGCETH calls" />
        <StatCard icon={<Boxes size={22} />} label="Events" value={String(summary?.events.length ?? 0)} detail="deposit and transfer timeline" />
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <Database size={18} />
          APGC Internal Accounts
        </div>
        <AccountTable accounts={summary?.accounts ?? []} />
      </section>

      <section className="content-grid">
        <section className="panel">
          <div className="panel-title">
            <Activity size={18} />
            Transactions
          </div>
          <TransactionList transactions={summary?.transactions ?? []} />
        </section>

        <section className="panel">
          <div className="panel-title">
            <KeyRound size={18} />
            Contract Events
          </div>
          <EventTimeline events={summary?.events ?? []} />
        </section>
      </section>
    </main>
  );
}
