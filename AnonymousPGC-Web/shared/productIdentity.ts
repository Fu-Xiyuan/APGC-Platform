import type { WalletStatus, WalletUser } from "./api";

export type ProductIdentity = {
  token: string;
  user: WalletUser;
  loggedInAt: string;
};

const IDENTITY_KEY = "apgc.wallet.identity";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeIdentity(value: unknown): ProductIdentity | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ProductIdentity>;
  if (!candidate.user || typeof candidate.user !== "object") return null;
  const user = candidate.user as Partial<WalletUser>;
  if (!candidate.token || typeof candidate.token !== "string") return null;
  if (!user.username || typeof user.username !== "string") return null;
  if (!Number.isInteger(user.participantIndex) || (user.participantIndex as number) < 0) return null;

  return {
    token: candidate.token,
    user: user as WalletUser,
    loggedInAt: typeof candidate.loggedInAt === "string" ? candidate.loggedInAt : new Date().toISOString(),
  };
}

export function getProductIdentity(): ProductIdentity | null {
  if (!canUseStorage()) return null;
  const stored = window.localStorage.getItem(IDENTITY_KEY);
  if (!stored) return null;

  try {
    return normalizeIdentity(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function saveProductIdentity(identity: { token: string; user: WalletUser }) {
  const normalized = normalizeIdentity({
    token: identity.token,
    user: identity.user,
    loggedInAt: new Date().toISOString(),
  });
  if (!normalized) throw new Error("A valid APGC wallet login is required.");
  if (canUseStorage()) {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearProductIdentity() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(IDENTITY_KEY);
}

export function productIdentityIsActive(identity: ProductIdentity | null, status: WalletStatus | null) {
  if (!identity || !status?.ready) return false;
  return status.accounts.some((account) => account.participantIndex === identity.user.participantIndex);
}
