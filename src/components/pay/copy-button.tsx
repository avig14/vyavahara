"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older WebViews and non-secure origins: fall back to a selected textarea
    const t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

export interface CopyButtonProps {
  text: string;
  /** what the button says at rest */
  label?: string;
  variant?: ButtonVariant;
  /** names the copied thing for screen readers: "Copy UPI ID" */
  accessibleName?: string;
}

/** Copies `text`; the label changes to "Copied" for two seconds and is announced politely. If copying fails it says so. */
export function CopyButton({ text, label = "Copy", variant = "secondary", accessibleName }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const ok = await writeClipboard(text);
    setState(ok ? "done" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <Button variant={variant} onClick={copy} aria-label={state === "idle" ? accessibleName : undefined}>
        {state === "done" ? "Copied" : state === "failed" ? "Copy nahi hua" : label}
      </Button>
      <span className="visually-hidden" role="status">
        {state === "done" ? "Copied" : state === "failed" ? "Could not copy. Select the text and copy it by hand." : ""}
      </span>
    </>
  );
}
