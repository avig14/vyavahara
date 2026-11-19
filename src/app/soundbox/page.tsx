import type { Metadata } from "next";
import { SoundboxView } from "@/components/soundbox/soundbox-view";

export const metadata: Metadata = { title: "Soundbox counter" };

export default function SoundboxPage() {
  return <SoundboxView />;
}
