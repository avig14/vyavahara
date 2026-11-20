import type { Metadata } from "next";
import { WhatsappPreview } from "@/components/whatsapp/whatsapp-preview";

export const metadata: Metadata = { title: "WhatsApp preview" };

export default function WhatsappPage() {
  return <WhatsappPreview />;
}
