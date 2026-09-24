import { Layout } from "../components/Layout";
import { ChevronDown, Shuffle, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { InlineAlert } from "../components/InlineAlert";
import { TransferFlowHeader } from "../components/TransferFlowHeader";
import { api, type PublicAPGCAccount, type WalletStatus } from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive } from "@shared/productIdentity";
import {
  getReceivers,
  type Receiver,
  ROLE_COLORS,
  saveAnonIndexes,
  saveSetSize,
  SUPPORTED_SET_SIZES,
  TOKEN_SYMBOL,
} from "../demoState";
import { useEffect, useState } from "react";

const powerSetSizes: number[] = [...SUPPORTED_SET_SIZES];

function shuffleIndexes(values: number[]) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function minimumPowerOfTwo(value: number) {
  let power = 2;
  while (power < value) power *= 2;
  return power;
}

function buildAnonIndexes(
  accounts: PublicAPGCAccount[],
  senderIndex: number,
  receivers: Receiver[],
  size: number,
  rerandomize = true,
) {
  const required = [senderIndex, ...receivers.map((receiver) => receiver.participantIndex)];
  const requiredSet = new Set(required);
  const decoys = shuffleIndexes(
    accounts
      .map((account) => account.participantIndex)
      .filter((index) => !requiredSet.has(index)),
  ).slice(0, Math.max(0, size - required.length));
  const selected = [...required, ...decoys];
  return rerandomize ? shuffleIndexes(selected) : selected;
}

function Ring(props: { anonIndexes: number[]; senderIndex: number; receivers: Receiver[] }) {
  const receiverSet = new Set(props.receivers.map((receiver) => receiver.participantIndex));
  const count = Math.max(2, props.anonIndexes.length);
  const nodeRadius = count <= 8 ? 12 : count <= 16 ? 9 : count <= 32 ? 6.5 : 5;
  const showLabels = count <= 16;

  return (
    <section className="wallet-flow-card wallet-ring-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Anonymity Ring</div>
          <div className="text-xs text-muted-foreground">Wallet keys are shuffled into local proof positions</div>
        </div>
        <Badge className="border-primary/20 bg-primary/10 text-primary">{count} members</Badge>
      </div>
      <svg viewBox="0 0 300 300" className="wallet-ring-visual mx-auto aspect-square w-full max-w-[230px]" role="img" aria-label="Selected APGC anonymity ring">
        <defs>
          <linearGradient id="walletRingCore" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1CF2D2" />
            <stop offset="100%" stopColor="#276DF2" />
          </linearGradient>
          <linearGradient id="walletRingSignal" x1="28" x2="272" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14F1D9" stopOpacity="0" />
            <stop offset="48%" stopColor="#14F1D9" />
            <stop offset="76%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
          <filter id="walletRingGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="150" cy="150" r="105" className="wallet-ring-track" />
        <circle cx="150" cy="150" r="58" className="wallet-ring-inner-track" />
        <circle cx="150" cy="150" r="105" className="wallet-ring-signal" stroke="url(#walletRingSignal)" />
        <circle cx="150" cy="150" r="58" className="wallet-ring-signal inner" stroke="url(#walletRingSignal)" />
        {props.anonIndexes.map((globalIndex, localIndex) => {
          const angle = -90 + (360 / count) * localIndex;
          const x = 150 + 105 * Math.cos((angle * Math.PI) / 180);
          const y = 150 + 105 * Math.sin((angle * Math.PI) / 180);
          const role = globalIndex === props.senderIndex ? "sender" : receiverSet.has(globalIndex) ? "receiver" : "decoy";
          return (
            <g key={`${globalIndex}-${localIndex}`} className={`wallet-ring-member ${role}`} style={{ animationDelay: `${localIndex * 0.035}s` }}>
              <circle cx={x} cy={y} r={nodeRadius + 5} className="wallet-ring-member-aura" />
              <circle
                cx={x}
                cy={y}
                r={nodeRadius}
                fill={ROLE_COLORS[role]}
                className="wallet-ring-member-dot"
              />
              {showLabels && (
                <text x={x} y={y + 3.5} textAnchor="middle" className="fill-white text-[8px] font-semibold">
                  {role === "sender" ? "S" : role === "receiver" ? "R" : "D"}
                </text>
              )}
            </g>
          );
        })}
        <circle cx="150" cy="150" r="49" className="wallet-ring-core-shell" />
        <circle cx="150" cy="150" r="38" fill="url(#walletRingCore)" className="wallet-ring-core-fill" filter="url(#walletRingGlow)" />
        <text x="150" y="146" textAnchor="middle" className="wallet-ring-core-title">APGC</text>
        <text x="150" y="165" textAnchor="middle" className="wallet-ring-core-subtitle">{count} MEMBERS</text>
      </svg>
      <div className="wallet-ring-legend">
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />Sender</div>
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />Receivers</div>
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#a78bfa]" />Decoys</div>
      </div>
    </section>
  );
}

