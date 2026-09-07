import { Calculator } from "lucide-react";

const fmt = (value, currency) =>
  `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Pre-tax commercial value only — the authoritative taxable/grand total
// figures live on the Tax Calculation result once the snapshot is taxed.
export default function CommercialCalculationCard({
  laborAmount = 0,
  expenseAmount = 0,
  adjustments = 0,
  currency = "USD",
}) {
  const subtotal = Number(laborAmount) + Number(adjustments);
  const taxableAmount = subtotal + Number(expenseAmount);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
        <Calculator className="h-4 w-4 text-indigo-600" /> Commercial Value
      </span>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="font-mono font-semibold text-slate-800">{fmt(subtotal, currency)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Expenses</span>
          <span className="font-mono font-semibold text-slate-800">{fmt(expenseAmount, currency)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
          <span>Taxable Amount</span>
          <span className="font-mono text-base text-indigo-900">{fmt(taxableAmount, currency)}</span>
        </div>
      </div>
    </div>
  );
}
