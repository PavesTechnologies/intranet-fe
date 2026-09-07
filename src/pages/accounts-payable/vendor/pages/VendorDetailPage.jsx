import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";

import PageHeader from "../../../../components/ui/PageHeader";
import Breadcrumb from "../../../../components/Breadcrumb/Breadcrumb";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import StatusBadge from "../../../../components/status/statusbadge";
import Button from "../../../../components/Button/Button";
import ConfirmationModal from "../../../../components/confirmation_modal/ConfirmationModal";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import { Fonts } from "../../../../components/Fonts/Fonts";

import { toast } from "react-toastify";

import { getApiErrorMessage } from "../../utils/apiError";
import { formatDate } from "../../utils/formatters";
import { useApPermissions } from "../../hooks/useApPermissions";
import useApLookups from "../../hooks/useApLookups";
import useVendorDetail from "../hooks/useVendorDetail";
import { useUpdateVendorStatus } from "../hooks/useVendorMutations";
import { AP_ROUTES } from "../../constants/routes";

import VendorAddressList from "../components/VendorAddressList";
import VendorBankList from "../components/VendorBankList";
import VendorTaxTab from "../components/VendorTaxTab";
import VendorPoTab from "../components/VendorPoTab";
import VendorGrnTab from "../components/VendorGrnTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "addresses", label: "Addresses" },
  { id: "banks", label: "Bank Accounts" },
  { id: "tax", label: "Tax" },
  { id: "po", label: "PO" },
  { id: "grn", label: "GRN" },
];

const DetailRow = ({ label, value }) => (
  <div className="flex flex-col gap-1 border-b border-gray-100 py-2 last:border-0">
    <span className={Fonts.label}>{label}</span>
    <span className="text-sm text-gray-800">
      {value || "—"}
    </span>
  </div>
);

/**
 * Route:
 * /accounts-payable/vendors/:vendorId
 */
