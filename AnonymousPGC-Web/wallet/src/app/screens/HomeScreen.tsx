import { Layout } from "../components/Layout";
import { Copy, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { InlineAlert } from "../components/InlineAlert";
import { TOKEN_SYMBOL } from "../demoState";
import { api, firstCiphertextCommitment, shortHash, type ChainStatus, type DemoAccount, type DemoSession, type WalletBalanceResponse, type WalletStatus } from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive } from "@shared/productIdentity";
import { useEffect, useMemo, useState } from "react";

export function HomeScreen() {
  const navigate = useNavigate();
  const [identity] = useState(() => getProductIdentity());
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [privateBalance, setPrivateBalance] = useState<WalletBalanceResponse | null>(null);
  const [apiError, setApiError] = useState("");
  const [showDecryptedBalance, setShowDecryptedBalance] = useState(false);

  useEffect(() => {
    if (!identity) {
      navigate("/", { replace: true });
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const [chainStatus, demoSession, status] = await Promise.all([
          api.chainStatus(),
          api.session().catch(() => null),
          api.walletStatus(),
        ]);
        if (!cancelled) {
          if (!productIdentityIsActive(identity, status)) {
            clearProductIdentity();
            navigate("/", { replace: true });
            return;
          }
          setChain(chainStatus);
          setSession(demoSession);
          setWalletStatus(status);
          setApiError("");
        }
        api.walletBalance(identity.token)
          .then((balance) => {
            if (!cancelled) setPrivateBalance(balance);
          })
          .catch(() => {
            if (!cancelled) setPrivateBalance(null);
          });
      } catch (error) {
        if (!cancelled) setApiError(error instanceof Error ? error.message : "API unavailable");
      }
    };
    load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [identity?.token, navigate]);

  const account: DemoAccount | undefined = useMemo(() => {
    if (!identity || !session) return undefined;
    return session.accounts.find((item) => item.index === identity.user.participantIndex);
  }, [identity, session]);

  const publicAccount = useMemo(() => {
    if (!identity || !walletStatus) return undefined;
    return walletStatus.accounts.find((item) => item.participantIndex === identity.user.participantIndex);
  }, [identity, walletStatus]);

  if (!identity) return null;

  const connected = Boolean(chain?.connected);
  const ciphertextPreview = firstCiphertextCommitment(privateBalance?.ciphertext, publicAccount?.ciphertext, account?.ciphertext);
  const publicKey = identity.user.publicKey.join(", ");
  const displayedNonce = privateBalance?.nonce ?? publicAccount?.nonce ?? account?.nonce ?? "-";

  return (
    <Layout activeTab="home">
      <div className="space-y-5 p-6">
        <header className="space-y-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Anonymous PGC</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">My Wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Private identity and encrypted APGC state for the signed-in account.</p>
          </div>
        </header>

        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-foreground">{identity.user.username}</div>
                <div className="text-xs text-muted-foreground">APGC wallet identity</div>
              </div>
            </div>
            <Badge className={connected ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>
              {connected ? "Synced" : "Offline"}
            </Badge>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-muted/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Public key fingerprint</div>
                <div className="mt-1 truncate font-mono text-sm text-foreground">{identity.user.publicKeyFingerprint}</div>
              </div>
              <button
                type="button"
                aria-label="Copy public key"
                onClick={() => navigator.clipboard?.writeText(publicKey)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </section>

        <section className="wallet-private-balance-card rounded-3xl bg-gradient-to-br from-[#1e3a5f] via-primary to-emerald-500 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/85">Private Balance</span>
            <Badge className="border-white/25 bg-white/15 text-white">
              {showDecryptedBalance ? privateBalance?.verified ? "Verified" : "Local key" : "Encrypted"}
            </Badge>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-3xl font-semibold">
                {showDecryptedBalance && privateBalance ? `${privateBalance.balance} ${TOKEN_SYMBOL}` : ciphertextPreview ? "Ciphertext" : "Pending"}
              </div>
              <div className="text-sm text-white/75">nonce {displayedNonce}</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/20 bg-black/15 px-3 py-2 font-mono text-xs text-white/80">
            {ciphertextPreview ? shortHash(ciphertextPreview) : "Waiting for APGC state sync"}
          </div>
          {showDecryptedBalance && privateBalance && (
            <div className="mt-3 rounded-2xl border border-white/20 bg-white/15 px-3 py-2 text-sm">
              Balance opened locally with the signed-in wallet key.
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowDecryptedBalance((value) => !value)}
            disabled={!privateBalance}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/12 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/18"
          >
            {showDecryptedBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showDecryptedBalance ? "Hide balance" : "Decrypt balance"}
          </button>
        </section>

        {apiError && <InlineAlert tone="error" title="Backend unavailable" message={apiError} />}

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Latest Block</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{chain?.latestBlock?.toLocaleString("en-US") ?? "-"}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">APGC Accounts</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{walletStatus?.accounts.length ?? session?.accounts.length ?? 0}</div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
