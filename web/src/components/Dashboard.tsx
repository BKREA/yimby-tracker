"use client";

import { useState } from "react";
import { RunButtons } from "./RunButtons";
import { RunsTable } from "./RunsTable";
import { SheetPreview } from "./SheetPreview";

export default function Dashboard() {
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh((n) => n + 1);

  return (
    <div className="grid gap-6">
      <RunButtons onDispatched={bump} />
      <RunsTable refreshSignal={refresh} />
      <SheetPreview refreshSignal={refresh} />
    </div>
  );
}
