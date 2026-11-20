"use client";

import { Suspense } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { MenuIcon } from "@/components/ui/icons";
import { SkeletonLine } from "@/components/ui/skeleton";
import { useMerchant } from "@/lib/ui/merchant";
import { LangToggle, useL } from "@/lib/ui/lang";
import { PeriodPicker } from "./period-picker";

export interface TopbarProps {
  onOpenMenu: () => void;
}

function ShopName() {
  const merchant = useMerchant();
  return merchant ? (
    <span className="shop-name">{merchant.name}</span>
  ) : (
    <SkeletonLine width="10rem" />
  );
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  const l = useL();
  return (
    <header className="topbar">
      <IconButton
        label={l("Open menu", "मेन्यू खोलें", "Menu kholo")}
        className="topbar-menu"
        onClick={onOpenMenu}
      >
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
      <div className="topbar-lang">
        <LangToggle />
      </div>
    </header>
  );
}
