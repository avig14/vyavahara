"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { MenuIcon } from "@/components/ui/icons";
import { SkeletonLine } from "@/components/ui/skeleton";
import { useMerchant } from "@/lib/ui/merchant";
import { PeriodPicker } from "./period-picker";

export interface TopbarProps {
  chatOpen: boolean;
  onToggleChat: () => void;
  onOpenMenu: () => void;
}

function ShopName() {
  const merchant = useMerchant();
  return merchant ? <span className="shop-name">{merchant.name}</span> : <SkeletonLine width="10rem" />;
}

export function Topbar({ chatOpen, onToggleChat, onOpenMenu }: TopbarProps) {
  return (
    <header className="topbar">
      <IconButton label="Open menu" className="topbar-menu" onClick={onOpenMenu}>
        <MenuIcon size={20} />
      </IconButton>
      <div className="topbar-shop">
        <Suspense fallback={<SkeletonLine width="10rem" />}>
          <ShopName />
        </Suspense>
      </div>
      <div className="topbar-period">
        <Suspense fallback={<SkeletonLine width="8rem" />}>
          <PeriodPicker />
        </Suspense>
      </div>
      <Button className="topbar-chat" aria-expanded={chatOpen} aria-controls="saathi-panel" onClick={onToggleChat}>
        Saathi <span className="deva" lang="hi">साथी</span>
      </Button>
    </header>
  );
}
