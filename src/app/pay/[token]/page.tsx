import { PayView } from "@/components/pay/pay-view";

export default async function PayPage({ params }: PageProps<"/pay/[token]">) {
  const { token } = await params;
  return <PayView token={token} />;
}
