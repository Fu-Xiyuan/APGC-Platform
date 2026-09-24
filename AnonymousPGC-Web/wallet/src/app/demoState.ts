export type Receiver = {
  id: number;
  participantIndex: number;
  address: string;
  amount: string;
};

export type ParticipantRole = "sender" | "receiver" | "decoy";

export type ParticipantNode = {
  id: number;
  role: ParticipantRole;
  color: string;
  label: string;
};

export type ThemeMode = "light" | "dark";

export type DemoTransaction = {
  id: string;
  hash: string;
  amount: number;
  receiverCount: number;
  setSize: number;
  fee: number;
  blockNumber: number;
  status: "Confirmed" | "Broadcasting";
  createdAt: string;
};

export const MIN_SET_SIZE = 1;
export const MAX_SET_SIZE = 64;
export const DEFAULT_MAX_RECEIVERS = 32;
export const SUPPORTED_SET_SIZES = [2, 4, 8, 16, 32, 64] as const;
export const TOKEN_SYMBOL = "APGC";

export const ROLE_COLORS: Record<ParticipantRole, string> = {
  sender: "#2563eb",
  receiver: "#10b981",
  decoy: "#a78bfa",
};

const RECEIVERS_KEY = "apgc.demo.receivers";
const SENDER_INDEX_KEY = "apgc.demo.senderIndex";
const SET_SIZE_KEY = "apgc.demo.setSize";
const ANON_INDEXES_KEY = "apgc.demo.anonIndexes";
const THEME_KEY = "apgc.demo.theme";
const TRANSACTIONS_KEY = "apgc.demo.transactions";

const defaultReceivers: Receiver[] = [
  { id: 1, participantIndex: 1, address: "receiver-key-1", amount: "1" },
];

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeReceivers(value: unknown, maxReceivers = DEFAULT_MAX_RECEIVERS): Receiver[] {
  if (!Array.isArray(value)) return defaultReceivers;

  const receivers = value
    .map((receiver, index) => {
      if (!receiver || typeof receiver !== "object") return null;
      const candidate = receiver as Partial<Receiver>;
      const inferredIndex = parseParticipantIndex(candidate.address);
      const participantIndex = typeof candidate.participantIndex === "number" ? candidate.participantIndex : inferredIndex ?? index + 1;
      return {
        id: typeof candidate.id === "number" ? candidate.id : index + 1,
        participantIndex,
        address: typeof candidate.address === "string" ? candidate.address : `receiver-key-${participantIndex}`,
        amount: typeof candidate.amount === "string" ? candidate.amount : "0.00",
      };
    })
    .filter((receiver): receiver is Receiver => Boolean(receiver));

  return receivers.length > 0 ? receivers.slice(0, maxReceivers) : defaultReceivers.slice(0, maxReceivers);
}

export function getReceivers(maxReceivers = DEFAULT_MAX_RECEIVERS): Receiver[] {
  if (!canUseStorage()) return defaultReceivers.slice(0, maxReceivers);

  const stored = window.localStorage.getItem(RECEIVERS_KEY);
  if (!stored) return defaultReceivers.slice(0, maxReceivers);

  try {
    return normalizeReceivers(JSON.parse(stored), maxReceivers);
  } catch {
    return defaultReceivers.slice(0, maxReceivers);
  }
}

export function saveReceivers(receivers: Receiver[], maxReceivers = DEFAULT_MAX_RECEIVERS) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(RECEIVERS_KEY, JSON.stringify(normalizeReceivers(receivers, maxReceivers)));
}

export function getSenderIndex(defaultIndex = 0) {
  if (!canUseStorage()) return defaultIndex;
  const stored = Number(window.localStorage.getItem(SENDER_INDEX_KEY));
  return Number.isInteger(stored) && stored >= 0 ? stored : defaultIndex;
}

export function saveSenderIndex(index: number) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SENDER_INDEX_KEY, String(index));
}

function nextPowerOfTwo(value: number) {
  let power = MIN_SET_SIZE;
  while (power < value && power < MAX_SET_SIZE) power *= 2;
  return Math.min(power, MAX_SET_SIZE);
}

export function getRecommendedSetSize(receiverCount: number) {
  return nextPowerOfTwo(Math.max(MIN_SET_SIZE, receiverCount + 1));
}

export function getMinimumSetSize(receiverCount = getReceivers().length) {
  return nextPowerOfTwo(Math.max(MIN_SET_SIZE, receiverCount + 1));
}

export function getSetSize(receiverCount = getReceivers().length) {
  if (!canUseStorage()) return getRecommendedSetSize(receiverCount);

  const stored = Number(window.localStorage.getItem(SET_SIZE_KEY));
  const recommended = getRecommendedSetSize(receiverCount);
  const minimum = getMinimumSetSize(receiverCount);

  if (!Number.isInteger(stored) || stored < minimum || stored > MAX_SET_SIZE) {
    return recommended;
  }

  return (SUPPORTED_SET_SIZES as readonly number[]).includes(stored) ? stored : recommended;
}

export function saveSetSize(size: number) {
  if (!canUseStorage()) return;
  const minimum = getMinimumSetSize();
  const candidates = SUPPORTED_SET_SIZES.filter((candidate) => candidate >= minimum && candidate <= MAX_SET_SIZE);
  const boundedSize = candidates.reduce((best, candidate) => (
    Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best
  ), candidates[0] ?? 2);
  window.localStorage.setItem(SET_SIZE_KEY, String(boundedSize));
}

