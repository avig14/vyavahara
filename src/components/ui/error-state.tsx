"use client";

import { ApiError } from "@/lib/ui/api";
import { useL } from "@/lib/ui/lang";
import { Button } from "./button";
import { RefreshIcon } from "./icons";

export interface ErrorStateProps {
  /** what broke, plain English; default "Could not load this" */
  title?: string;
  /** an ApiError, any Error, or a message */
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}

function messageOf(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return undefined;
}

export function ErrorState({ title, error, onRetry, retrying }: ErrorStateProps) {
  const l = useL();
  title ??= l("Could not load this", "यह नहीं खुल पाया", "Yeh nahi khul paya");
  const message = messageOf(error);
  const status = error instanceof ApiError && error.status > 0 ? error.status : null;
  return (
    <div className="errst" role="alert">
      <p className="errst-title">{title}</p>
      {message ? <p className="errst-text">{message}</p> : null}
      {status ? <p className="errst-meta num">{l("Error", "त्रुटि", "Error")} {status}</p> : null}
      {onRetry ? (
        <div className="errst-act">
          <Button variant="secondary" icon={<RefreshIcon size={16} />} loading={retrying} onClick={onRetry}>
            {l("Try again", "फिर कोशिश करें", "Phir koshish karo")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
