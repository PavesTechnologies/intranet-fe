import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { getOverrideReport } from "../../campaigns/services/campaignservice";

// Campaigns whose override rate crossed OVERRIDE_RATE_ALERT_THRESHOLD. The
// rate and the flag are computed server-side, so this and the report can never
// disagree. Renders nothing when nothing is wrong.
export default function OverrideRateAlerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const report = await getOverrideReport();
        if (cancelled) return;
        setAlerts((report?.campaign_alerts || []).filter((a) => a.override_alert));
      } catch {
        // HR_ADMIN-only endpoint; a recruiter simply sees no panel.
        if (!cancelled) setAlerts([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-1">
        <AlertTriangle className="h-4 w-4" />
        High override rate
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
          {alerts.length}
        </span>
      </h2>
      <p className="text-[11px] text-amber-800 mb-3">
        A high share of rejections being overridden usually means the campaign's thresholds or
        mandatory skills are too strict for the candidates actually applying.
      </p>
      <div className="space-y-1.5">
        {alerts.map((a) => (
          <Link
            key={a.campaign_id}
            to={`/ai-screening/campaigns/${a.campaign_id}`}
            className="flex items-center justify-between gap-3 bg-white border border-amber-100 rounded-lg px-3 py-2 hover:border-amber-300 transition"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{a.campaign_name}</p>
              {a.recommendation && (
                <p className="text-[10px] text-slate-500 truncate">{a.recommendation}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-amber-700 tabular-nums">
                {Number(a.override_rate).toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400">
                {a.override_count} of {a.rejected_count} rejections
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
