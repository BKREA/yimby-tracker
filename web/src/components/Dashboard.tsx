"use client";

import { useState } from "react";
import { RunButtons } from "./RunButtons";
import { RunsTable } from "./RunsTable";
import { ArticlesPreview } from "./ArticlesPreview";

export interface DashboardLinks {
  dailyScrape: string;
  backfill: string;
}

export default function Dashboard({ links }: { links: DashboardLinks }) {
  const [refresh] = useState(0);
  return (
    <div className="grid gap-6">
      <RunButtons links={links} />
      <RunsTable refreshSignal={refresh} />
      <ArticlesPreview refreshSignal={refresh} />
    </div>
  );
}
