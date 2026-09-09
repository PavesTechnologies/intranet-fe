import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getAllCampaignsHrAdmin,
    getCampaignsByHiringManager,
    getAllCampaigns,
    formatApiError,
} from "../../campaigns/services/campaignservice";
import useCampaignPermissions from "../../campaigns/hooks/useCampaignPermissions";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import StateMessage from "./StateMessage";

const STATUS_BADGE = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    PAUSED: "bg-amber-50 text-amber-700",
    CLOSED: "bg-slate-100 text-slate-600",
    DRAFT: "bg-slate-100 text-slate-700",
};

const statusLabel = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—");

export default function ActiveCampaignsCard() {
    const navigate = useNavigate();
    const { isHRAdmin, isHiringManager } = useCampaignPermissions();
    const [campaigns, setCampaigns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [errorDetail, setErrorDetail] = useState("");

    // The list endpoint is role-scoped on the backend (mirrors Campaigns.jsx):
    // HR_ADMIN's own hr_admin endpoint returns { items: [...] } (paginated),
    // while hiring_manager/all return a bare CampaignResponse[] in `data`.
    const load = useCallback(async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            let list;
            if (isHRAdmin) {
                const res = await getAllCampaignsHrAdmin({ show_closed: false, page: 1 });
                list = res?.data?.items || [];
            } else if (isHiringManager) {
                const res = await getCampaignsByHiringManager({ show_closed: false });
                list = res?.data || [];
            } else {
                const res = await getAllCampaigns({ show_closed: false });
                list = res?.data || [];
            }
            setCampaigns(list.filter((c) => (c.status || "").toUpperCase() === "ACTIVE").slice(0, 4));
        } catch (error) {
            setHasError(true);
            setCampaigns([]);
            const status = error?.response?.status;
            setErrorDetail(`${status ? `${status}: ` : ""}${formatApiError(error, "Unknown error")}`);
        } finally {
            setIsLoading(false);
        }
    }, [isHRAdmin, isHiringManager]);

    useEffect(() => { load(); }, [load]);

    return (
        <PageCard className="h-full">
        <PageCardContent>
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-900">Active campaigns</h3>
                <button
                    onClick={() => navigate("/ai-screening/campaigns")}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                    View all
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-11 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : hasError ? (
                <StateMessage variant="error" title="Couldn't load active campaigns." detail={errorDetail} onRetry={load} />
            ) : campaigns.length === 0 ? (
                <StateMessage variant="empty" title="No active campaigns." />
            ) : (
                <div className="space-y-2">
                    {campaigns.map((c) => {
                        const status = (c.status || "").toUpperCase();
                        return (
                            <div
                                key={c.id}
                                onClick={() => navigate(`/ai-screening/campaigns/${c.id}`)}
                                className="flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 rounded-lg px-3.5 py-2.5 cursor-pointer transition"
                            >
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                        {c.candidate_count ?? 0} candidates
                                        {c.hiring_manager ? ` · ${c.hiring_manager}` : ""}
                                    </p>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${STATUS_BADGE[status] || "bg-slate-50 text-slate-600"}`}>
                                    {statusLabel(status)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </PageCardContent>
        </PageCard>
    );
}
