import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import useIntakeFlow from "./hooks/useIntakeFlow";
import UploadStep from "./components/UploadStep";
import ProcessingStep from "./components/ProcessingStep";
import ReviewScreen from "./components/ReviewScreen";

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "processing", label: "Processing" },
  { key: "review", label: "Review" },
];

function stepIndex(step) {
  return STEPS.findIndex((s) => s.key === step);
}

export default function IntakeFlowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    step,
    resume,
    status,
    statusError,
    parsedJson,
    candidateSkills,
    submit,
    loadExistingResume,
    goToReview,
    retryStatusCheck,
    reset,
  } = useIntakeFlow();
  const activeIndex = stepIndex(step);
  const consumedUploadResult = useRef(false);

  // When arriving from the "New Structured Intake" modal or the "In Processing" tab,
  // load the resume and skip straight to processing/review instead of showing Upload form.
  useEffect(() => {
    const uploadResult = location.state?.uploadResult;
    const existingResume = location.state?.existingResume;

    if (!consumedUploadResult.current) {
      if (existingResume) {
        consumedUploadResult.current = true;
        loadExistingResume(existingResume);
        navigate(location.pathname, { replace: true, state: null });
      } else if (uploadResult) {
        consumedUploadResult.current = true;
        submit(uploadResult);
        navigate(location.pathname, { replace: true, state: null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/ai-screening/resume-intake")}
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">New Resume Intake</h1>
            <p className="text-xs text-slate-500 mt-1">Upload a resume, watch it parse, then review the extracted data.</p>
          </div>
        </div>

        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const isDone = i < activeIndex || step === "review";
            const isActive = i === activeIndex && step !== "review" ? true : i === activeIndex;
            const done = i < activeIndex;
            return (
              <li key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${
                    done ? "bg-emerald-50 text-emerald-700" : i === activeIndex ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Check size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />}
                  {s.label}
                </div>
                {i !== STEPS.length - 1 && <div className="w-4 h-px bg-slate-300" />}
              </li>
            );
          })}
        </ol>
      </div>

      {step === "upload" && !location.state?.uploadResult && <UploadStep onSubmit={submit} />}
      {step === "processing" && resume && status && (
        <ProcessingStep
          resume={resume}
          status={status}
          statusError={statusError}
          onComplete={goToReview}
          onRetryStatusCheck={retryStatusCheck}
          onBackToUpload={reset}
        />
      )}
      {step === "review" && (
        <ReviewScreen resume={resume} parsedJson={parsedJson} candidateSkills={candidateSkills} processingStatus={status} />
      )}
    </div>
  );
}
