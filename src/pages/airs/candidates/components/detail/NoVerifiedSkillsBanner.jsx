import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileSearch, RefreshCw, UploadCloud, UserPlus } from "lucide-react";
import { toast } from "react-toastify";
import Button from "../../../../../components/Button/Button";
import { useAuth } from "../../../../../contexts/AuthContext";
import AddManualSkillModal from "./AddManualSkillModal";

// M07-E01/S04 — Zero Verified Skills Handling. Deliberately distinct from
// the generic "Missing Mandatory Skills" warning in HierarchyMatchResults:
// this is a full-width, higher-severity banner for the total-failure case
// (score_breakdown.NO_VERIFIED_SKILLS), not a reuse of the normal low-score
// treatment.
//
// View Parse Confidence / Re-Parse Resume / Upload Replacement Resume all
// route to the existing Resume Intake screen — the only place those actions
// genuinely exist today. There is no candidate↔resume-file link in the data
// model, so a deeper in-place action isn't available without inventing one.
export default function NoVerifiedSkillsBanner({ candidate, onAddManualSkill }) {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

  if (!candidate?.scoreBreakdown?.noVerifiedSkills) return null;

  const canAddManually = hasRole(["HR_ADMIN"]);

  const goToResumeIntake = (message) => {
    toast.info(message);
    navigate("/ai-screening/resume-intake");
  };

  const excludeSkillNames = [
    ...(candidate.matchedSkills || []),
    ...(candidate.manualSkills || []).map((s) => s.canonicalName),
  ];

  return (
    <>
      <div className="w-full rounded-xl border-2 border-rose-300 bg-rose-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-rose-900">No Verified Skills Detected</div>
            <p className="text-[12.5px] text-rose-700 mt-1">No skills could be verified for this candidate.</p>

            <p className="text-[12px] text-rose-600 mt-2">This may be due to:</p>
            <ul className="text-[12px] text-rose-600 list-disc pl-5 mt-1 space-y-0.5">
              <li>Very short resume</li>
              <li>Unrecognized skill terminology</li>
              <li>Incomplete parse</li>
            </ul>

            <p className="text-[12.5px] font-semibold text-rose-800 mt-2">The requirements score is 0 as a result.</p>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant="outline"
                size="small"
                onClick={() => goToResumeIntake("Opening Resume Intake to review this candidate's parse confidence.")}
              >
                <FileSearch className="h-4 w-4 mr-1.5" /> View Parse Confidence
              </Button>
              <Button
                variant="outline"
                size="small"
                onClick={() => goToResumeIntake("Opening Resume Intake — retry parsing from the file's row.")}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" /> Re-Parse Resume
              </Button>
              <Button
                variant="outline"
                size="small"
                onClick={() => goToResumeIntake("Opening Resume Intake — upload a replacement resume from there.")}
              >
                <UploadCloud className="h-4 w-4 mr-1.5" /> Upload Replacement Resume
              </Button>
              {canAddManually && (
                <Button variant="primary" size="small" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1.5" /> Add Skill Manually
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {canAddManually && (
        <AddManualSkillModal
          open={addOpen}
          excludeSkillNames={excludeSkillNames}
          onClose={() => setAddOpen(false)}
          onAdd={async (skill) => {
            await onAddManualSkill(candidate.id, skill);
            setAddOpen(false);
          }}
        />
      )}
    </>
  );
}
