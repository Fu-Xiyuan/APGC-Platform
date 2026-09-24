import { Layout } from "../components/Layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
  Copy,
  Database,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getThemeMode, saveThemeMode, type ThemeMode } from "../demoState";
import { useEffect, useMemo, useState } from "react";
import { api, shortAddress, shortCiphertext, type ChainStatus, type WalletStatus } from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive } from "@shared/productIdentity";
import { InlineAlert } from "../components/InlineAlert";

export function SettingsScreen() {
  const navigate = useNavigate();
  const [identity] = useState(() => getProductIdentity());
  const [theme, setTheme] = useState<ThemeMode>(() => getThemeMode());
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [error, setError] = useState("");

  const toggleTheme = (enabled: boolean) => {
    const nextTheme = enabled ? "dark" : "light";
    setTheme(nextTheme);
    saveThemeMode(nextTheme);
  };

  const load = async () => {
    try {
      const [nextStatus, nextChain] = await Promise.all([
        api.walletStatus(),
        api.chainStatus(),
      ]);
      if (!productIdentityIsActive(identity, nextStatus)) {
        clearProductIdentity();
        navigate("/", { replace: true });
        return;
      }
      setStatus(nextStatus);
      setChain(nextChain);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "APGC API is unavailable.");
    }
  };

  useEffect(() => {
    if (!identity) {
      navigate("/", { replace: true });
      return undefined;
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [identity?.token, navigate]);

  const account = useMemo(() => {
    if (!identity || !status) return undefined;
    return status.accounts.find((item) => item.participantIndex === identity.user.participantIndex);
  }, [identity, status]);

  if (!identity) return null;

  const publicKey = identity.user.publicKey.join(", ");
  const accountIsRegistered = Boolean(account?.registered);
  const logout = () => {
    clearProductIdentity();
    navigate("/", { replace: true });
  };

  return (
    <Layout activeTab="settings">
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Inspect the authenticated APGC wallet and current chain connection.</p>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserRound className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">Wallet Identity</h3>
                <Badge className={accountIsRegistered ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                  {accountIsRegistered ? "Registered" : "Syncing"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                This browser can authorize only the APGC account returned by login.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Username</div>
              <div className="rounded-xl bg-muted/45 border border-border px-3 py-2 text-sm font-semibold text-foreground">
                {identity.user.username}
              </div>
            </div>
            <div className="rounded-xl bg-muted/45 border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Public key fingerprint</div>
                  <div className="text-sm font-mono text-foreground truncate">{identity.user.publicKeyFingerprint}</div>
                </div>
                <button
                  type="button"
                  aria-label="Copy public key"
                  onClick={() => navigator.clipboard?.writeText(publicKey)}
                  className="w-8 h-8 hover:bg-muted rounded-lg transition-colors flex items-center justify-center"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Network & Account State</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="text-sm text-foreground">Network</div>
                <div className="text-xs text-muted-foreground">Connected chain for private transfers</div>
              </div>
              <Badge className={chain?.connected ? "bg-primary/10 text-primary border-primary/20" : "bg-red-50 text-red-700 border-red-200"}>
                {chain?.connected ? chain.networkName : "Offline"}
              </Badge>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="text-sm text-foreground">Account key</div>
                <div className="text-xs text-muted-foreground">Public identity used inside APGCSystem</div>
              </div>
              <span className="max-w-[145px] truncate text-right text-xs font-mono text-foreground">{identity.user.publicKeyFingerprint}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="text-sm text-foreground">Ciphertext nonce</div>
                <div className="text-xs text-muted-foreground">Latest account state exposed by the API</div>
              </div>
              <span className="text-xs font-mono text-foreground">{account?.nonce ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="text-sm text-foreground">APGCSystem</div>
                <div className="text-xs text-muted-foreground">Current session contract address</div>
              </div>
              <span className="max-w-[145px] truncate text-right text-xs font-mono text-foreground">
                {shortAddress(chain?.contracts?.APGCSystem)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">Ciphertext</div>
                <div className="text-xs text-muted-foreground">Encrypted balance commitment preview</div>
              </div>
              <span className="max-w-[145px] truncate text-right text-xs font-mono text-foreground">
                {shortCiphertext(account?.ciphertext)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Preferences</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="w-5 h-5 text-primary" />
                ) : (
                  <Sun className="w-5 h-5 text-primary" />
                )}
                <div>
                  <div className="text-sm text-foreground">Theme</div>
                  <div className="text-xs text-muted-foreground">Switch between light and dark display</div>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm text-foreground">API endpoint</div>
                  <div className="text-xs text-muted-foreground">{api.baseUrl}</div>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">Local</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm text-foreground">Latest block</div>
                  <div className="text-xs text-muted-foreground">Refreshed from the API every few seconds</div>
                </div>
              </div>
              <span className="text-xs font-mono text-foreground">{chain?.latestBlock ?? "-"}</span>
            </div>
          </div>
        </div>

        {error && <InlineAlert tone="error" title="Settings sync failed" message={error} />}

        <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border space-y-3">
          <Button
            onClick={load}
            variant="outline"
            className="w-full rounded-xl h-12 border-border hover:bg-muted"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Chain State
          </Button>
          <Button
            onClick={logout}
            variant="destructive"
            className="w-full rounded-xl h-12"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </Layout>
  );
}