function normalizeIndexes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const indexes: number[] = [];
  for (const item of value) {
    const parsed = Number(item);
    if (!Number.isInteger(parsed) || parsed < 0 || seen.has(parsed)) continue;
    seen.add(parsed);
    indexes.push(parsed);
  }
  return indexes;
}

export function getAnonIndexes(): number[] {
  if (!canUseStorage()) return [];
  const stored = window.localStorage.getItem(ANON_INDEXES_KEY);
  if (!stored) return [];
  try {
    return normalizeIndexes(JSON.parse(stored));
  } catch {
    return [];
  }
}

export function saveAnonIndexes(indexes: number[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ANON_INDEXES_KEY, JSON.stringify(normalizeIndexes(indexes)));
}

export function getThemeMode(): ThemeMode {
  if (!canUseStorage()) return "dark";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function applyThemeMode(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function saveThemeMode(theme: ThemeMode) {
  if (canUseStorage()) {
    window.localStorage.setItem(THEME_KEY, theme);
  }
  applyThemeMode(theme);
}

export function parseAmount(amount: string) {
  const numeric = Number(amount.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatAmount(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildParticipantNodes(setSize: number, receiverCount: number): ParticipantNode[] {
  const receiverPositions = new Set<number>();
  const availableReceiverSlots = Math.max(0, setSize - 1);
  const displayedReceiverCount = Math.min(receiverCount, availableReceiverSlots);

  for (let index = 0; index < displayedReceiverCount; index += 1) {
    const position = 1 + Math.floor(((index + 1) * availableReceiverSlots) / (displayedReceiverCount + 1));
    receiverPositions.add(position);
  }

  return Array.from({ length: setSize }, (_, index) => {
    const role: ParticipantRole = index === 0 ? "sender" : receiverPositions.has(index) ? "receiver" : "decoy";
    return {
      id: index + 1,
      role,
      color: ROLE_COLORS[role],
      label: String(index + 1),
    };
  });
}

export function buildParticipantNodesFromSelection(
  setSize: number,
  senderIndex: number,
  receiverIndexes: number[],
): ParticipantNode[] {
  const receivers = new Set(receiverIndexes);
  return Array.from({ length: setSize }, (_, index) => {
    const role: ParticipantRole = index === senderIndex ? "sender" : receivers.has(index) ? "receiver" : "decoy";
    return {
      id: index + 1,
      role,
      color: ROLE_COLORS[role],
      label: String(index),
    };
  });
}

function parseParticipantIndex(value?: string) {
  if (!value) return null;
  const match = value.match(/participant\[(\d+)\]/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function buildTxHash(setSize: number, receiverCount: number, amount: number) {
  const amountSeed = Math.round(amount * 100).toString(16).padStart(8, "0");
  return `0x${setSize.toString(16).padStart(2, "0")}${receiverCount.toString(16).padStart(2, "0")}9f3c...${amountSeed}`;
}

function normalizeTransactions(value: unknown): DemoTransaction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((transaction): DemoTransaction | null => {
      if (!transaction || typeof transaction !== "object") return null;
      const candidate = transaction as Partial<DemoTransaction>;
      if (typeof candidate.hash !== "string") return null;

      return {
        id: typeof candidate.id === "string" ? candidate.id : candidate.hash,
        hash: candidate.hash,
        amount: typeof candidate.amount === "number" ? candidate.amount : 0,
        receiverCount: typeof candidate.receiverCount === "number" ? candidate.receiverCount : 1,
        setSize: typeof candidate.setSize === "number" ? candidate.setSize : getRecommendedSetSize(1),
        fee: typeof candidate.fee === "number" ? candidate.fee : 0,
        blockNumber: typeof candidate.blockNumber === "number" ? candidate.blockNumber : 5892342,
        status: candidate.status === "Broadcasting" ? "Broadcasting" : "Confirmed",
        createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
      };
    })
    .filter((transaction): transaction is DemoTransaction => Boolean(transaction));
}

export function getTransactions(): DemoTransaction[] {
  if (!canUseStorage()) return [];

  const stored = window.localStorage.getItem(TRANSACTIONS_KEY);
  if (!stored) return [];

  try {
    return normalizeTransactions(JSON.parse(stored));
  } catch {
    return [];
  }
}

export function saveTransactions(transactions: DemoTransaction[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(normalizeTransactions(transactions).slice(0, 12)));
}

export function createCurrentTransaction(): DemoTransaction {
  const receivers = getReceivers();
  const receiverCount = receivers.length;
  const setSize = getSetSize(receiverCount);
  const amount = receivers.reduce((sum, receiver) => sum + parseAmount(receiver.amount), 0);
  const fee = 0.05 + setSize * 0.006 + receiverCount * 0.01;
  const previous = getTransactions();
  const blockNumber = (previous[0]?.blockNumber ?? 5892341) + 1;
  const hash = buildTxHash(setSize, receiverCount, amount);

  return {
    id: `${hash}-${Date.now()}`,
    hash,
    amount,
    receiverCount,
    setSize,
    fee,
    blockNumber,
    status: "Confirmed",
    createdAt: new Date().toISOString(),
  };
}

export function recordCurrentTransaction() {
  const transaction = createCurrentTransaction();
  const existing = getTransactions();
  const alreadyRecorded = existing.some((item) => item.hash === transaction.hash && item.amount === transaction.amount);

  if (alreadyRecorded) {
    return existing[0];
  }

  saveTransactions([transaction, ...existing]);
  return transaction;
}
