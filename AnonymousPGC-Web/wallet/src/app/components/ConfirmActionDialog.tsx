import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

import type { ReactNode } from "react";

type ConfirmActionDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  children: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  children,
  disabled,
  destructive,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" className="h-11 rounded-xl">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={onConfirm}
            className={`h-11 rounded-xl ${destructive ? "bg-destructive text-white hover:bg-destructive/90" : ""}`}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
