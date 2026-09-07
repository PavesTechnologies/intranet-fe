import React from "react";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { Inbox } from "lucide-react";

/**
 * AR-scoped table presentation. Mirrors the shared GenericTable's
 * { headers, columns, rows, loading } interface so it's a drop-in
 * replacement inside the AR module only — GenericTable itself is
 * shared by dozens of other modules and isn't touched.
 */
const ARTable = ({
  headers = [],
  rows = [],
  columns = [],
  alignments = {},
  loading = false,
  emptyMessage = "No records found.",
}) => {
  const hasData = rows.length > 0;

  const getAlignmentClass = (colOrHeader, idx) => {
    if (alignments) {
      if (alignments[colOrHeader] === "left") return "text-left";
      if (alignments[colOrHeader] === "center") return "text-center";
      if (alignments[colOrHeader] === "right") return "text-right";

      const colKey = columns[idx];
      if (colKey && alignments[colKey] === "left") return "text-left";
      if (colKey && alignments[colKey] === "center") return "text-center";
      if (colKey && alignments[colKey] === "right") return "text-right";

      const headerKey = headers[idx];
      if (headerKey && alignments[headerKey] === "left") return "text-left";
      if (headerKey && alignments[headerKey] === "center") return "text-center";
      if (headerKey && alignments[headerKey] === "right") return "text-right";

      if (alignments[idx] === "left") return "text-left";
      if (alignments[idx] === "center") return "text-center";
      if (alignments[idx] === "right") return "text-right";
    }

    const name = String(columns[idx] || headers[idx] || colOrHeader || "").toLowerCase();
    if (name === "client" || name === "project") {
      return "text-left";
    }

    return idx === 0 ? "text-left" : "text-center";
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      {loading ? (
        <LoadingSpinner text="Loading data..." />
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Inbox className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {headers.map((header, idx) => (
                  <th
                    key={idx}
                    className={`px-4 py-3 font-semibold text-slate-600 ${getAlignmentClass(header, idx)}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={row.onRowClick}
                  className={`transition-colors ${row.rowClass || ""} hover:bg-slate-50 ${row.onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-4 py-3 align-middle text-slate-700 ${getAlignmentClass(col, colIndex)}`}
                    >
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ARTable;
