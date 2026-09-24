export type TransferVisualTarget = {
  id: string | number;
  label: string;
  amount: string;
};

type VisualSize = "compact" | "wide";

function displayedTargets(targets: TransferVisualTarget[], limit: number): TransferVisualTarget[] {
  if (targets.length <= limit) return targets;
  return [
    ...targets.slice(0, limit - 1),
    {
      id: "remaining-targets",
      label: `+${targets.length - limit + 1} more`,
      amount: "hidden outputs",
    },
  ];
}

function yPositions(count: number, height: number, top: number, bottom: number) {
  if (count <= 1) return [height / 2];
  return Array.from({ length: count }, (_, index) => top + ((bottom - top) * index) / (count - 1));
}

export function RecipientFlowDiagram(props: {
  targets: TransferVisualTarget[];
  total: string;
  size?: VisualSize;
}) {
  const compact = props.size !== "wide";
  const width = compact ? 360 : 760;
  const height = compact ? 220 : 290;
  const senderX = compact ? 42 : 78;
  const draftX = compact ? 166 : 352;
  const targetX = compact ? 316 : 682;
  const targets = displayedTargets(props.targets, compact ? 5 : 8);
  const positions = yPositions(targets.length, height, compact ? 42 : 46, compact ? 178 : 244);
  const inputPath = `M${senderX + 28} ${height / 2} C${senderX + 76} ${height / 2 - 42}, ${draftX - 66} ${height / 2 + 42}, ${draftX - 35} ${height / 2}`;

  return (
    <div className={`apgc-flow-visual apgc-recipient-flow ${compact ? "compact" : "wide"}`}>
      <div className="apgc-visual-heading">
        <span>Local payment intent</span>
        <strong>{props.targets.length} encrypted output{props.targets.length === 1 ? "" : "s"}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`One sender allocating ${props.total} across ${props.targets.length} receivers`}>
        <defs>
          <linearGradient id={`recipientInput-${compact ? "c" : "w"}`} x1={senderX} x2={draftX} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14f1d9" stopOpacity="0" />
            <stop offset="45%" stopColor="#14f1d9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`recipientOutput-${compact ? "c" : "w"}`} x1={draftX} x2={targetX} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="48%" stopColor="#14f1d9" />
            <stop offset="100%" stopColor="#f2b84b" stopOpacity="0" />
          </linearGradient>
          <filter id={`recipientGlow-${compact ? "c" : "w"}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path className="apgc-flow-track" d={inputPath} />
        <path className="apgc-flow-beam input" d={inputPath} stroke={`url(#recipientInput-${compact ? "c" : "w"})`} />
        {targets.map((target, index) => {
          const y = positions[index];
          const path = `M${draftX + 35} ${height / 2} C${draftX + 82} ${height / 2}, ${targetX - 64} ${y}, ${targetX - 23} ${y}`;
          return (
            <g key={target.id}>
              <path className="apgc-flow-track" d={path} />
              <path
                className="apgc-flow-beam output"
                d={path}
                stroke={`url(#recipientOutput-${compact ? "c" : "w"})`}
                style={{ animationDelay: `${-index * 0.42}s` }}
              />
              <circle className="apgc-endpoint-ring" cx={targetX} cy={y} r={compact ? 15 : 18} />
              <circle className="apgc-endpoint-dot" cx={targetX} cy={y} r={compact ? 4 : 5} />
              <text className="apgc-endpoint-label" x={targetX - (compact ? 22 : 28)} y={y - 7} textAnchor="end">{target.label}</text>
              <text className="apgc-endpoint-amount" x={targetX - (compact ? 22 : 28)} y={y + 9} textAnchor="end">{target.amount}</text>
            </g>
          );
        })}

        <circle className="apgc-source-aura" cx={senderX} cy={height / 2} r={compact ? 27 : 32} />
        <circle className="apgc-source-core" cx={senderX} cy={height / 2} r={compact ? 20 : 24} />
        <text className="apgc-source-label" x={senderX} y={height / 2 - 2} textAnchor="middle">YOU</text>
        <text className="apgc-source-amount" x={senderX} y={height / 2 + 11} textAnchor="middle">{props.total}</text>

        <circle className="apgc-contract-shell" cx={draftX} cy={height / 2} r={compact ? 39 : 48} />
        <circle className="apgc-contract-core" cx={draftX} cy={height / 2} r={compact ? 29 : 36} filter={`url(#recipientGlow-${compact ? "c" : "w"})`} />
        <text className="apgc-contract-title" x={draftX} y={height / 2 - 2} textAnchor="middle">APGC</text>
        <text className="apgc-contract-subtitle" x={draftX} y={height / 2 + 13} textAnchor="middle">DRAFT</text>
      </svg>
    </div>
  );
}

export function ProofAssemblyDiagram(props: {
  progress: number;
  setSize: number;
  receiverCount: number;
  ready?: boolean;
  size?: VisualSize;
}) {
  const compact = props.size !== "wide";
  const width = compact ? 360 : 760;
  const height = compact ? 238 : 300;
  const inputX = compact ? 66 : 118;
  const coreX = compact ? 178 : 380;
  const outputX = compact ? 304 : 650;
  const centerY = height / 2 + 7;
  const inputCount = Math.min(props.setSize, compact ? 18 : 28);
  const proofActive = props.progress >= 18;
  const artifactActive = props.progress >= 72;
  const validationActive = props.progress >= 80;
  const sealed = props.ready || props.progress >= 100;

  return (
    <div className={`apgc-flow-visual apgc-proof-assembly ${compact ? "compact" : "wide"}`} data-progress={Math.round(props.progress)}>
      <div className="apgc-visual-heading">
        <span>Proof and transaction construction</span>
        <strong>{sealed ? "Artifact sealed" : `${Math.round(props.progress)}%`}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Building a proof and transaction artifact for ${props.setSize} anonymity members`}>
        <defs>
          <linearGradient id={`proofBeam-${compact ? "c" : "w"}`} x1="0" x2="1">
            <stop offset="0%" stopColor="#14f1d9" stopOpacity="0" />
            <stop offset="50%" stopColor="#14f1d9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`proofCore-${compact ? "c" : "w"}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1cf2d2" />
            <stop offset="100%" stopColor="#276df2" />
          </linearGradient>
          <filter id={`proofGlow-${compact ? "c" : "w"}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <text className="apgc-stage-caption" x={inputX} y="28" textAnchor="middle">PRIVATE INPUTS</text>
        <text className="apgc-stage-caption" x={coreX} y="28" textAnchor="middle">ZK PROVER</text>
        <text className="apgc-stage-caption" x={outputX} y="28" textAnchor="middle">TX ARTIFACT</text>

        {Array.from({ length: inputCount }, (_, index) => {
          const columns = compact ? 4 : 5;
          const row = Math.floor(index / columns);
          const column = index % columns;
          const spacing = compact ? 14 : 18;
          const x = inputX + (column - (columns - 1) / 2) * spacing;
          const y = centerY - 38 + row * spacing;
          return <circle key={index} className="apgc-private-input" cx={x} cy={y} r={compact ? 3.2 : 4} style={{ animationDelay: `${-index * 0.12}s` }} />;
        })}
        <text className="apgc-input-meta" x={inputX} y={centerY + (compact ? 66 : 76)} textAnchor="middle">{props.setSize} members / {props.receiverCount} receivers</text>

        <path className="apgc-flow-track" d={`M${inputX + 42} ${centerY} C${inputX + 76} ${centerY - 48}, ${coreX - 72} ${centerY + 48}, ${coreX - 45} ${centerY}`} />
        <path className={`apgc-flow-beam ${proofActive ? "active" : ""}`} d={`M${inputX + 42} ${centerY} C${inputX + 76} ${centerY - 48}, ${coreX - 72} ${centerY + 48}, ${coreX - 45} ${centerY}`} stroke={`url(#proofBeam-${compact ? "c" : "w"})`} />

        <circle className={`apgc-proof-orbit ${proofActive ? "active" : ""}`} cx={coreX} cy={centerY} r={compact ? 49 : 60} />
        <circle className="apgc-contract-shell" cx={coreX} cy={centerY} r={compact ? 39 : 48} />
        <circle className={`apgc-contract-core ${proofActive ? "active" : ""}`} cx={coreX} cy={centerY} r={compact ? 29 : 36} fill={`url(#proofCore-${compact ? "c" : "w"})`} filter={`url(#proofGlow-${compact ? "c" : "w"})`} />
        <text className="apgc-contract-title" x={coreX} y={centerY - 2} textAnchor="middle">APGC</text>
        <text className="apgc-contract-subtitle" x={coreX} y={centerY + 13} textAnchor="middle">PROVER</text>

        <path className="apgc-flow-track" d={`M${coreX + 45} ${centerY} C${coreX + 82} ${centerY - 38}, ${outputX - 72} ${centerY + 38}, ${outputX - 43} ${centerY}`} />
        <path className={`apgc-flow-beam output ${artifactActive ? "active" : ""}`} d={`M${coreX + 45} ${centerY} C${coreX + 82} ${centerY - 38}, ${outputX - 72} ${centerY + 38}, ${outputX - 43} ${centerY}`} stroke={`url(#proofBeam-${compact ? "c" : "w"})`} />

        {["CIPHERTEXTS", "ZK PROOF", "PUBLIC DATA"].map((label, index) => {
          const y = centerY - 42 + index * 42;
          const active = artifactActive && (index < 2 || validationActive);
          return (
            <g key={label} className={`apgc-artifact-layer ${active ? "active" : ""} ${sealed ? "sealed" : ""}`}>
              <rect x={outputX - (compact ? 42 : 52)} y={y - 13} width={compact ? 84 : 104} height="26" rx="5" />
              <text x={outputX} y={y + 3} textAnchor="middle">{label}</text>
            </g>
          );
        })}
        {sealed && (
          <g className="apgc-artifact-check" transform={`translate(${outputX + (compact ? 44 : 54)} ${centerY - 54})`}>
            <circle r="12" />
            <path className="apgc-check-mark" d="M-5 0 L-1.5 3.5 L6 -5" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function ContractExecutionDiagram(props: {
  targets: TransferVisualTarget[];
  total: string;
  setSize: number;
  active: boolean;
  confirmed: boolean;
  progress?: number;
  size?: VisualSize;
}) {
  const compact = props.size !== "wide";
  const width = compact ? 360 : 800;
  const height = compact ? 260 : 330;
  const senderX = compact ? 38 : 72;
  const contractX = compact ? 178 : 400;
  const targetX = compact ? 326 : 728;
  const centerY = height / 2 + 8;
  const targets = displayedTargets(props.targets, compact ? 5 : 8);
  const positions = yPositions(targets.length, height, compact ? 48 : 56, compact ? 214 : 276);
  const memberCount = Math.min(props.setSize, compact ? 32 : 48);
  const processing = props.active || props.confirmed;
  const inputPath = `M${senderX + 25} ${centerY} C${senderX + 76} ${centerY - 52}, ${contractX - 84} ${centerY + 52}, ${contractX - 54} ${centerY}`;

  return (
    <div className={`apgc-flow-visual apgc-contract-execution ${compact ? "compact" : "wide"} ${props.active ? "active" : ""} ${props.confirmed ? "confirmed" : ""}`}>
      <div className="apgc-visual-heading">
        <span>Sender view / contract execution</span>
        <strong>{props.confirmed ? "State finalized" : props.active ? `${Math.round(props.progress ?? 0)}%` : "Ready"}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`APGC contract updating ${props.setSize} anonymous account states for ${props.targets.length} receiver outputs`}>
        <defs>
          <linearGradient id={`contractInput-${compact ? "c" : "w"}`} x1={senderX} x2={contractX} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14f1d9" stopOpacity="0" />
            <stop offset="48%" stopColor="#14f1d9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`contractOutput-${compact ? "c" : "w"}`} x1={contractX} x2={targetX} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#14f1d9" />
            <stop offset="100%" stopColor="#f2b84b" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`contractCore-${compact ? "c" : "w"}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1cf2d2" />
            <stop offset="100%" stopColor="#276df2" />
          </linearGradient>
          <filter id={`contractGlow-${compact ? "c" : "w"}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path className="apgc-flow-track" d={inputPath} />
        <path className={`apgc-flow-beam input ${processing ? "active" : ""}`} d={inputPath} stroke={`url(#contractInput-${compact ? "c" : "w"})`} />

        {targets.map((target, index) => {
          const y = positions[index];
          const path = `M${contractX + 54} ${centerY} C${contractX + 96} ${centerY}, ${targetX - 56} ${y}, ${targetX - 21} ${y}`;
          return (
            <g key={target.id}>
              <path className="apgc-flow-track" d={path} />
              <path
                className={`apgc-flow-beam output ${processing ? "active" : ""}`}
                d={path}
                stroke={`url(#contractOutput-${compact ? "c" : "w"})`}
                style={{ animationDelay: `${-index * 0.34}s` }}
              />
              <circle className={`apgc-endpoint-ring ${props.confirmed ? "confirmed" : ""}`} cx={targetX} cy={y} r={compact ? 13 : 16} />
              <circle className="apgc-endpoint-dot" cx={targetX} cy={y} r={compact ? 3.5 : 4.5} />
              <text className="apgc-endpoint-label" x={targetX - (compact ? 18 : 23)} y={y - 6} textAnchor="end">{target.label}</text>
              <text className="apgc-endpoint-amount" x={targetX - (compact ? 18 : 23)} y={y + 9} textAnchor="end">{target.amount}</text>
            </g>
          );
        })}

        {Array.from({ length: memberCount }, (_, index) => {
          const angle = -90 + (360 / memberCount) * index;
          const radiusX = compact ? 65 : 86;
          const radiusY = compact ? 68 : 92;
          const x = contractX + radiusX * Math.cos((angle * Math.PI) / 180);
          const y = centerY + radiusY * Math.sin((angle * Math.PI) / 180);
          return <circle key={index} className={`apgc-contract-member ${processing ? "processing" : ""}`} cx={x} cy={y} r={memberCount > 24 ? 2.1 : 3} />;
        })}
        <ellipse className="apgc-contract-orbit" cx={contractX} cy={centerY} rx={compact ? 69 : 91} ry={compact ? 72 : 96} />
        <circle className="apgc-contract-shell" cx={contractX} cy={centerY} r={compact ? 43 : 54} />
        <circle className="apgc-contract-core" cx={contractX} cy={centerY} r={compact ? 32 : 41} fill={`url(#contractCore-${compact ? "c" : "w"})`} filter={`url(#contractGlow-${compact ? "c" : "w"})`} />
        <text className="apgc-contract-title" x={contractX} y={centerY - 3} textAnchor="middle">APGC</text>
        <text className="apgc-contract-subtitle" x={contractX} y={centerY + 13} textAnchor="middle">CONTRACT</text>

        <circle className="apgc-source-aura" cx={senderX} cy={centerY} r={compact ? 25 : 31} />
        <circle className="apgc-source-core" cx={senderX} cy={centerY} r={compact ? 18 : 23} />
        <text className="apgc-source-label" x={senderX} y={centerY - 2} textAnchor="middle">YOU</text>
        <text className="apgc-source-amount" x={senderX} y={centerY + 10} textAnchor="middle">{props.total}</text>

        {props.confirmed && (
          <g className="apgc-contract-check" transform={`translate(${contractX + (compact ? 40 : 51)} ${centerY - (compact ? 42 : 53)})`}>
            <circle r={compact ? 12 : 14} />
            <path className="apgc-check-mark" d={compact ? "M-5 0 L-1.5 3.5 L6 -5" : "M-6 0 L-2 4 L7 -6"} />
          </g>
        )}
      </svg>
      <div className="apgc-contract-legend">
        <span><i className="private" />{props.setSize} equal account updates</span>
        <span><i className="amount" />amounts visible only in sender view</span>
      </div>
    </div>
  );
}
