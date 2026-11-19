"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useApi } from "@/lib/ui/api";
import { usePeriod } from "@/lib/ui/period";
import { Alerts } from "./alerts";
import { Headline } from "./headline";
import { Recommendations } from "./recommendations";
import { Rozmel } from "./rozmel";
import { SalesCharts } from "./sales-charts";
import { TopSellers } from "./top-sellers";
import type { OverviewPayload } from "./types";

/** Overview: headline numbers on top, then the rozmel (left) beside what needs action (right). */
export function OverviewScreen() {
  const { apiQuery, label } = usePeriod();
  const overview = useApi<OverviewPayload>(`/api/dashboard/overview?${apiQuery}`);
  const name = overview.data?.merchant.name;

  return (
    <>
      <PageHeader title="Overview" hindi="हिसाब" description={name ? `${name}: ${label}` : label} />
      <div className="ov-top">
        <Headline state={overview} />
      </div>
      <div className="ov-grid">
        <div className="ov-main">
          <div className="ov-o1">
            <Rozmel />
          </div>
          <div className="ov-o4">
            <TopSellers state={overview} />
          </div>
          <div className="ov-o5 ov-charts">
            <SalesCharts state={overview} />
          </div>
        </div>
        <div className="ov-side">
          <div className="ov-o2">
            <Recommendations state={overview} />
          </div>
          <div className="ov-o3">
            <Alerts state={overview} />
          </div>
        </div>
      </div>
    </>
  );
}
