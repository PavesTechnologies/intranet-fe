import { useEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@headlessui/react";
import { Check, ChevronDown, RefreshCw, AlertCircle, FolderKanban, Hash, CalendarRange, Building2, UserRound } from "lucide-react";
import classNames from "classnames";

import FormInput from "../../../../components/forms/FormInput";
import FormDatePicker from "../../../../components/forms/FormDatePicker";
import {
  getBillingConfigurationClients,
  getBillingConfigurationProjectsByClient,
  fetchBillingConfigurations,
} from "../../services/billingConfigService";

function SummaryField({ icon, label, value, wide }) {
  return (
    <div className={`min-w-0 px-4 py-2.5 first:pl-0 last:pr-0 ${wide ? "min-w-[190px] flex-[1.6]" : "min-w-[130px] flex-1"}`}>
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </span>
      <span className="mt-1 block whitespace-nowrap text-[13px] font-medium text-slate-700">{value}</span>
    </div>
  );
}

export default function ProjectStep({ value = {}, onChange }) {
  const [projects, setProjects] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [configuredProjectKeys, setConfiguredProjectKeys] = useState(new Set());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Load clients list from backend; project list is loaded when a client is selected
    getBillingConfigurationClients()
      .then((clients) => {
        if (!isMounted.current) return;
        setClientOptions(
          Array.isArray(clients)
            ? Array.from(new Map(clients.map((c) => [c.clientId || c.id, c.clientName || c.name])), ([val, label]) => ({ value: val, label }))
            : []
        );
      })
      .catch(() => {
        if (!isMounted.current) return;
        setProjects([]);
        setClientOptions([]);
      })
      .finally(() => {
        if (!isMounted.current) return;
        setLoadingClients(false);
      });
  }, []);

  useEffect(() => {
    if (!value.clientId) return;

    setLoadingProjects(true);
    getBillingConfigurationProjectsByClient(value.clientId)
      .then((projectList) => {
        if (!isMounted.current) return;
        setProjects(Array.isArray(projectList) ? projectList : []);
      })
      .catch(() => {
        if (!isMounted.current) return;
        setProjects([]);
      })
      .finally(() => {
        if (!isMounted.current) return;
        setLoadingProjects(false);
      });
  }, [value.clientId]);

  // A project is only blocked from a new Billing Setup while a configuration
  // for it is still in progress (Draft/Pending Approval) or is currently
  // active (Approved + billingStatus ACTIVE — same definition used for the
  // "Active" stat in billingConfigurationService.js). Rejected configs never
  // block, and an Approved config that was later deactivated (billingStatus
  // flips to INACTIVE, approvalStatus stays APPROVED — see
  // deactivateBillingConfiguration) no longer blocks either, so the project
  // becomes available again for a fresh setup. (Note: getBillingConfigurations
  // returns every configuration regardless of status, so this filtering must
  // happen here.)
  useEffect(() => {
    if (!value.clientId || !value.clientName) {
      setConfiguredProjectKeys(new Set());
      return;
    }

    let cancelled = false;
    fetchBillingConfigurations()
      .then((configs) => {
        if (cancelled) return;
        const belongsToClient = (config) =>
          (value.clientId && config.clientId && String(config.clientId) === String(value.clientId)) ||
          config.client === value.clientName;

        const blocksNewSetup = (config) => {
          if (config.approvalStatus === "DRAFT" || config.approvalStatus === "PENDING_APPROVAL") return true;
          return config.approvalStatus === "APPROVED" && config.billingStatus === "ACTIVE";
        };

        const keys = new Set(
          (Array.isArray(configs) ? configs : [])
            .filter(belongsToClient)
            .filter(blocksNewSetup)
            .flatMap((config) => [config.projectId, config.projectCode])
            .filter(Boolean)
            .map(String)
        );
        setConfiguredProjectKeys(keys);
      })
      .catch(() => {
        if (!cancelled) setConfiguredProjectKeys(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [value.clientId, value.clientName]);

  // Internal projectSource defaults to ENTERPRISE if not set
  const projectSource = value.projectSource || "ENTERPRISE";

  // clientOptions are loaded from backend via `getBillingConfigurationClients`

  // Projects filtered by selected client, excluding ones that already have a
  // Billing Configuration (Draft or Active) — except the project currently
  // selected, so editing an existing Draft setup doesn't hide its own project.
  const availableProjects = useMemo(() => {
    return projects.filter((project) => {
      const projectId = String(project.projectId || project.id || "");
      if (value.projectId && projectId === String(value.projectId)) return true;
      if (projectId && configuredProjectKeys.has(projectId)) return false;
      if (project.projectCode && configuredProjectKeys.has(String(project.projectCode))) return false;
      return true;
    });
  }, [projects, configuredProjectKeys, value.projectId]);

  const projectOptions = useMemo(() => {
    if (!value.clientId) return [];
    return availableProjects.map((project) => ({ value: String(project.projectId || project.id || ""), label: project.projectName }));
  }, [availableProjects, value.clientId]);

  // Selected enterprise project details
  const matchedProject = useMemo(() => {
    if (!value.projectId) return null;
    return (
      projects.find((project) => String(project.projectId || project.id || "") === String(value.projectId)) || null
    );
  }, [projects, value.projectId]);

  // A Draft billing configuration can come back from the backend without its
  // project-derived fields (e.g. projectCode) persisted — once the client's
  // project list loads, backfill anything missing from the matched project so
  // the summary card and step validation don't see a false "missing" field.
  useEffect(() => {
    if (!matchedProject) return;
    if (value.projectCode && value.projectDuration) return;

    onChange({
      ...value,
      projectName: value.projectName || matchedProject.projectName,
      projectCode: value.projectCode || matchedProject.projectCode,
      projectDuration: value.projectDuration || matchedProject.projectDuration,
      currency: value.currency || matchedProject.projectBudgetCurrency || matchedProject.currency || "",
      projectBudget: value.projectBudget ?? matchedProject.projectBudget ?? "",
      projectBudgetCurrency:
        value.projectBudgetCurrency || matchedProject.projectBudgetCurrency || matchedProject.currency || "",
      startDate: value.startDate || matchedProject.startDate,
      endDate: value.endDate || matchedProject.endDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedProject]);

  // Filter client list based on search query
  const filteredClientOptions = useMemo(() => {
    if (clientQuery === "") return clientOptions;
    return clientOptions.filter((option) =>
      option.label.toLowerCase().includes(clientQuery.toLowerCase())
    );
  }, [clientOptions, clientQuery]);

  const showClientNotFound = clientQuery !== "" && filteredClientOptions.length === 0;

  const getProjectDurationLabel = (projectData) => {
    if (projectData?.projectDuration) return projectData.projectDuration;
    if (projectData?.startDate || projectData?.endDate) {
      return `${projectData.startDate || "—"} to ${projectData.endDate || "Ongoing"}`;
    }
    return "—";
  };

  // Handlers
  const handleClientSelect = (clientId) => {
    const clientName = clientOptions.find((opt) => opt.value === clientId)?.label || "";
    setLoadingProjects(true);
    setProjects([]);

    getBillingConfigurationProjectsByClient(clientId)
      .then((projectList) => {
        if (!isMounted.current) return;
        setProjects(Array.isArray(projectList) ? projectList : []);
      })
      .catch(() => {
        if (!isMounted.current) return;
        setProjects([]);
      })
      .finally(() => {
        if (!isMounted.current) return;
        setLoadingProjects(false);
      });

    onChange({
      ...value,
      projectSource: "ENTERPRISE",
      clientId,
      clientName,
      projectId: "",
      projectName: "",
      projectCode: "",
      projectDuration: "",
      currency: "",
      projectBudget: "",
      projectBudgetCurrency: "",
      startDate: "",
      endDate: "",
    });
  };

  const handleProjectSelect = (event) => {
    const projectId = event.target.value;
    const project = projects.find((p) => String(p.id) === String(projectId));
    if (project) {
      onChange({
        ...value,
        projectSource: "ENTERPRISE",
        clientId: value.clientId,
        clientName: value.clientName,
        projectId,
        projectName: project.projectName,
        projectCode: project.projectCode,
        projectDuration: project.projectDuration,
        currency: project.projectBudgetCurrency || project.currency || "",
        projectBudget: project.projectBudget ?? "",
        projectBudgetCurrency: project.projectBudgetCurrency || project.currency || "",
        startDate: project.startDate,
        endDate: project.endDate,
      });
    } else {
      onChange({
        ...value,
        projectId: "",
        projectName: "",
        projectCode: "",
        projectDuration: "",
        currency: "",
        projectBudget: "",
        projectBudgetCurrency: "",
        startDate: "",
        endDate: "",
      });
    }
  };

  const switchToStandalone = () => {
    onChange({
      ...value,
      projectSource: "STANDALONE",
      clientId: "",
      clientName: clientQuery,
      projectId: "",
      projectName: "",
      projectCode: "",
      currency: "",
      projectBudget: "",
      projectBudgetCurrency: "",
      startDate: "",
      endDate: "",
    });
    setClientQuery("");
  };

  const switchToEnterprise = () => {
    onChange({
      ...value,
      projectSource: "ENTERPRISE",
      clientId: "",
      clientName: "",
      projectId: "",
      projectName: "",
      projectCode: "",
      currency: "",
      projectBudget: "",
      projectBudgetCurrency: "",
      startDate: "",
      endDate: "",
    });
    setClientQuery("");
  };

  const handleFieldChange = (event) => {
    const { name, value: fieldValue } = event.target;
    onChange({ ...value, [name]: fieldValue });
  };

  const handleDateChange = (name) => (event) => {
    onChange({ ...value, [name]: event.target.value });
  };

  return (
    <div className="space-y-5">
      {projectSource === "STANDALONE" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={switchToEnterprise}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Search Enterprise Projects
          </button>
        </div>
      )}

      {/* Inputs Section */}
      <div className="space-y-5">

        {projectSource === "ENTERPRISE" ? (
          /* ENTERPRISE FLOW */
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Client Searchable Dropdown */}
              <div className="space-y-1 w-full min-w-0">
              <label className="block text-sm font-medium text-slate-700">
                Client Name <span className="text-red-500">*</span>
              </label>
              <Combobox value={value.clientId || null} onChange={handleClientSelect}>
                <div className="relative min-w-0">
                  <Combobox.Input
                    className="w-full min-w-0 px-4 py-2 border border-slate-300 rounded-lg shadow-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:cursor-not-allowed disabled:bg-slate-50 text-sm"
                    displayValue={() => value.clientName || ""}
                    onChange={(event) => setClientQuery(event.target.value)}
                    placeholder={loadingClients ? "Loading clients..." : "Search client..."}
                    disabled={loadingClients}
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </Combobox.Button>

                  <Combobox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {filteredClientOptions.length > 0 &&
                      filteredClientOptions.map((option) => (
                        <Combobox.Option
                          key={option.value}
                          value={option.value}
                          className={({ active }) =>
                            classNames(
                              "relative cursor-pointer select-none py-2 px-4",
                              active ? "bg-indigo-50 text-indigo-900 font-medium" : "text-slate-900"
                            )
                          }
                        >
                          {({ selected }) => (
                            <div className="flex justify-between items-center gap-2">
                              <span>{option.label}</span>
                              {selected && <Check className="w-4 h-4 text-indigo-600" />}
                            </div>
                          )}
                        </Combobox.Option>
                      ))}
                    {showClientNotFound && (
                      <div className="p-4 text-center">
                        <p className="text-sm text-slate-500 mb-2">No matching client found.</p>
                        <button
                          type="button"
                          onClick={switchToStandalone}
                          className="w-full inline-flex justify-center items-center gap-1.5 rounded-md bg-[#0A0082] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#080066]"
                        >
                          Create standalone client &amp; project
                        </button>
                      </div>
                    )}
                  </Combobox.Options>
                </div>
              </Combobox>
            </div>

            {/* Project Name dropdown */}
            <div className="space-y-1 w-full min-w-0">
              <label className="block text-sm font-medium text-slate-700">
                Project Name <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                value={value.projectId || ""}
                onChange={handleProjectSelect}
                disabled={loadingClients || !value.clientId}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:cursor-not-allowed disabled:bg-slate-50 text-sm"
              >
                <option value="">
                  {loadingClients
                    ? "Loading clients..."
                    : !value.clientId
                    ? "Select client first"
                    : loadingProjects
                    ? "Loading projects..."
                    : projectOptions.length === 0
                    ? "No projects found"
                    : "Select project"}
                </option>
                {projectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              </div>
            </div>

          </div>
        ) : (
          /* STANDALONE FLOW */
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-500" />
              <p>
                No matching client found. Form switched to <strong className="font-semibold">Standalone Project</strong> mode.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormInput
                label="Client Name"
                requiredMark
                name="clientName"
                value={value.clientName || ""}
                onChange={handleFieldChange}
                placeholder="e.g. Meridian Financial Group"
              />

              <FormInput
                label="Project Name"
                requiredMark
                name="projectName"
                value={value.projectName || ""}
                onChange={handleFieldChange}
                placeholder="e.g. Core Banking Platform Upgrade"
              />

              <FormInput
                label="Project Code"
                requiredMark
                name="projectCode"
                value={value.projectCode || ""}
                onChange={handleFieldChange}
                placeholder="e.g. MAN-1004"
              />

              <FormDatePicker
                label="Project Start Date *"
                name="startDate"
                value={value.startDate || ""}
                onChange={handleDateChange("startDate")}
              />

              <FormDatePicker
                label="Project End Date *"
                name="endDate"
                value={value.endDate || ""}
                onChange={handleDateChange("endDate")}
                min={value.startDate || undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Project summary (Only for Enterprise, when selected) */}
      {projectSource === "ENTERPRISE" && value.projectId && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <h3 className="text-[13px] font-semibold text-slate-700">Project Summary</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
              <span className="h-1 w-1 rounded-full bg-indigo-400" />
              Synced from PMS
            </span>
          </div>

          <div className="flex divide-x divide-slate-100 overflow-x-auto px-4 py-1">
            <SummaryField
              icon={<Hash className="h-3 w-3" strokeWidth={1.75} />}
              label="Project Code"
              value={value.projectCode || "—"}
            />
            <SummaryField
              icon={<CalendarRange className="h-3 w-3" strokeWidth={1.75} />}
              label="Project Duration"
              value={getProjectDurationLabel(value)}
              wide
            />
            <SummaryField
              icon={<Building2 className="h-3 w-3" strokeWidth={1.75} />}
              label="Project Source"
              value="Enterprise (PMS)"
            />
            {matchedProject && (
              <SummaryField
                icon={<UserRound className="h-3 w-3" strokeWidth={1.75} />}
                label="Project Manager"
                value={matchedProject.projectManagerName || matchedProject.projectManagerId || "—"}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
