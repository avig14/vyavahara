import type { Metadata } from "next";
import { VoiceStudio } from "@/components/soundbox/studio";

export const metadata: Metadata = { title: "Voice Saathi" };

export default function VoiceSaathiPage() {
  return <VoiceStudio />;
}
