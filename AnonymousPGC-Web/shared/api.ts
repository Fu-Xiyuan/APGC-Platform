export type JobStatus = "pending" | "running" | "succeeded" | "failed";

export type ApiJobCheckpoint = {
  progress: number;
  step: string;
  at: string;
};

export type ApiJob<T = unknown> = {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  step: string;
  logs: string[];
  result?: T;
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  updatedAt: string;
  history?: ApiJobCheckpoint[];
};

export type TransferBuildResult = {
  transferId: string;
  participants: number;
  receiverCount: number;
  senderIndex: number;
  receiverIndexes: number[];
  anonIndexes: number[];
  amounts: string[];
  publicKeyCount: number;
  balanceCiphertextCount: number;
  transferCiphertextCount: number;
  proofPoints: number;
  proofScalars: number;
  solventProofPoints: number;
  solventProofScalars: number;
  positiveProofPoints: number;
  positiveProofScalars: number;
  artifactBytes: number;
  structureValidation: "passed";
  equationValidation: "passed" | "skipped";
};

export type ChainStatus = {
  connected: boolean;
  chainId?: string;
  latestBlock?: number;
  gasPriceWei?: string;
  rpcUrl: string;
  networkName: string;
  contracts: Record<string, string>;
  error?: string;
  contractFile?: string;
  stale?: boolean;
};

export type DemoAccount = {
  index: number;
  role: "sender" | "receiver" | "decoy" | string;
  identity: string;
  externalAddress?: string;
  externalBalanceWei?: string;
  publicKey: string[];
  publicKeyFingerprint?: string;
  initialBalance: string;
  demoPlainBalance: string;
  nonce: string;
  ciphertext: string[];
  depositTx?: string;
  lastTx?: string;
};

export type WalletUser = {
  id: string;
  username: string;
  participantIndex: number;
  externalAddress?: string;
  demoPlainBalance?: string;
  publicKey: string[];
  publicKeyFingerprint: string;
  createdAt: string;
};

export type PublicAPGCAccount = {
  participantIndex: number;
  publicKey: string[];
  publicKeyFingerprint: string;
  nonce: string;
  ciphertext: string[];
  registered: boolean;
};

export type WalletStatus = {
  ready: boolean;
  reason: string;
  chain: ChainStatus;
  accounts: PublicAPGCAccount[];
  registered: WalletUser[];
  participants: number;
  receiverCounts: number[];
};

export type WalletAuthResponse = {
  token: string;
  user: WalletUser;
  account: DemoAccount;
  status: WalletStatus;
};

export type WalletBalanceResponse = {
  publicKeyFingerprint: string;
  balance: string;
  nonce: string;
  ciphertext: string[];
  verified: boolean;
  source: string;
};

export type DemoTransaction = {
  id: string;
  type: string;
  hash: string;
  status: string;
  blockNumber: number;
  gasUsed: number;
  participant?: number;
  receiverCount?: number;
  anonSetSize?: number;
  amount?: string;
  createdAt: string;
};

export type DemoSession = {
  sessionId: string;
  status: string;
  participants: number;
  receiverCount: number;
  initialBalance: string;
  transferAmount: string;
  transferAmounts: string[];
  senderIndex: number;
  receiverIndexes: number[];
  anonIndexes: number[];
  exportPath?: string;
  accounts: DemoAccount[];
  transactions: DemoTransaction[];
  latestJobId?: string;
  transferBuildJobId?: string;
  latestTransferId?: string;
  transferBuilt: boolean;
  transferSubmitted: boolean;
  contractAddress?: string;
  contracts?: Record<string, string>;
};

export type MonitorEvent = {
  type: string;
  txHash: string;
  blockNumber: number;
  summary: string;
};

export type MonitorSummary = {
  chain: ChainStatus;
  accounts: DemoAccount[];
  transactions: DemoTransaction[];
  events: MonitorEvent[];
};

