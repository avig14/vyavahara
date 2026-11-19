"use client";

import { ErrorState, PageHeader, SkeletonBlock, SkeletonLine } from "@/components/ui";
import { useApi } from "@/lib/ui/api";
import { SettingsEditor, type SettingsPayload } from "./settings-editor";

/** The form's shape while it loads: the index, then sections of ruled rows with a label side and a control side. */
function SettingsSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Loading settings</span>
      <div className="st" aria-hidden="true">
        <div className="st-index st-index-skel">
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonLine key={i} width={`${58 + ((i * 17) % 34)}%`} />
          ))}
        </div>
        <div className="st-form">
          {[5, 4].map((rows, s) => (
            <div key={s} className="st-sec">
              <SkeletonLine width="9rem" className="st-skel-h" />
              <SkeletonLine width="22rem" />
              <div className="st-rows">
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="st-row">
                    <div className="st-main">
                      <SkeletonLine width={`${40 + ((r * 13) % 25)}%`} />
                      <SkeletonLine width={`${70 + ((r * 7) % 25)}%`} />
                    </div>
                    <div className="st-side">
                      <SkeletonBlock height="2.25rem" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Settings screen: loading skeleton, error with retry, then the editor. There is no empty state: the API always returns every setting. */
export function SettingsScreen() {
  const { data, error, loading, refetch } = useApi<SettingsPayload>("/api/settings");

  if (!data && error) {
    return (
      <>
        <PageHeader title="Settings" hindi="सेटिंग" />
        <ErrorState title="Could not load your settings" error={error} onRetry={refetch} retrying={loading} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Settings" hindi="सेटिंग" description="Loading your thresholds." />
        <SettingsSkeleton />
      </>
    );
  }
  return <SettingsEditor initial={data} />;
}