export default function VendorDetailPage() {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const { canEditVendor } = useApPermissions();

  const [activeTab, setActiveTab] =
    useState("overview");

  const [confirmStatusChange, setConfirmStatusChange] =
    useState(null);

  const {
    vendor,
    addresses,
    banks,
    isLoading,
    isError,
    error,
  } = useVendorDetail(vendorId);

  const {
    countries,
    currencies,
    paymentTerms,
    vendorStatuses,
  } = useApLookups();

  const updateStatusMutation =
    useUpdateVendorStatus(vendorId);

  const countryName = countries.find(
    (c) =>
      c.country_id === vendor?.country_id
  )?.country_name;

  const currencyName = currencies.find(
    (c) =>
      c.currency_id === vendor?.currency_id
  )?.currency_name;

  const paymentTermName = paymentTerms.find(
    (p) =>
      p.payment_term_id ===
      vendor?.payment_term_id
  )?.term_name;

  const status = vendorStatuses.find(
    (s) =>
      s.status_id === vendor?.status_id
  );

  const isActive =
    status?.status_code === "ACTIVE";

  const handleConfirmStatusChange =
    async () => {
      try {
        await updateStatusMutation.mutateAsync(
          confirmStatusChange === "activate"
        );

        toast.success(
          confirmStatusChange === "activate"
            ? "Vendor activated."
            : "Vendor deactivated."
        );

        setConfirmStatusChange(null);
      } catch (err) {
        toast.error(
          getApiErrorMessage(
            err,
            "Failed to update vendor status."
          )
        );
      }
    };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner
          text="Loading vendor..."
          size="lg"
        />
      </div>
    );
  }

  if (isError || !vendor) {
    return (
      <div className="p-6">
        <PageHeader title="Vendor Details" />

        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-gray-700">
            {error?.status === 404
              ? "Vendor not found"
              : "Something went wrong"}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {error?.status === 404
              ? "This vendor doesn't exist or may have been removed."
              : getApiErrorMessage(
                  error,
                  "Unable to load this vendor right now."
                )}
          </p>

          <Button
            variant="outline"
            className="mt-4"
            onClick={() =>
              navigate(
                AP_ROUTES.VENDOR_LIST
              )
            }
          >
            Back to Vendors
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          {
            label: "Vendors",
            to: AP_ROUTES.VENDOR_LIST,
          },
          {
            label: vendor.vendor_name,
          },
        ]}
      />

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {vendor.vendor_name}

            {status && (
              <StatusBadge
                label={status.status_name}
                size="md"
              />
            )}
          </span>
        }
        subtitle={`${vendor.vendor_code || "No code"} — Vendor #${vendor.vendor_id}`}
        actions={
          canEditVendor ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    AP_ROUTES.VENDOR_UPDATE(
                      vendorId
                    )
                  )
                }
              >
                <Pencil className="h-4 w-4" />
                Edit Vendor
              </Button>

              <Button
                variant={
                  isActive
                    ? "danger"
                    : "success"
                }
                onClick={() =>
                  setConfirmStatusChange(
                    isActive
                      ? "deactivate"
                      : "activate"
                  )
                }
              >
                {isActive
                  ? "Deactivate"
                  : "Activate"}
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex gap-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              setActiveTab(tab.id)
            }
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
        {activeTab === "overview" && (
          <PageCard>
            <PageCardContent>
              <div className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
                <DetailRow
                  label="Vendor Code"
                  value={vendor.vendor_code}
                />

                <DetailRow
                  label="Country"
                  value={countryName}
                />

                <DetailRow
                  label="Payment Term"
                  value={paymentTermName}
                />

                <DetailRow
                  label="Currency"
                  value={currencyName}
                />

                <DetailRow
                  label="PAN Number"
                  value={vendor.pan_number}
                />

                <DetailRow
                  label="Phone Number"
                  value={vendor.phone_number}
                />

                <DetailRow
                  label="Email"
                  value={vendor.email}
                />

                <DetailRow
                  label="Created"
                  value={formatDate(
                    vendor.created_at
                  )}
                />

                <DetailRow
                  label="Last Updated"
                  value={formatDate(
                    vendor.updated_at
                  )}
                />
              </div>
            </PageCardContent>
          </PageCard>
        )}

        {activeTab === "addresses" && (
          <VendorAddressList
            vendorId={vendorId}
            addresses={addresses}
          />
        )}

        {activeTab === "banks" && (
          <VendorBankList
            vendorId={vendorId}
            banks={banks}
          />
        )}

        {activeTab === "tax" && (
          <VendorTaxTab
            vendorId={vendorId}
            addresses={addresses}
            onGoToAddresses={() =>
              setActiveTab("addresses")
            }
          />
        )}

        {activeTab === "po" && (
          <VendorPoTab
            vendorId={vendorId}
            poId={vendorId}
            vendorName={vendor.vendor_name}
          />
        )}

        {activeTab === "grn" && (
          <VendorGrnTab
            vendorId={vendorId}
            vendorName={vendor.vendor_name}
          />
        )}
      </div>

      <ConfirmationModal
        isOpen={!!confirmStatusChange}
        title={
          confirmStatusChange ===
          "activate"
            ? "Activate Vendor"
            : "Deactivate Vendor"
        }
        message={
          confirmStatusChange ===
          "activate"
            ? "This will mark the vendor as active. Continue?"
            : "This will mark the vendor as inactive. Continue?"
        }
        confirmText={
          confirmStatusChange ===
          "activate"
            ? "Activate"
            : "Deactivate"
        }
        variant={
          confirmStatusChange ===
          "activate"
            ? "success"
            : "danger"
        }
        isLoading={
          updateStatusMutation.isPending
        }
        onConfirm={
          handleConfirmStatusChange
        }
        onCancel={() =>
          setConfirmStatusChange(null)
        }
      />
    </div>
  );
}