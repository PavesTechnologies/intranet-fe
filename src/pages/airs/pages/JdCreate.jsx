import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import JdForm from "./JdForm";

export default function JdCreate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get("edit");

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate("/ai-screening/jds")}
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold">{editId ? "Edit Job Description" : "Create Job Description"}</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <JdForm
          editId={editId}
          onSuccess={() => navigate("/ai-screening/jds")}
          onCancel={() => navigate("/ai-screening/jds")}
        />
      </div>
    </div>
  );
}
