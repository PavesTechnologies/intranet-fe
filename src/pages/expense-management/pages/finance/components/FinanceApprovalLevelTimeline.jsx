import React from "react";
import { CheckCircle2, XCircle, Circle, Clock } from "lucide-react";
import { useFinanceStatus, useFinanceReviews } from "../hooks/useFinanceVerification";
import { useEmployeeDirectory, resolveEmployeeName } from "../../../approval-engine/hooks/useEmployeeDirectory";
import { formatDateTime } from "../../../approval-engine/constants/approvalLabels";

const NODE_META = {
  done: { Icon: CheckCircle2, dot: "bg-emerald-500 text-white", line: "bg-emerald-200", title: "text-emerald-800" },
  current: { Icon: Clock, dot: "bg-[#0A0082] text-white ring-4 ring-[#0A0082]/15", line: "bg-gray-200", title: "text-[#0A0082]" },
  rejected: { Icon: XCircle, dot: "bg-rose-600 text-white", line: "bg-gray-200", title: "text-rose-700" },
  skipped: { Icon: Circle, dot: "bg-gray-200 text-gray-400", line: "bg-gray-200", title: "text-gray-400" },
  upcoming: { Icon: Circle, dot: "bg-gray-200 text-gray-400", line: "bg-gray-200", title: "text-gray-400" },
};

function TimelineNode({ title, subtitle, state, isLast }) {
  const meta = NODE_META[state] || NODE_META.upcoming;
  const { Icon } = meta;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.dot}`}>
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && <div className={`mt-1 w-px flex-1 ${meta.line}`} />}
      </div>
      <div className="flex-1 pb-5">
        <p className={`text-sm font-semibold ${meta.title}`}>{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
    </li>
  );
}

export default function FinanceApprovalLevelTimeline({ reportId, reportStatus }) {
  const { data: status, isLoading } = useFinanceStatus(reportId);
  const { data: reviews } = useFinanceReviews(reportId);
  const { data: directory } = useEmployeeDirectory();

  const isApproved = reportStatus === "APPROVED";
  const isRejected = reportStatus === "REJECTED";
  const totalLevels = status?.totalLevels || 0;
  const currentLevelOrder = status?.currentLevelOrder;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!totalLevels && !isApproved && !isRejected) {
    return <p className="text-sm text-gray-400">No verification progress to show yet.</p>;
  }

  const reviewsByLevel = new Map();
  (reviews || []).forEach((r) => {
    const list = reviewsByLevel.get(r.levelOrder) || [];
    list.push(r);
    reviewsByLevel.set(r.levelOrder, list);
  });

  const levelNodes = Array.from({ length: totalLevels }, (_, i) => i + 1).map((levelOrder) => {
    const levelReviews = (reviewsByLevel.get(levelOrder) || []).slice().sort((a, b) => new Date(b.actionedAt || 0) - new Date(a.actionedAt || 0));
    const latest = levelReviews[0];
    let displayName =
      latest?.displayName || latest?.levelName || (levelOrder === currentLevelOrder ? status?.currentLevelDisplayName : null) || `Level ${levelOrder}`;

    if (displayName) {
      const clean = displayName.trim().toLowerCase();
      if (clean === "level 2") {
        displayName = "Finance";
      } else if (clean === "manager review") {
        displayName = "Manager";
      }
    }

    let state = "upcoming";
    if (isApproved) state = "done";
    else if (isRejected) state = levelOrder < currentLevelOrder ? "done" : levelOrder === currentLevelOrder ? "rejected" : "skipped";
    else if (currentLevelOrder != null) {
      if (levelOrder < currentLevelOrder) state = "done";
      else if (levelOrder === currentLevelOrder) state = "current";
    }

    let subtitle = null;
    if (latest) {
      const actor = resolveEmployeeName(directory, latest.actedBy);
      const cleanActor = actor?.trim();
      const hasActor = cleanActor && !/^[-—–_]+$/.test(cleanActor);
      const formattedDate = latest.actionedAt ? formatDateTime(latest.actionedAt) : null;
      const countNote = levelReviews.length > 1 ? ` (${levelReviews.length} item${levelReviews.length > 1 ? "s" : ""})` : "";

      if (hasActor && formattedDate) {
        subtitle = `${cleanActor} · ${formattedDate}${countNote}`;
      } else if (hasActor) {
        subtitle = `${cleanActor}${countNote}`;
      } else if (formattedDate) {
        subtitle = `${formattedDate}${countNote}`;
      } else {
        subtitle = countNote || null;
      }
    } else if (state === "current") {
      subtitle = "Awaiting decision";
    } else if (state === "upcoming" || state === "skipped") {
      subtitle = "Not reached";
    }

    return { levelOrder, displayName, state, subtitle };
  });

  const finalNode =
    isApproved || isRejected
      ? { title: isApproved ? "Approved" : "Rejected", state: isApproved ? "done" : "rejected" }
      : null;

  return (
    <ul>
      {levelNodes.map((n, idx) => (
        <TimelineNode
          key={n.levelOrder}
          title={n.displayName}
          subtitle={n.subtitle}
          state={n.state}
          isLast={!finalNode && idx === levelNodes.length - 1}
        />
      ))}
      {finalNode && <TimelineNode title={finalNode.title} state={finalNode.state} isLast />}
    </ul>
  );
}
