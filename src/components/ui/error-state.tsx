"use client";

import { ApiError } from "@/lib/ui/api";
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

export function ErrorState({ title = "Could not load this", error, onRetry, retrying }: ErrorStateProps) {
  const message = messageOf(error);
  const status = error instanceof ApiError && error.status > 0 ? error.status : null;
  return (
    <div className="errst" role="alert">
      <p className="errst-title">{title}</p>
      {message ? <p className="errst-text">{message}</p> : null}
      {status ? <p className="errst-meta num">Error {status}</p> : null}
      {onRetry ? (
        <div className="errst-act">
          <Button variant="secondary" icon={<RefreshIcon size={16} />} loading={retrying} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
