// Maps a backend billing_type_master name to the label shown in the UI.
// The backend/master-data record name ("Timesheet Based") and its
// billingTypeId are never changed — this only affects what users see.
const BILLING_TYPE_DISPLAY_NAME_OVERRIDES = {
  "Timesheet Based": "Time & Material",
};

export function getBillingTypeDisplayName(billingTypeName) {
  if (!billingTypeName) return billingTypeName;
  return BILLING_TYPE_DISPLAY_NAME_OVERRIDES[billingTypeName] || billingTypeName;
}
