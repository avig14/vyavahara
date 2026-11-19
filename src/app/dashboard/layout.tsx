import { Suspense } from "react";
import { Shell } from "@/components/shell/shell";
import { SkeletonBlock } from "@/components/ui/skeleton";
import { ToastProvider } from "@/components/ui/toast";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <ToastProvider>
      <Shell>
        <Suspense fallback={<SkeletonBlock height="12rem" />}>{children}</Suspense>
      </Shell>
    </ToastProvider>
  );
}
