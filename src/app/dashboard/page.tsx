import type { Metadata } from "next";
import { OverviewScreen } from "@/components/overview/overview-screen";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <OverviewScreen />;
}
