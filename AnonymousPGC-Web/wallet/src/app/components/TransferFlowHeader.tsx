const transferSteps = ["Recipients", "Privacy", "Build", "Submit", "Complete"];

interface TransferFlowHeaderProps {
  step: number;
  title: string;
  description: string;
  complete?: boolean;
}

export function TransferFlowHeader({ step, title, description, complete = false }: TransferFlowHeaderProps) {
  const currentStep = Math.min(Math.max(step, 1), transferSteps.length);

  return (
    <header className="wallet-flow-header">
      <div className="wallet-flow-kicker">
        <span>Private transfer</span>
        <span>{complete ? "Complete" : `Step ${currentStep} of ${transferSteps.length}`}</span>
      </div>
      <div className="wallet-flow-track" aria-label={`Private transfer progress: ${complete ? "complete" : transferSteps[currentStep - 1]}`}>
        {transferSteps.map((label, index) => {
          const number = index + 1;
          const state = complete || number < currentStep ? "complete" : number === currentStep ? "current" : "pending";
          return <span key={label} className={`wallet-flow-segment ${state}`} title={label} />;
        })}
      </div>
      <div className="wallet-flow-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}
