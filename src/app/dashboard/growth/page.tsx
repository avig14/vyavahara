import type { Metadata } from "next";
import { GrowthView } from "@/components/growth/growth-view";

export const metadata: Metadata = { title: "Growth" };

export default function GrowthPage() {
  return <GrowthView />;
}
