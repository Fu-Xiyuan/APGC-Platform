import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { cn } from "./ui/utils";

type InlineAlertProps = {
  title?: string;
  message: string;
  tone?: "info" | "success" | "error" | "warning";
  className?: string;
};

const toneClasses = {
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100",
  success: "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
};

function iconFor(tone: InlineAlertProps["tone"]) {
  if (tone === "success") return <CheckCircle className="h-4 w-4" />;
  if (tone === "error" || tone === "warning") return <AlertCircle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function InlineAlert({ title, message, tone = "info", className }: InlineAlertProps) {
  const isError = tone === "error" || tone === "warning";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn("flex gap-3 rounded-xl border p-4 text-sm", toneClasses[tone], className)}
    >
      <div className="mt-0.5 flex-shrink-0">{iconFor(tone)}</div>
      <div className="min-w-0 break-words [overflow-wrap:anywhere]">
        {title && <div className="font-semibold [overflow-wrap:anywhere]">{title}</div>}
        <div className={cn(title ? "mt-0.5" : "", "[overflow-wrap:anywhere]")}>{message}</div>
      </div>
    </div>
  );
}
