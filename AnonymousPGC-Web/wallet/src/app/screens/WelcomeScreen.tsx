import { Activity, KeyRound, Loader2, LockKeyhole, Moon, RefreshCw, ShieldCheck, Sun, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type WalletStatus } from "@shared/api";
import { clearProductIdentity, getProductIdentity, saveProductIdentity } from "@shared/productIdentity";
import { InlineAlert } from "../components/InlineAlert";
import { StatusBar } from "../components/StatusBar";
import { Button } from "../components/ui/button";
import { getThemeMode, saveSenderIndex, saveThemeMode, type ThemeMode } from "../demoState";

type EntryMode = "login" | "register";

const DEFAULT_DEMO_BALANCE = "8";

const mobileLinks = [
  "M27 149 C72 117 110 108 163 129 S260 167 346 111",
  "M37 87 C105 68 140 85 184 118 S263 164 339 166",
  "M62 190 C105 164 148 160 197 133 S283 82 350 68",
  "M110 64 C148 96 187 106 225 129 S289 166 360 198",
  "M18 125 C88 136 126 172 189 143 S282 64 358 102",
  "M86 220 C125 171 166 163 213 136 S276 116 330 62",
];

function MobileTopology() {
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
    <div className="wallet-mobile-topology wallet-mobile-flow-reference" aria-hidden="true">
      <svg ref={svgRef} viewBox="0 0 400 260" role="presentation">
        <defs>
          <linearGradient id="walletMobileLine" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1CF2D2" />
            <stop offset="64%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#F2B84B" />
          </linearGradient>
          <linearGradient id="walletMobileCore" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1CF2D2" />
            <stop offset="100%" stopColor="#276DF2" />
          </linearGradient>
          {mobileLinks.map((_, index) => {
            const reverse = index === 2 || index === 5;
            return (
              <linearGradient
                key={index}
                id={`walletMobileBeam${index}`}
                gradientUnits="userSpaceOnUse"
                x1={reverse ? 120 : 0}
                x2={reverse ? 0 : 120}
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
                  from={reverse ? "430 0" : "-140 0"}
                  to={reverse ? "-140 0" : "430 0"}
                  dur={`${6.2 + index * 0.5}s`}
                  begin={`${-index * 1.05 - 0.7}s`}
                  repeatCount="indefinite"
                />
              </linearGradient>
            );
          })}
        </defs>
        <ellipse cx="206" cy="130" rx="121" ry="55" className="wallet-mobile-orbit" />
        <ellipse cx="206" cy="130" rx="166" ry="79" className="wallet-mobile-orbit" />
        {mobileLinks.map((link, index) => (
          <path key={link} d={link} className={`wallet-mobile-link wallet-mobile-link-${index}`} />
        ))}
        <g className="wallet-mobile-beams">
          {mobileLinks.map((link, index) => (
            <g key={`beam-${link}`} stroke={`url(#walletMobileBeam${index})`}>
              <path d={link} className="wallet-mobile-beam-bloom" />
              <path d={link} className="wallet-mobile-beam-line" />
            </g>
          ))}
        </g>
        {mobileLinks.slice(0, 4).map((link, index) => (
          <path key={`packet-${link}`} d={link} className={`wallet-mobile-packet wallet-mobile-packet-${index}`} />
        ))}
        <g transform="translate(206 130)">
          <circle className="wallet-mobile-core-shell" r="48" />
          <circle className="wallet-mobile-core-fill" r="34" />
          <text className="wallet-mobile-core-title" textAnchor="middle" y="7">APGC</text>
        </g>
      </svg>
    </div>
  );
}

