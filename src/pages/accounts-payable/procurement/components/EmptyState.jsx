/**
 * Shared empty-state block for the procurement tabs/detail pages — keeps "nothing here yet"
 * messaging (and its optional primary action) visually consistent, and lets a stage distinguish
 * *why* a list is empty (e.g. "no RFQ created yet" vs. "no quotations yet") instead of a single
 * generic message covering both.
 * @param {{ title: string, description?: string, action?: React.ReactNode }} props
 */
export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