export function ChooseSetSizeScreen() {
  const navigate = useNavigate();
  const [identity] = useState(() => getProductIdentity());
  const [receivers] = useState(() => getReceivers());
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [selectedSize, setSelectedSize] = useState(() => minimumPowerOfTwo(receivers.length + 1));
  const [anonIndexes, setAnonIndexes] = useState<number[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!identity) {
      navigate("/", { replace: true });
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const walletStatus = await api.walletStatus();
        if (cancelled) return;
        if (!productIdentityIsActive(identity, walletStatus)) {
          clearProductIdentity();
          navigate("/", { replace: true });
          return;
        }
        const minSize = minimumPowerOfTwo(receivers.length + 1);
        const maxSize = Math.max(minSize, walletStatus.accounts.length);
        const initialSize = powerSetSizes.find((size) => size >= minSize && size <= maxSize) ?? minSize;
        const targetSize = selectedSize >= minSize && selectedSize <= maxSize ? selectedSize : initialSize;
        setStatus(walletStatus);
        setSelectedSize(targetSize);
        setAnonIndexes(buildAnonIndexes(walletStatus.accounts, identity.user.participantIndex, receivers, targetSize));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "wallet accounts unavailable");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [identity?.token, navigate, receivers]);

  const accounts = status?.accounts ?? [];
  const minSize = minimumPowerOfTwo(receivers.length + 1);
  const allowedSizes = powerSetSizes.filter((size) => size >= minSize && size <= accounts.length);
  const decoyCount = Math.max(0, selectedSize - receivers.length - 1);
  const privacyLabel = selectedSize >= 32 ? "Very High" : selectedSize >= 16 ? "High" : selectedSize >= 8 ? "Medium" : "Minimum";
  const fee = (0.05 + selectedSize * 0.006 + receivers.length * 0.01).toFixed(2);
  const accountFingerprint = (participantIndex: number) => (
    accounts.find((account) => account.participantIndex === participantIndex)?.publicKeyFingerprint ?? "unknown key"
  );

  if (!identity) return null;

  const chooseSize = (size: number) => {
    setSelectedSize(size);
    saveSetSize(size);
    const next = buildAnonIndexes(accounts, identity.user.participantIndex, receivers, size);
    setAnonIndexes(next);
    saveAnonIndexes(next);
  };

  const rerandomize = () => {
    const next = buildAnonIndexes(accounts, identity.user.participantIndex, receivers, selectedSize);
    setAnonIndexes(next);
    saveAnonIndexes(next);
  };

  const continueFlow = () => {
    if (!allowedSizes.includes(selectedSize)) {
      setError(`Anonymity set size must be one of ${allowedSizes.join(", ")}.`);
      return;
    }
    if (anonIndexes.length !== selectedSize) {
      setError("Anonymity set is incomplete. Randomize the set again.");
      return;
    }
    saveSetSize(selectedSize);
    saveAnonIndexes(anonIndexes);
    setError("");
    navigate("/generate-proof");
  };

  return (
    <Layout activeTab="transfer">
      <div className="wallet-flow-page space-y-4 p-6">
        <TransferFlowHeader
          step={2}
          title="Set privacy level"
          description="Choose a power-of-two anonymity set. Larger sets add more decoys around the same transfer."
        />

        <section className="wallet-flow-card p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Set Size</div>
              <div className="text-3xl font-semibold text-foreground">{selectedSize}</div>
            </div>
            <Badge className="border-primary/20 bg-primary/10 text-primary">power of two</Badge>
          </div>

          <div className="wallet-choice-grid mt-4">
            {allowedSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => chooseSize(size)}
                className={`min-h-11 rounded-xl border text-sm font-semibold transition-colors ${
                  selectedSize === size ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="wallet-privacy-metrics">
            <div>
              <div className="text-xs text-muted-foreground">Privacy</div>
              <div className="font-semibold text-foreground">{privacyLabel}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Decoys</div>
              <div className="font-semibold text-foreground">{decoyCount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Estimate</div>
              <div className="font-semibold text-foreground">{fee} {TOKEN_SYMBOL}</div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {receivers.length} recipient{receivers.length > 1 ? "s" : ""} require at least {minSize} members. Sender and recipients stay fixed while decoy positions are shuffled.
          </p>
        </section>

        <Ring anonIndexes={anonIndexes} senderIndex={identity.user.participantIndex} receivers={receivers} />

        <section className="wallet-flow-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Member positions</div>
              <div className="text-xs text-muted-foreground">{anonIndexes.length} shuffled public keys</div>
            </div>
            <Button onClick={rerandomize} variant="outline" className="h-10 rounded-xl border-border px-3">
              <Shuffle className="h-4 w-4" />
              Shuffle
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setShowMembers((current) => !current)}
            aria-expanded={showMembers}
            aria-controls="ring-member-list"
            className="wallet-detail-toggle"
          >
            <span>{showMembers ? "Hide technical positions" : "View technical positions"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showMembers ? "rotate-180" : ""}`} />
          </button>
          {showMembers && (
            <div id="ring-member-list" className="mt-3 grid grid-cols-2 gap-2">
              {anonIndexes.map((globalIndex, localIndex) => {
                const role = globalIndex === identity.user.participantIndex
                  ? "sender"
                  : receivers.some((receiver) => receiver.participantIndex === globalIndex)
                    ? "receiver"
                    : "decoy";
                return (
                  <div key={`${globalIndex}-${localIndex}`} className="min-w-0 rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <div className="text-[10px] uppercase text-muted-foreground">slot {localIndex} · {role}</div>
                    <div className="truncate font-mono text-xs font-semibold text-foreground" title={accountFingerprint(globalIndex)}>{accountFingerprint(globalIndex)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {error && <InlineAlert tone="error" title="Anonymity set invalid" message={error} />}

        <Button onClick={continueFlow} className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
          <UsersRound className="h-4 w-4" />
          Generate private proof
        </Button>
      </div>
    </Layout>
  );
}
