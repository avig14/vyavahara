import type { Metadata } from "next";
import { CallsView } from "@/components/calls/calls-view";

export const metadata: Metadata = { title: "Call Saathi" };

export default function CallsPage() {
  return <CallsView />;
}
