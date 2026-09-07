import { useState } from "react";
import PageHeader from "../../../../components/ui/PageHeader";
import GeneralConfigurationTab from "../components/GeneralConfigurationTab";
import FiscalYearTab from "../components/FiscalYearTab";
import TaxComplianceTab from "../components/TaxComplianceTab";
import StatusMasterTab from "../components/StatusMasterTab";
import TaxTypesTab from "../components/TaxTypesTab";
import TaxRulesTab from "../components/TaxRulesTab";
import ApprovalRulesTab from "../components/ApprovalRulesTab";
import PaymentTermsTab from "../components/PaymentTermsTab";
import DepartmentsAndCategoriesTab from "../components/DepartmentsAndCategoriesTab";

const TABS = [
  { id: "general", label: "General Configuration" },
  { id: "fiscalYear", label: "Fiscal Years" },
  { id: "taxCompliance", label: "Tax & Compliance" },
  { id: "tax", label: "Tax Types" },
  { id: "taxRules", label: "Tax Rules" },
  { id: "approvalRules", label: "Approval Rules" },
  { id: "paymentTerms", label: "Payment Terms" },
  { id: "status", label: "Status Master" },
  { id: "departmentsAndCategories", label: "Departments & Categories" },
];

export default function SystemConfigurationPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  return (
    <div className="p-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage AP master data — general settings, fiscal years, tax compliance, tax rules, approval thresholds, payment terms, and statuses."
      />

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
        {activeTab === "general" && <GeneralConfigurationTab />}
        {activeTab === "fiscalYear" && <FiscalYearTab />}
        {activeTab === "taxCompliance" && <TaxComplianceTab />}
        {activeTab === "status" && <StatusMasterTab />}
        {activeTab === "tax" && <TaxTypesTab />}
        {activeTab === "taxRules" && <TaxRulesTab />}
        {activeTab === "approvalRules" && <ApprovalRulesTab />}
        {activeTab === "paymentTerms" && <PaymentTermsTab />}
        {activeTab === "departmentsAndCategories" && <DepartmentsAndCategoriesTab />}
      </div>
    </div>
  );
}
