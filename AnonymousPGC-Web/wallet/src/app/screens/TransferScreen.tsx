import { Layout } from "../components/Layout";
import { Send, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { InlineAlert } from "../components/InlineAlert";
import { TransferFlowHeader } from "../components/TransferFlowHeader";
import { api, type DemoAccount, type PublicAPGCAccount, type WalletBalanceResponse, type WalletStatus } from "@shared/api";
import { clearProductIdentity, getProductIdentity, productIdentityIsActive } from "@shared/productIdentity";
import { RecipientFlowDiagram } from "@shared/transferVisuals";
import {
  formatAmount,
  getReceivers,
  parseAmount,
  type Receiver,
  saveReceivers,
  saveSenderIndex,
  TOKEN_SYMBOL,
} from "../demoState";
import { useEffect, useMemo, useState } from "react";

const fallbackReceiverCounts = [1, 2, 4, 8, 16, 32];

function receiverFromAccount(id: number, account: PublicAPGCAccount, amount: string): Receiver {
  return {
    id,
    participantIndex: account.participantIndex,
    address: account.publicKeyFingerprint,
    amount,
  };
}

function receiverCountOptions(max: number, supported = fallbackReceiverCounts) {
  return supported.filter((count) => count <= max);
}

export function TransferScreen() {
  const navigate = useNavigate();
  const [identity] = useState(() => getProductIdentity());
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [privateBalance, setPrivateBalance] = useState<WalletBalanceResponse | null>(null);
  const [receivers, setReceivers] = useState<Receiver[]>(() => getReceivers());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!identity) {
      navigate("/", { replace: true });
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [walletStatus, session] = await Promise.all([
          api.walletStatus(),
          api.session(),
        ]);
        if (cancelled) return;
        if (!productIdentityIsActive(identity, walletStatus)) {
          clearProductIdentity();
          navigate("/", { replace: true });
          return;
        }
        const ownAccount = session.accounts.find((item) => item.index === identity.user.participantIndex) ?? null;
        const availableAccounts = walletStatus.accounts.filter((item) => item.participantIndex !== identity.user.participantIndex);
        const defaultReceiver = availableAccounts[0];
        setStatus(walletStatus);
        setAccount(ownAccount);
        setReceivers((current) => {
          const valid = current.filter((receiver) => availableAccounts.some((item) => item.participantIndex === receiver.participantIndex));
          const next = valid.length > 0 || !defaultReceiver
            ? valid
            : [receiverFromAccount(1, defaultReceiver, session.transferAmount || "1")];
          saveReceivers(next, Math.max(1, availableAccounts.length));
          return next;
        });
        saveSenderIndex(identity.user.participantIndex);
        api.walletBalance(identity.token)
          .then((balance) => {
            if (!cancelled) setPrivateBalance(balance);
          })
          .catch(() => {
            if (!cancelled) setPrivateBalance(null);
          });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "wallet state unavailable");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [identity?.token, navigate]);

  const accounts = (status?.accounts ?? []).filter((item) => item.participantIndex !== identity?.user.participantIndex);
  const allowedCounts = receiverCountOptions(accounts.length, status?.receiverCounts?.length ? status.receiverCounts : fallbackReceiverCounts);
  const selectedReceiverIndexes = new Set(receivers.map((receiver) => receiver.participantIndex));
  const totalAmount = useMemo(() => receivers.reduce((sum, receiver) => sum + parseAmount(receiver.amount), 0), [receivers]);
  const visualTargets = receivers.map((receiver, index) => ({
    id: receiver.id,
    label: `Receiver ${index + 1}`,
    amount: `${formatAmount(parseAmount(receiver.amount))} ${TOKEN_SYMBOL}`,
  }));
  const balance = parseAmount(privateBalance?.balance ?? "0");

  if (!identity) return null;

  const updateReceivers = (nextReceivers: Receiver[]) => {
    setReceivers(nextReceivers);
    saveReceivers(nextReceivers, Math.max(1, accounts.length));
  };

  const firstAvailable = (current: Receiver[]) => (
    accounts.find((candidate) => !current.some((receiver) => receiver.participantIndex === candidate.participantIndex))
  );

  const setReceiverCount = (count: number) => {
    if (count < receivers.length) {
      updateReceivers(receivers.slice(0, count));
      return;
    }
    let next = [...receivers];
    while (next.length < count) {
      const account = firstAvailable(next);
      if (!account) break;
      const nextId = Math.max(...next.map((receiver) => receiver.id), 0) + 1;
      next = [...next, receiverFromAccount(nextId, account, "1")];
    }
    updateReceivers(next);
  };

  const updateReceiverAccount = (id: number, participantIndex: number) => {
    const nextAccount = accounts.find((item) => item.participantIndex === participantIndex);
    updateReceivers(receivers.map((receiver) => (
      receiver.id === id && nextAccount ? receiverFromAccount(id, nextAccount, receiver.amount) : receiver
    )));
  };

  const updateReceiverAmount = (id: number, amount: string) => {
    updateReceivers(receivers.map((receiver) => receiver.id === id ? { ...receiver, amount } : receiver));
  };

  const removeReceiver = (id: number) => {
    if (receivers.length <= 1) return;
    updateReceivers(receivers.filter((receiver) => receiver.id !== id));
  };

  const validateTransfer = () => {
    if (!status?.ready) return status?.reason ?? "AnonymousPGC is not ready.";
    if (!account) return "Logged-in APGC account was not found on chain.";
    if (receivers.length === 0) return "Select at least one receiver.";
    if (!allowedCounts.includes(receivers.length)) return `Receiver count must be one of ${allowedCounts.join(", ")}.`;
    if (selectedReceiverIndexes.size !== receivers.length) return "Receiver accounts must be unique.";
    if (receivers.some((receiver) => receiver.participantIndex === identity.user.participantIndex)) return "Sender cannot be a receiver.";
    if (receivers.some((receiver) => !/^[1-9]\d*$/.test(receiver.amount.trim()))) return "Each amount must be a positive integer.";
    if (!privateBalance) return "Wallet balance is still syncing from the encrypted chain state.";
    if (totalAmount >= balance) return "Transfer total must be smaller than your current APGC balance.";
    return "";
  };

  const continueTransfer = () => {
    const validationError = validateTransfer();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    saveSenderIndex(identity.user.participantIndex);
    saveReceivers(receivers, Math.max(1, accounts.length));
    navigate("/choose-set-size");
  };

  return (
    <Layout activeTab="transfer">
      <div className="wallet-flow-page space-y-4 p-6">
        <TransferFlowHeader
          step={1}
          title="Choose recipients"
          description="Select the public APGC accounts and the private amount each account receives."
        />

        <section className="wallet-transfer-summary">
          <div><span>Available</span><strong>{privateBalance ? `${formatAmount(balance)} ${TOKEN_SYMBOL}` : "Syncing"}</strong></div>
          <div><span>Total</span><strong>{formatAmount(totalAmount)} {TOKEN_SYMBOL}</strong></div>
          <div><span>Recipients</span><strong>{receivers.length}</strong></div>
        </section>

        <RecipientFlowDiagram
          targets={visualTargets}
          total={`${formatAmount(totalAmount)} ${TOKEN_SYMBOL}`}
        />

        <section className="wallet-flow-card p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-foreground">Number of recipients</div>
            <div className="text-xs text-muted-foreground">Supported counts are determined by the APGC setup.</div>
          </div>

          <div className="wallet-choice-grid">
            {allowedCounts.map((count) => (
              <button
                type="button"
                key={count}
                onClick={() => setReceiverCount(count)}
                className={`min-h-11 rounded-xl border text-sm font-semibold transition-colors ${
                  receivers.length === count ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                {count}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {receivers.map((receiver, index) => {
              const availableAccounts = accounts.filter((candidate) => (
                !selectedReceiverIndexes.has(candidate.participantIndex) || candidate.participantIndex === receiver.participantIndex
              ));
              const selectedAccount = accounts.find((candidate) => candidate.participantIndex === receiver.participantIndex);
              return (
                <article key={receiver.id} className="wallet-recipient-card">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Recipient {index + 1}</div>
                      <div className="text-xs text-muted-foreground">{formatAmount(parseAmount(receiver.amount))} {TOKEN_SYMBOL}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove recipient ${index + 1}`}
                      onClick={() => removeReceiver(receiver.id)}
                      disabled={receivers.length <= 1}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="wallet-recipient-fields">
                    <label className="min-w-0">
                      <span>APGC account</span>
                      <select
                        value={receiver.participantIndex}
                        onChange={(event) => updateReceiverAccount(receiver.id, Number(event.target.value))}
                        aria-label={`Recipient ${index + 1} APGC account`}
                        className="min-h-11 w-full rounded-xl border border-border bg-card px-3 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                      >
                        {availableAccounts.map((account) => (
                          <option key={account.participantIndex} value={account.participantIndex}>
                            {account.publicKeyFingerprint}
                          </option>
                        ))}
                      </select>
                      <small title={selectedAccount?.publicKeyFingerprint ?? receiver.address}>
                        key {selectedAccount?.publicKeyFingerprint ?? receiver.address}
                      </small>
                    </label>
                    <label>
                      <span>Amount</span>
                      <div className="wallet-amount-field">
                        <Input
                          aria-label={`Recipient ${index + 1} amount`}
                          value={receiver.amount}
                          onChange={(event) => updateReceiverAmount(receiver.id, event.target.value)}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="min-h-11 min-w-0 rounded-xl bg-card text-right text-sm font-semibold"
                        />
                        <b>{TOKEN_SYMBOL}</b>
                      </div>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {error && <InlineAlert tone="error" title="Transfer draft invalid" message={error} />}

        <Button onClick={continueTransfer} className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
          <Send className="h-4 w-4" />
          Continue to privacy set
        </Button>
      </div>
    </Layout>
  );
}
