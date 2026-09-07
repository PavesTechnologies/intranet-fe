import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../../../components/ui/PageHeader";
import { useApPermissions } from "../../hooks/useApPermissions";
import PrRequestTab from "../components/PrRequestTab";
import PrApprovalsTab from "../components/PrApprovalsTab";
import QuotationTab from "../components/QuotationTab";
import VendorSelectionTab from "../components/VendorSelectionTab";
import PurchaseOrdersTab from "../components/PurchaseOrdersTab";

export default function ProcurementPage() {
  const { canViewPR, canViewPRApprovals, canViewQuotation, canViewVendorSelection, canViewPO } =
    useApPermissions();
  const [searchParams] = useSearchParams();

  // Each tab requires its own single UMS permission (PR_VIEW / PR_APPROVAL_VIEW /
  // QUOTATION_VIEW / VENDOR_SELECTION_VIEW / PO_VIEW) — a user only sees the tabs their
  // permissions actually grant, never all five just because they reached this route.
  const TABS = [
    canViewPR && { id: "prRequest", label: "PR Request" },
    canViewPRApprovals && { id: "prApprovals", label: "PR Approvals" },
    canViewQuotation && { id: "quotation", label: "RFQ & Quotations" },
    canViewVendorSelection && { id: "vendorSelection", label: "Vendor Selection" },
    canViewPO && { id: "purchaseOrders", label: "Purchase Orders" },
  ].filter(Boolean);

  const tabIds = TABS.map((tab) => tab.id);

  // Supports deep links from PR Detail (e.g. "?tab=quotation&prId=123") — the target tab
  // itself reads prId back out of the query string to pre-select that requisition.
  const requestedTab = searchParams.get("tab");
  const initialTab = tabIds.includes(requestedTab) ? requestedTab : TABS[0]?.id;
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="p-6">
      <PageHeader
        title="Procurement"
        subtitle="Raise purchase requisitions, obtain approvals, collect quotations, select vendors, and generate purchase orders."
      />

      {TABS.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          You don't have access to any Procurement section. Contact your administrator if you
          believe this is incorrect.
        </div>
      ) : (
        <>
          <div className="flex gap-6 border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm transition ${
                  activeTab === tab.id
                    ? "border-b-2 border-[#0A0082] font-semibold text-[#0A0082]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {activeTab === "prRequest" && canViewPR && <PrRequestTab />}
            {activeTab === "prApprovals" && canViewPRApprovals && <PrApprovalsTab />}
            {activeTab === "quotation" && canViewQuotation && <QuotationTab />}
            {activeTab === "vendorSelection" && canViewVendorSelection && <VendorSelectionTab />}
            {activeTab === "purchaseOrders" && canViewPO && <PurchaseOrdersTab />}
          </div>
        </>
      )}
    </div>
  );
}
