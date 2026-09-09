import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, XCircle } from "lucide-react";
import { candidateJson } from "../../service/resumeIntake";
import { extractErrorMessage } from "./utils/intakeUtils.jsx";
import ReviewScreen from "./components/ReviewScreen";

export default function ReviewPage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rowResume = location.state?.resume || null;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchParsedJson = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await candidateJson(candidateId);
        if (cancelled) return;
        setData(res?.data || null);
      } catch (err) {
        if (cancelled) return;
        setError(extractErrorMessage(err, "Failed to load the extracted resume data."));
        setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchParsedJson();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const parsedJson = data?.parsed_json || null;

  const resume = {
    resume_id: data?.resume_id || rowResume?.id,
    candidate_id: data?.candidate_id || candidateId,
    candidate_name: parsedJson?.full_name || rowResume?.candidate_full_name,
    candidate_email_masked: parsedJson?.email || rowResume?.candidate_email,
    parse_status: data?.parse_status || rowResume?.parse_status,
    file_format: rowResume?.file_format,
    version_number: rowResume?.version_number,
    is_active_version: rowResume?.is_active_version,
  };

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate("/ai-screening/resume-intake")}
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Candidate Resume Review</h1>
          <p className="text-xs text-slate-500 mt-1">Parsed data extracted from the candidate's uploaded resume.</p>
        </div>
      </div>

      {isLoading && (
        <div className="max-w-5xl rounded-xl border border-slate-200 bg-white shadow-sm p-10 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Loading extracted resume data...
        </div>
      )}

      {!isLoading && error && (
        <div className="max-w-5xl rounded-xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-3">
          <XCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-rose-700">{error}</div>
        </div>
      )}

      {!isLoading && !error && (
        <ReviewScreen resume={resume} parsedJson={parsedJson} candidateSkills={[]} processingStatus={null} />
      )}
    </div>
  );
}