export function WelcomeScreen() {
  const navigate = useNavigate();
  const existingIdentity = useMemo(() => getProductIdentity(), []);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [mode, setMode] = useState<EntryMode>("login");
  const [username, setUsername] = useState(existingIdentity?.user.username ?? "");
  const [password, setPassword] = useState("");
  const [initialBalance, setInitialBalance] = useState(DEFAULT_DEMO_BALANCE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => getThemeMode());

  const loadStatus = async () => {
    setLoading(true);
    try {
      const nextStatus = await api.walletStatus();
      setStatus(nextStatus);
      setError("");
      if (!nextStatus.ready) {
        clearProductIdentity();
      }
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "APGC API is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const timer = window.setInterval(() => {
      api.walletStatus().then(setStatus).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (mode === "register") {
        await api.walletRegister({
          username: trimmedUsername,
          password,
          initialBalance: initialBalance.trim() || DEFAULT_DEMO_BALANCE,
        });
        clearProductIdentity();
        setPassword("");
        setMode("login");
        setNotice("Account registered on AnonymousPGC. Log in with the same credentials to enter the wallet.");
        await loadStatus();
        return;
      }

      const auth = await api.walletLogin({ username: trimmedUsername, password });
      saveProductIdentity({ token: auth.token, user: auth.user });
      saveSenderIndex(auth.user.participantIndex);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    saveThemeMode(nextTheme);
  };

  const ready = Boolean(status?.ready);

  return (
    <div className="wallet-entry-bg flex min-h-dvh items-center justify-center overflow-hidden p-4 text-slate-950">
      <div className="wallet-device-shell h-[min(844px,calc(100dvh-2rem))] min-h-[620px] w-full max-w-[390px] overflow-hidden rounded-[34px] border border-white/70 bg-[#eef6f3]">
        <div className="flex h-full flex-col">
          <StatusBar />

          <main className={`wallet-entry-screen ${ready ? "wallet-entry-ready" : "wallet-entry-locked"} relative flex-1 overflow-y-auto`}>
            <div className="flex min-h-full flex-col px-6 pb-5 pt-6">
              <section className="wallet-entry-hero min-h-[292px]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/78 px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
                      <ShieldCheck className="h-4 w-4 text-teal-700" strokeWidth={1.8} />
                      Ethereum privacy layer
                    </div>
                    <div>
                      <h1 className="max-w-[250px] text-[31px] font-semibold leading-[1.04] tracking-normal text-slate-950">
                        AnonymousPGC
                      </h1>
                      <p className="mt-3 max-w-[240px] rounded-2xl bg-white/58 p-3 text-sm leading-5 text-slate-700 shadow-sm backdrop-blur">
                        No one can read your balance or uncover your identity.
                      </p>
                    </div>
                  </div>
                  <div className="wallet-entry-actions shrink-0">
                    <button
                      type="button"
                      className="wallet-theme-toggle"
                      onClick={toggleTheme}
                      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                    >
                      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </button>
                    <span className={`wallet-entry-state rounded-full px-2.5 py-1 text-[10px] font-bold uppercase shadow-sm ${ready ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"}`}>
                      {ready ? "Live" : "Locked"}
                    </span>
                  </div>
                </div>

                <MobileTopology />

              </section>

              {!ready && (
                <section className="wallet-auth-panel rounded-[24px] border border-white/80 bg-[#f8fcfb]/92 p-4 text-slate-950 shadow-[0_18px_50px_rgba(5,18,28,0.18)] backdrop-blur">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="text-base font-semibold text-slate-950">Genesis required before access</h2>
                      <p className="text-sm leading-5 text-slate-700">
                        The chain monitor must initialize genesis, deploy contracts, and complete APGC deposits before wallets can register or log in.
                      </p>
                      <div className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-700">
                        {status?.reason ?? (loading ? "Checking chain readiness..." : "APGC API is unavailable.")}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={loadStatus}
                    disabled={loading}
                    className="mt-4 h-11 w-full rounded-2xl bg-slate-950 text-white shadow-[0_12px_26px_rgba(8,127,120,0.20)] hover:bg-slate-800"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh Status
                  </Button>
                </section>
              )}

              {ready && (
                <section className="wallet-auth-panel space-y-4 rounded-[26px] border border-white/80 bg-[#f8fcfb]/92 p-5 text-slate-950 shadow-[0_18px_50px_rgba(5,18,28,0.18)] backdrop-blur">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/70 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setError("");
                      }}
                      className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${mode === "login" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                    >
                      <span className="inline-flex items-center justify-center gap-2"><KeyRound className="h-4 w-4" /> Login</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setError("");
                      }}
                      className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${mode === "register" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                    >
                      <span className="inline-flex items-center justify-center gap-2"><UserPlus className="h-4 w-4" /> Register</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="grid gap-2 text-sm font-medium text-slate-800">
                      Username
                      <input
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        className="min-h-12 rounded-2xl border border-teal-900/10 bg-white/82 px-4 text-base text-slate-950 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-slate-800">
                      Password
                      <input
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        type="password"
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        className="min-h-12 rounded-2xl border border-teal-900/10 bg-white/82 px-4 text-base text-slate-950 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                      />
                    </label>
                    {mode === "register" && (
                      <label className="grid gap-2 text-sm font-medium text-slate-800">
                        Demo initial APGC balance
                        <input
                          value={initialBalance}
                          onChange={(event) => setInitialBalance(event.target.value)}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="min-h-12 rounded-2xl border border-teal-900/10 bg-white/82 px-4 text-base text-slate-950 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                        />
                        <span className="text-xs font-normal leading-5 text-slate-600">
                          Registration generates a fresh APGC keypair and deposits this demo balance into the contract.
                        </span>
                      </label>
                    )}
                  </div>

                  {notice && <InlineAlert tone="success" title="Registration complete" message={notice} />}
                  {error && <InlineAlert tone="error" title="Wallet request failed" message={error} />}

                  <Button
                    onClick={submit}
                    disabled={submitting}
                    className="h-12 w-full rounded-2xl bg-slate-950 text-white shadow-[0_14px_28px_rgba(8,127,120,0.22)] hover:bg-slate-800"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? <KeyRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {submitting ? "Processing" : mode === "login" ? "Enter Wallet" : "Register APGC Account"}
                  </Button>
                </section>
              )}
            </div>
          </main>

          <footer className="wallet-entry-footer border-t border-teal-900/10 bg-[#f8fcfb]/92 px-6 py-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="inline-flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-teal-700" />
                {status?.chain.connected ? `Block ${status.chain.latestBlock ?? "-"}` : "Chain offline"}
              </span>
              <span>{status?.accounts.length ?? 0} APGC accounts</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
