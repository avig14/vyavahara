import type { Metadata } from "next";
import { KhataView } from "@/components/khata/khata-view";

export const metadata: Metadata = { title: "Khata" };

export default function KhataPage() {
  return <KhataView />;
}