export type ApiConfig = {
  rpcUrl: string;
  networkName: string;
  participantsAllowed: number[];
  receiverCountsAllowed: number[];
  defaultParticipants: number;
  defaultReceiverCount: number;
  tokenSymbol: string;
};

const API_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_APGC_API_URL ||
  "http://127.0.0.1:8787";
const API_TIMEOUT_MS = Number(
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_APGC_API_TIMEOUT_MS || "12000",
);

export type TransferBuildBody = {
  senderIndex?: number;
  receiverIndexes?: number[];
  anonIndexes?: number[];
  amounts?: string[];
  participants?: number;
  authToken?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Number.isFinite(API_TIMEOUT_MS) ? API_TIMEOUT_MS : 12000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("APGC API request timed out.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `API request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

function post<T>(path: string, body: unknown = {}) {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export const api = {
  baseUrl: API_BASE,
  health: () => request<{ ok: boolean; service: string; version: string }>("/api/health"),
  config: () => request<ApiConfig>("/api/config"),
  chainStatus: () => request<ChainStatus>("/api/chain/status"),
  session: () => request<DemoSession>("/api/demo/session"),
  createSession: (body: Partial<DemoSession>) => post<DemoSession>("/api/demo/session", body),
  resetSession: () => post<{ ok: boolean }>("/api/demo/reset"),
  deploy: () => post<{ jobId: string }>("/api/demo/deploy"),
  initAccounts: (body = {}) => post<{ jobId: string }>("/api/demo/accounts/init", body),
  deposit: (participantIndexes: number[] = []) => post<{ jobId: string }>("/api/deposit", { participantIndexes }),
  apgcState: () => request<{ accounts: DemoAccount[] }>("/api/apgc/state"),
  buildTransfer: (body: TransferBuildBody = {}) => post<{ jobId: string }>("/api/transfer/build", body),
  submitTransfer: (transferId = "", authToken = "") => post<{ jobId: string }>("/api/transfer/submit", { transferId, authToken }),
  activity: () => request<DemoTransaction[]>("/api/activity"),
  job: <T = unknown>(id: string) => request<ApiJob<T>>(`/api/jobs/${id}`),
  walletStatus: () => request<WalletStatus>("/api/wallet/status"),
  walletAccounts: () => request<PublicAPGCAccount[]>("/api/wallet/accounts"),
  walletRegister: (body: { username: string; password: string; initialBalance?: string }) => post<WalletAuthResponse>("/api/wallet/register", body),
  walletLogin: (body: { username: string; password: string }) => post<WalletAuthResponse>("/api/wallet/login", body),
  walletBalance: (authToken: string) => post<WalletBalanceResponse>("/api/wallet/balance", { authToken }),
  monitorSummary: () => request<MonitorSummary>("/api/monitor/summary"),
  monitorAccounts: () => request<DemoAccount[]>("/api/monitor/accounts"),
  monitorTransactions: () => request<DemoTransaction[]>("/api/monitor/transactions"),
  monitorEvents: () => request<MonitorEvent[]>("/api/monitor/events"),
};

export function shortHash(value?: string) {
  if (!value) return "-";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function shortAddress(value?: string) {
  return shortHash(value);
}

export function ciphertextCommitment(ciphertext?: string[] | null) {
  const parts = (ciphertext ?? []).map((part) => String(part ?? "").trim()).filter(Boolean);
  if (!parts.length) return "";
  const nonZeroParts = parts.filter((part) => !/^0+$/.test(part));
  return nonZeroParts.length ? nonZeroParts.join(":") : "";
}

export function firstCiphertextCommitment(...candidates: Array<string[] | null | undefined>) {
  for (const candidate of candidates) {
    const commitment = ciphertextCommitment(candidate);
    if (commitment) return commitment;
  }
  return "";
}

export function shortCiphertext(ciphertext?: string[] | null) {
  const commitment = ciphertextCommitment(ciphertext);
  return commitment ? shortHash(commitment) : "pending";
}
