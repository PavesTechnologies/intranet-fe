import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, ShieldAlert } from "lucide-react";
import { getNavBadges } from "../services/dashboardService";

// Live cross-campaign counts, refreshed every 60s without a
// page reload. A zero count hides its badge rather than rendering "0".
const REFRESH_MS = 60000;

const BADGES = [
  { key: "fraud_review", label: "Fraud Review", icon: ShieldAlert,
    to: "/ai-screening/campaigns", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  { key: "ai_failures", label: "AI Failures", icon: AlertOctagon,
    to: "/ai-screening/campaigns", tone: "bg-amber-50 text-amber-700 border-amber-200" },
];

export default function NavBadges() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getNavBadges();
        if (!cancelled) setCounts(data);
      } catch {
        // Badges are ambient information — a failure must never surface an
        // error here, it just leaves the previous counts in place.
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const visible = BADGES.filter((b) => (counts?.[b.key] ?? 0) > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((b) => (
        <Link
          key={b.key}
          to={b.to}
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition hover:shadow-sm ${b.tone}`}
        >
          <b.icon className="h-3.5 w-3.5" />
          {b.label}
          <span className="tabular-nums">{counts[b.key]}</span>
        </Link>
      ))}
    </div>
  );
}
