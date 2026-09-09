import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Calendar,
  Clock,
  PlaneTakeoff,
  ChevronDown,
  ChevronRight,
  Handshake,
  UserCog2,
  AlertCircle,
  Briefcase,
  ScanSearch,
  Receipt
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { EO_SUBMENU, XMS_SUBMENU, AP_SUBMENU, AR_MAKER_ROLES, AR_CHECKER_ROLES } from "../../config/sidebarConfig";
import { filterMenuByRole } from "../../utils/sidebarPermissions";
import ArModuleIcon from "../icons/ArModuleIcon";
import ApModuleIcon from "../icons/ApModuleIcon";
import { AP_ALL_ROLES } from "../../pages/accounts-payable/constants/apRoles";
import { APPLICATIONS } from "../../utils/applicationRoutes";
// import AIRSLogo from "../icons/AIRSLogo";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    name: "Projects",
    href: "/projects",
    icon: FolderKanban,
    allowedRoles: ["Project_Manager", "General", "Tester"],
  },
  { name: "Leave Management", href: "/leave-management", icon: PlaneTakeoff },
  { name: "Timesheets", href: "/timesheets", icon: Clock },
  // { name: "Calendar", href: "/calendar", icon: Calendar },
  // { name: "Employee Exit", href: "/employee-exit", icon: AlertCircle },
];

const userManagementSubmenu = [
  { label: "User Manage", to: "/user-management/users" },
  { label: "Role Manage", to: "/user-management/roles" },
  { label: "Permission Manage", to: "/user-management/permissions" },
  { label: "Group Manage", to: "/user-management/groups" },
  { label: "Access Point Manage", to: "/user-management/access-points" },
];

// DATA FOR THE POP LABEL / SUBMENU
const resourceManagementSubmenu = [
  { label: "Client Management", to: "/resource-management" },
  { label: "Resource Project Management", to: "/resource-management/projects" },
  // { label: "Asset Categories", to: "/resource-management/asset-categories" },
  // { label: "Asset Types", to: "/resource-management/asset-types" },
  {
    label: "Workforce Availability",
    to: "/resource-management/workforce-availability",
  },
  { label: "Demand Management", to: "/resource-management/demand" },
  { label: "Roll-Off Management", to: "/resource-management/roleoff" },
  { label: "Bench Management", to: "/resource-management/bench" },
  {
    label: "Utilization & Performance",
    to: "/resource-management/bench/utilization-performance",
  },
];

const accountReceivableSubmenu = [
  { label: "Dashboard", to: "/account-receivable/dashboard" },
  {
    label: "Project Billing Setup",
    to: "/account-receivable/project-billing-setup/overview",
    children: [
      {
        label: "Overview",
        to: "/account-receivable/project-billing-setup/overview",
      },
      {
        label: "Billing Config Workspace",
        to: "/account-receivable/project-billing-setup/workspace",
      },
    ],
  },
  {
    label: "Billing Approvals",
    to: "/account-receivable/billing-approvals",
  },
  {
    label: "Billing Data Acquisition",
    to: "/account-receivable/billing-data-acquisition",
    children: [
      {
        label: "Overview",
        to: "/account-receivable/billing-data-acquisition",
      },
      {
        label: "Acquisition Workspace",
        to: "/account-receivable/billing-data-acquisition/workspace",
      },
    ],
  },
  {
    label: "Tax Calculation",
    to: "/account-receivable/tax-calculation",
  },
  {
    label: "Invoice Generation",
    to: "/account-receivable/invoice-generation",
  },
  {
    label: "Configurations",
    to: "/account-receivable/master-data",
  },
];

// Maker-Checker split of the AR submenu above. Super Admin keeps the full,
// unchanged accountReceivableSubmenu (existing AR access must not change);
// Finance Executive (Maker) only gets the create/draft items — no Billing
// Approvals; Finance Manager (Checker) only gets Billing Approvals — no
// create/draft/edit/submit items. Derived by filtering the same source array
// rather than hand-duplicated, so the two variants can never drift from it.
const accountReceivableMakerSubmenu = accountReceivableSubmenu.filter(
  (item) => item.label !== "Billing Approvals",
);
const accountReceivableCheckerSubmenu = accountReceivableSubmenu.filter(
  (item) => item.label === "Billing Approvals",
);

const airsSubmenu = [
  { label: "Dashboard", to: "/airs/dashboard" },
  { label: "JD Management", to: "/airs/jds" },
  { label: "Campaigns", to: "/airs/campaigns" },
  { label: "Resume Intake", to: "/airs/resume-intake" },
  { label: "Pipeline", to: "/airs/pipeline" },
  { label: "Candidates", to: "/airs/candidates" },
  { label: "Skill Ontology", to: "/airs/skill-ontology" },
  { label: "Talent Pool", to: "/airs/talent-pool" },
  { label: "Analytics", to: "/airs/analytics" },
  { label: "Settings", to: "/airs/settings" },
];

// Interview Calendar (/airs/interview-calendar) is HR_ADMIN/RECRUITER only
// — same roles the tab it replaced was gated to — so like Prompt Templates
// below, it's added directly to those two submenus rather than to the
// shared airsSubmenu, which would leak it into the HIRING_MANAGER/HR
// fallback menu further down.
const interviewCalendarItem = { label: "Interview Calendar", to: "/airs/interview-calendar" };

// HR_ADMIN gets a trimmed-down AIRS menu — only these items, plus
// Prompt Templates below (HR_ADMIN-only, not part of the general airsSubmenu).
// "Candidates" here is deliberately its own entry (not filtered in from
// airsSubmenu above) — it points at the HR_ADMIN-only Global Candidate
// Directory (/airs/global-candidates, GET /candidates), NOT the
// campaign-scoped Candidates & Ranking page airsSubmenu's own "Candidates"
// entry points to.
const hrAdminAirsSubmenu = [
  ...airsSubmenu.filter((item) => ["Dashboard", "JD Management", "Campaigns", "Pipeline"].includes(item.label)),
  { label: "Candidates", to: "/airs/global-candidates" },
  ...airsSubmenu.filter((item) => ["Talent Pool", "Skill Ontology"].includes(item.label)),
  interviewCalendarItem,
  { label: "Prompt Templates", to: "/airs/prompt-templates" },
];

// RECRUITER gets a trimmed-down AIRS menu — only these items.
const recruiterAirsSubmenu = [
  ...airsSubmenu.filter((item) =>
    ["Dashboard", "Campaigns", "Resume Intake", "Pipeline", "Talent Pool"].includes(item.label),
  ),
  interviewCalendarItem,
];


const deliveryManagerResourceManagementSubmenu =
  resourceManagementSubmenu.filter(
    (item) =>
      item.label === "Demand Management" ||
      item.label === "Roll-Off Management",
  );

// EO_SUBMENU is now config-driven from src/config/sidebarConfig.js.
// filterMenuByRole() trims it to only the items allowed for the current user's roles.

const Sidebar = ({ isCollapsed, activeApplication = APPLICATIONS.INTRANET }) => {
  const isIntranet = activeApplication === APPLICATIONS.INTRANET;
  const isFinance = activeApplication === APPLICATIONS.FINANCE;
  const location = useLocation();
  const { user, hasRole } = useAuth();

  // Filter main navigation based on allowedRoles
  const filteredNavigation = navigation.filter((item) => {
    if (!item.allowedRoles) return true;

    // Standard check
    const isAllowed = hasRole(item.allowedRoles);
    if (!isAllowed) return false;

    // Special logic for Projects to handle the "General" role commonality
    if (item.name === "Projects") {
      const userRoles = user?.roles?.map((r) => r.toUpperCase()) || [];

      // Show Projects if user has GENERAL or PROJECT_MANAGER
      if (
        userRoles.includes("GENERAL") ||
        userRoles.includes("PROJECT_MANAGER")
      ) {
        return true;
      }

      return false;
    }
  });

  // Role-filtered EO submenu — recomputed whenever the component re-renders with a new user
  const filteredEoSubmenu = filterMenuByRole(EO_SUBMENU, hasRole);

  // Role-filtered Expense Management (XMS) submenu
  const filteredXmsSubmenu = filterMenuByRole(XMS_SUBMENU, hasRole);

  // Role-filtered Accounts Payable (AP) submenu
  const filteredApSubmenu = filterMenuByRole(AP_SUBMENU, hasRole);

  // Role checks
  const isAdmin = hasRole(["ADMIN"]);
  const isSuperAdmin = hasRole(["SUPER_ADMIN"]);
  const isFinanceExecutive = hasRole(["Finance_Executive", "FINANCE_EXECUTIVE"]);
  const canSeeArMaker = hasRole(AR_MAKER_ROLES);
  const canSeeArChecker = hasRole(AR_CHECKER_ROLES) && !isFinanceExecutive;
  const canSeeAr = canSeeArMaker || canSeeArChecker;
  // Super Admin (who is not specifically a Finance Executive): full unchanged submenu.
  // Finance Executive (Maker): create/draft items only — no Billing Approvals.
  // Finance Manager (Checker): Billing Approvals only.
  const arSubmenu = (isSuperAdmin && !isFinanceExecutive)
    ? accountReceivableSubmenu
    : canSeeArMaker
      ? accountReceivableMakerSubmenu
      : accountReceivableCheckerSubmenu;
  // Whole-module gate: unlike EO/XMS (which have no top-level gate because at least one of
  // their items has no allowedRoles), AP must stay fully invisible outside AP_ALL_ROLES —
  // same requirement as Account Receivable's isSuperAdmin gate below.
  const isApUser = hasRole(AP_ALL_ROLES);
  const isRM = hasRole(["RESOURCE_MANAGER"]);
  const isPM = hasRole(["PROJECT_MANAGER"]);
  const isDM = hasRole(["DELIVERY_MANAGER"]);
  const isGeneral = hasRole(["GENERAL"]);
  // Admin with no Resource Manager / Delivery Manager role — skip the
  // Resource Management submenu and jump straight to Client Management.
  const isAdminOnly = isAdmin && !isRM && !isDM;
  const airsRBACAccess = hasRole(["HIRING_MANAGER", "HR", "HR_ADMIN", "RECRUITER"]);
  const isHrAdmin = hasRole(["HR_ADMIN"]);
  const isRecruiter = hasRole(["RECRUITER"]);
  // Everyone else (HIRING_MANAGER, HR) falls through to the full menu, which
  // must not offer Dashboard — /airs/dashboard is HR_ADMIN/RECRUITER only, so
  // the link would lead straight to the unauthorized page.
  const filteredAirsSubmenu = isHrAdmin
    ? hrAdminAirsSubmenu
    : isRecruiter
      ? recruiterAirsSubmenu
      : airsSubmenu.filter((item) => item.label !== "Dashboard");

  // State for User Management Hover
  const [userHovered, setUserHovered] = useState(false);
  const userManagementRef = useRef(null);

  const [eoHovered, setEoHovered] = useState(false);
  const eoRef = useRef(null);

  const [xmsHovered, setXmsHovered] = useState(false);
  const xmsRef = useRef(null);

  // State for Resource Management Hover (NEW)
  const [rmHovered, setRmHovered] = useState(false);
  const rmRef = useRef(null);

  // State for AI Screening Hover
  const [airsHovered, setAirsHovered] = useState(false);
  const airsRef = useRef(null);

  const [arHovered, setArHovered] = useState(false);
  const arRef = useRef(null);

  const [apHovered, setApHovered] = useState(false);
  const apRef = useRef(null);

  const [submenuTop, setSubmenuTop] = useState(0);
  const hoverTimeout = useRef(null);
  const [childMenu, setChildMenu] = useState(null);
  const [childMenuOwner, setChildMenuOwner] = useState(null);
  const [childTop, setChildTop] = useState(0);
  const parentHoverRef = useRef(false);
  const childHoverRef = useRef(false);
  const closeTimerRef = useRef(null);

  const closeAllSubmenus = () => {
    setUserHovered(false);
    setRmHovered(false);
    setEoHovered(false);
    setAirsHovered(false);
    setArHovered(false);
    setXmsHovered(false);
    setApHovered(false);
    setChildMenu(null);
    setChildMenuOwner(null);
  };


  // Keeps a hover flyout on-screen: anchors to the trigger's top when there's
  // room below, otherwise anchors its bottom to the viewport (flips upward).
  const MENU_ITEM_HEIGHT = 40;
  const MENU_VERTICAL_PADDING = 20;
  const VIEWPORT_MARGIN = 8;

  const computeSubmenuTop = (triggerRect, itemCount) => {
    const menuHeight = itemCount * MENU_ITEM_HEIGHT + MENU_VERTICAL_PADDING;
    const spaceBelow = window.innerHeight - triggerRect.top;

    if (spaceBelow >= menuHeight + VIEWPORT_MARGIN) {
      return triggerRect.top;
    }

    return Math.max(VIEWPORT_MARGIN, window.innerHeight - menuHeight - VIEWPORT_MARGIN);
  };

  // --- Handlers for User Management ---
  const handleUserMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    closeAllSubmenus();
    if (userManagementRef.current) {
      const rect = userManagementRef.current.getBoundingClientRect();
      setSubmenuTop(computeSubmenuTop(rect, userManagementSubmenu.length));
    }
    setUserHovered(true);
  };

  const handleUserMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setUserHovered(false);
    }, 200);
  };

  const handleParentHover = (item, e, owner = "eo") => {
    cancelClose();

    parentHoverRef.current = true;

    if (item.children) {
      const rect = e.currentTarget.getBoundingClientRect();
      setChildTop(computeSubmenuTop(rect, item.children.length) + 4);
      setChildMenu(item.children);
      setChildMenuOwner(owner);
    } else {
      setChildMenu(null);
      setChildMenuOwner(null);
    }
  };

  const handleParentLeave = () => {
    setTimeout(() => {
      if (!childHoverRef.current) {
        setChildMenu(null);
        setChildMenuOwner(null);
      }
    }, 150);
  };
  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();

    closeTimerRef.current = setTimeout(() => {
      if (!parentHoverRef.current && !childHoverRef.current) {
        setChildMenu(null);
        setChildMenuOwner(null);
        setEoHovered(false);
        setArHovered(false);
        setXmsHovered(false);
      }
    }, 260); // slightly higher = smoother
  };

  // --- Handlers for Resource Management (NEW) ---
  const handleRmMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    closeAllSubmenus();
    if (rmRef.current) {
      const rect = rmRef.current.getBoundingClientRect();
      setSubmenuTop(computeSubmenuTop(rect, resourceManagementItems.length));
    }
    setRmHovered(true);
  };

  const handleRmMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setRmHovered(false);
    }, 200);
  };

  const handleEoMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    closeAllSubmenus();
    if (eoRef.current) {
      const rect = eoRef.current.getBoundingClientRect();
      setSubmenuTop(computeSubmenuTop(rect, filteredEoSubmenu.length));
    }
    setEoHovered(true);
  };

  const handleEoMouseLeave = () => {
    parentHoverRef.current = false;
    scheduleClose();
  };

  const handleXmsMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    closeAllSubmenus();
    if (xmsRef.current) {
      const rect = xmsRef.current.getBoundingClientRect();
      setSubmenuTop(computeSubmenuTop(rect, filteredXmsSubmenu.length));
    }
    setXmsHovered(true);
  };

  const handleXmsMouseLeave = () => {
    parentHoverRef.current = false;
    scheduleClose();
  };

  // --- Handlers for AI Screening ---
  const handleAirsMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    closeAllSubmenus();
    if (airsRef.current) {
      const rect = airsRef.current.getBoundingClientRect();
      setSubmenuTop(computeSubmenuTop(rect, filteredAirsSubmenu.length));
    }
    setAirsHovered(true);
  };

  const handleAirsMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setAirsHovered(false);
    }, 200);
  };

  const handleArMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    closeAllSubmenus();
    if (arRef.current) {
      const rect = arRef.current.getBoundingClientRect();
      setSubmenuTop(computeSubmenuTop(rect, accountReceivableSubmenu.length));
    }
    setArHovered(true);
  };

  const handleArMouseLeave = () => {
    parentHoverRef.current = false;
    scheduleClose();
  };

  // --- Handlers for Accounts Payable ---
  const handleApMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    closeAllSubmenus();
    if (apRef.current) {
      const rect = apRef.current.getBoundingClientRect();
      setSubmenuTop(rect.top);
    }
    setApHovered(true);
  };

  const handleApMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setApHovered(false);
    }, 200);
  };

  const resourceManagementItems = isAdmin || isRM
    ? resourceManagementSubmenu
    : isDM
      ? deliveryManagerResourceManagementSubmenu
      : resourceManagementSubmenu;

  useEffect(() => {
    setUserHovered(false);
    setRmHovered(false);
    setEoHovered(false);
    setAirsHovered(false);
    setArHovered(false);
    setXmsHovered(false);
    setApHovered(false);
  }, [location.pathname]);


  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-[#081534] text-white flex flex-col z-50 transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"
        } border-r border-[#0f1a3a]`}
    >
      {/* Branding */}
      <div className="p-6 border-b border-[#0f1a3a] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="logo.png" alt="Logo" className="h-10 w-10 shrink-0" />
          {!isCollapsed && (
            <div>
              <h1 className="text-base font-bold leading-none">Paves Tech</h1>
              <p className="text-xs text-gray-400 mt-1">Enterprise App</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-hide">
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        <ul className="space-y-1">
          {isIntranet && (
            <li>
              <Link
                to="/dashboard"
                onMouseEnter={closeAllSubmenus}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium transition-all duration-200 ${location.pathname === "/dashboard"
                  ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                  : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                  }`}
                title={isCollapsed ? "Dashboard" : ""}
              >
                <LayoutDashboard className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
              </Link>
            </li>
          )}

          {isFinance && (
            <li>
              <Link
                to="/finance/dashboard"
                onMouseEnter={closeAllSubmenus}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium transition-all duration-200 ${location.pathname === "/finance/dashboard"
                  ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                  : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                  }`}
                title={isCollapsed ? "Finance Dashboard" : ""}
              >
                <LayoutDashboard className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>Finance Dashboard</span>}
              </Link>
            </li>
          )}

          {/* AI Screening (AIRS) Menu */}
          {airsRBACAccess && (
            <li
              ref={airsRef}
              className="relative"
              onMouseEnter={handleAirsMouseEnter}
              onMouseLeave={handleAirsMouseLeave}
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${location.pathname.startsWith("/airs")
                  ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                  : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                  }`}
                title={isCollapsed ? "AI Screening" : ""}
              >
                <ScanSearch className="h-5 w-5 shrink-0" />

                {!isCollapsed && (
                  <>
                    <span className="flex-1">AI Screening</span>
                    <ChevronRight
                      className={`h-4 w-4 transition-all duration-300 ${airsHovered ? "translate-x-1" : ""
                        }`}
                    />
                  </>
                )}
              </div>

              {airsHovered && (
                <ul
                  className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-20" : "left-64"
                    }`}
                  style={{ top: `${submenuTop}px` }}
                  onMouseEnter={handleAirsMouseEnter}
                  onMouseLeave={handleAirsMouseLeave}
                >
                  {filteredAirsSubmenu.map((item) => (
                    <li key={item.label} className="group relative">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                            ? "bg-blue-100 text-[#0a174e] font-semibold"
                            : "hover:bg-[#263383] hover:text-white"
                          }`
                        }
                      >
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}

          {/* Employee Onboarding (Non-General, Non-DM) */}
          {isIntranet && (
            <li
              ref={eoRef}
              className="relative"
              onMouseEnter={handleEoMouseEnter}
              onMouseLeave={handleEoMouseLeave}
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${location.pathname.startsWith("/employee-onboarding")
                  ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                  : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                  }`}
                title={isCollapsed ? "Employee Onboarding" : ""}
              >
                <Handshake className="h-5 w-5 shrink-0" />

                {!isCollapsed && (
                  <>
                    <span className="flex-1">Employee Onboarding</span>
                    <ChevronRight
                      className={`h-4 w-4 transition-all duration-300 ${eoHovered ? "translate-x-1" : ""
                        }`}
                    />
                  </>
                )}
              </div>

              {/* SAME POPUP STYLE AS RESOURCE MANAGEMENT */}
              {eoHovered && (
                <ul
                  className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-20" : "left-64"
                    }`}
                  style={{ top: `${submenuTop}px` }}
                  onMouseEnter={() => {
                    parentHoverRef.current = true;
                    cancelClose();
                    // if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                  }}
                  onMouseLeave={() => {
                    parentHoverRef.current = false;
                    scheduleClose();
                  }}
                >
                  {filteredEoSubmenu.map((item) => (
                    <li
                      key={item.label}
                      onMouseEnter={(e) => handleParentHover(item, e)}
                      onMouseDown={(e) => handleParentLeave()}
                      // onMouseLeave={handleParentLeave}
                      className="relative group"
                    >
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                            ? "bg-blue-100 text-[#0a174e] font-semibold"
                            : "hover:bg-[#263383] hover:text-white"
                          }`
                        }
                      >
                        <span>{item.label}</span>
                        {item.children && (
                          <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}


          {/* User Management (Admin Only) */}
          {isIntranet && isAdmin && (
            <li
              ref={userManagementRef}
              className="relative"
              onMouseEnter={handleUserMouseEnter}
              onMouseLeave={handleUserMouseLeave}
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${location.pathname.startsWith("/user-management")
                  ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                  : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                  }`}
                title={isCollapsed ? "User Management" : ""}
              >
                <Users className="h-5 w-5 shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1">User Management</span>
                    <ChevronRight
                      className={`h-4 w-4 transition-all duration-300 ${userHovered ? "translate-x-1" : ""
                        }`}
                    />
                  </>
                )}
              </div>

              {/* User Management Submenu */}
              {userHovered && (
                <ul
                  className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-20" : "left-64"
                    }`}
                  style={{ top: `${submenuTop}px` }}
                  onMouseEnter={handleUserMouseEnter}
                  onMouseLeave={handleUserMouseLeave}
                >
                  {userManagementSubmenu.map((item) => (
                    <li key={item.label} className="group relative">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                            ? "bg-blue-100 text-[#0a174e] font-semibold"
                            : "hover:bg-[#263383] hover:text-white"
                          }`
                        }
                      >
                        <span>{item.label}</span>
                        {item.children && (
                          <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}

          {/* Resource Management (With Pop Label/Submenu) */}
          {isIntranet && (isAdmin || isRM || isDM) && (
            <li
              ref={rmRef}
              className="relative"
              onMouseEnter={isAdminOnly ? undefined : handleRmMouseEnter}
              onMouseLeave={isAdminOnly ? undefined : handleRmMouseLeave}
            >
              {/* Admin-only user → Direct Link to Client Management, no submenu */}
              {isAdminOnly ? (
                <Link
                  to="/resource-management"
                  onMouseEnter={closeAllSubmenus}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium transition-all duration-200 ${location.pathname.startsWith("/resource-management")
                    ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                    : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                    }`}
                  title={isCollapsed ? "Resource Management" : ""}
                >
                  <UserCog2 className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>Resource Management</span>}
                </Link>
              ) : (
                <>
                  {/* Resource Manager / Delivery Manager → Show Hover Menu */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${location.pathname.startsWith("/resource-management")
                      ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                      : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                      }`}
                  >
                    <UserCog2 className="h-5 w-5 shrink-0" />

                    {!isCollapsed && (
                      <>
                        <span className="flex-1">Resource Management</span>
                        <ChevronRight
                          className={`h-4 w-4 transition-all duration-300 ${rmHovered ? "translate-x-1" : ""
                            }`}
                        />
                      </>
                    )}
                  </div>

                  {/* Show submenu only for Resource Manager or Delivery Manager */}
                  {rmHovered && (
                    <ul
                      className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-20" : "left-64"
                        }`}
                      style={{ top: `${submenuTop}px` }}
                      onMouseEnter={handleRmMouseEnter}
                      onMouseLeave={handleRmMouseLeave}
                    >
                      {resourceManagementItems.map((item) => (
                        <li key={item.label} className="group relative">
                          <NavLink
                            to={item.to}
                            end
                            className={({ isActive }) =>
                              `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                                ? "bg-blue-100 text-[#0a174e] font-semibold"
                                : "hover:bg-[#263383] hover:text-white"
                              }`
                            }
                          >
                            <span>{item.label}</span>
                            {item.children && (
                              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          )}

          {/* 5. Remaining Items (Leave, Timesheets, Calendar) */}

          {isIntranet && filteredNavigation.slice(1).map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  onMouseEnter={closeAllSubmenus}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium transition-all duration-200 ${isActive
                    ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                    : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                    }`}
                  title={isCollapsed ? item.name : ""}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}

          {isFinance && (
            <>
              {/* Expense Management (XMS) */}
              <li
                ref={xmsRef}
                className="relative"
                onMouseEnter={handleXmsMouseEnter}
                onMouseLeave={handleXmsMouseLeave}
              >
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${location.pathname.startsWith("/expense-management")
                    ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                    : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                    }`}
                  title={isCollapsed ? "Expense Management" : ""}
                >
                  <Receipt className="h-5 w-5 shrink-0" />

                  {!isCollapsed && (
                    <>
                      <span className="flex-1">Expense Management</span>
                      <ChevronRight
                        className={`h-4 w-4 transition-all duration-300 ${xmsHovered ? "translate-x-1" : ""
                          }`}
                      />
                    </>
                  )}
                </div>

                {xmsHovered && (
                  <ul
                    className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-20" : "left-64"
                      }`}
                    style={{ top: `${submenuTop}px` }}
                    onMouseEnter={() => {
                      parentHoverRef.current = true;
                      cancelClose();
                    }}
                    onMouseLeave={() => {
                      parentHoverRef.current = false;
                      setChildMenuOwner(null);
                      scheduleClose();
                    }}
                  >
                    {filteredXmsSubmenu.map((item) => (
                      <li
                        key={item.label}
                        onMouseEnter={(e) => handleParentHover(item, e)}
                        onMouseDown={(e) => handleParentLeave()}
                        className="relative group"
                      >
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                              ? "bg-blue-100 text-[#0a174e] font-semibold"
                              : "hover:bg-[#263383] hover:text-white"
                            }`
                          }
                        >
                          <span>{item.label}</span>
                          {item.children && (
                            <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                          )}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>

              {/* Accounts Payable (Admin, Vendor Intake, AP Executive, Finance Executive only) */}
              {isApUser && (
                <li
                  ref={apRef}
                  className="relative"
                  onMouseEnter={handleApMouseEnter}
                  onMouseLeave={handleApMouseLeave}
                >
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${location.pathname.startsWith("/accounts-payable")
                      ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                      : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                      }`}
                    title={isCollapsed ? "Accounts Payable" : ""}
                  >
                    <ApModuleIcon className="h-5 w-5 shrink-0" />

                    {!isCollapsed && (
                      <>
                        <span className="flex-1">Accounts Payable</span>
                        <ChevronRight
                          className={`h-4 w-4 transition-all duration-300 ${apHovered ? "translate-x-1" : ""
                            }`}
                        />
                      </>
                    )}
                  </div>

                  {apHovered && (
                    <ul
                      className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-20" : "left-64"
                        }`}
                      style={{ top: `${submenuTop}px` }}
                      onMouseEnter={handleApMouseEnter}
                      onMouseLeave={handleApMouseLeave}
                    >
                      {filteredApSubmenu.map((item) => (
                        <li key={item.label} className="group relative">
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                                ? "bg-blue-100 text-[#0a174e] font-semibold"
                                : "hover:bg-[#263383] hover:text-white"
                              }`
                            }
                          >
                            <span>{item.label}</span>
                            {item.children && (
                              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )}

              {/* Accounts Receivable — Super Admin (full), Finance Executive
                  (Maker items only), Finance Manager (Billing Approvals only) */}
              {canSeeAr && (
                <li
                  ref={arRef}
                  className="relative"
                  onMouseEnter={handleArMouseEnter}
                  onMouseLeave={handleArMouseLeave}
                >
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${location.pathname.startsWith("/account-receivable")
                      ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
                      : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
                      }`}
                    title={isCollapsed ? "Account Receivable" : ""}
                  >
                    <ArModuleIcon className="h-5 w-5 shrink-0" />

                    {!isCollapsed && (
                      <>
                        <span className="flex-1">Account Receivable</span>
                        <ChevronRight
                          className={`h-4 w-4 transition-all duration-300 ${arHovered ? "translate-x-1" : ""
                            }`}
                        />
                      </>
                    )}
                  </div>

                  {arHovered && (
                    <ul
                      className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-20" : "left-64"
                        }`}
                      style={{ top: `${submenuTop}px` }}
                      onMouseEnter={() => {
                        parentHoverRef.current = true;
                        cancelClose();
                      }}
                      onMouseLeave={() => {
                        parentHoverRef.current = false;
                        scheduleClose();
                      }}
                    >
                      {arSubmenu.map((item) => (
                        <li
                          key={item.label}
                          className="group relative"
                          onMouseEnter={(e) => handleParentHover(item, e, "ar")}
                          onMouseDown={() => handleParentLeave()}
                        >
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                                ? "bg-blue-100 text-[#0a174e] font-semibold"
                                : "hover:bg-[#263383] hover:text-white"
                              }`
                            }
                          >
                            <span>{item.label}</span>
                            {item.children && (
                              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )}
            </>
          )}

        </ul>

        {childMenu && (
          <ul
            className={`fixed w-fit min-w-[220px] whitespace-nowrap bg-white text-[#0a174e] rounded-lg shadow-2xl z-[9999] py-2 border ${isCollapsed ? "left-[305px]" : "left-[480px]"
              }`}
            style={{ top: `${childTop - 4}px` }}
            onMouseEnter={() => {
              childHoverRef.current = true;
              cancelClose();
            }}
            onMouseLeave={() => {
              childHoverRef.current = false;
              scheduleClose();
            }}
            onMouseDown={() => {
              childHoverRef.current = false;
              scheduleClose();
            }}
          >
            {childMenu.map((child) => (
              <li key={child.label} className="group relative">
                <NavLink
                  to={child.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-2 text-xs transition-colors ${isActive
                      ? "bg-blue-100 text-[#0a174e] font-semibold"
                      : "hover:bg-[#263383] hover:text-white"
                    }`
                  }
                >
                  <span>{child.label}</span>
                  {child.children && (
                    <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;

// : (isPM && !isRM && !isDM) ? (
//                 <Link
//                   to="/resource-management/projects"
//                   className={`flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium transition-all duration-200 ${location.pathname.startsWith("/resource-management/projects")
//                     ? "bg-[#263383] text-white border-l-4 border-[#ff3d72]"
//                     : "text-gray-300 hover:bg-[#0f1536] hover:text-white"
//                     }`}
//                   title={isCollapsed ? "Resource Project Management" : ""}
//                 >
//                   <UserCog2 className="h-5 w-5 shrink-0" />
//                   {!isCollapsed && <span>Resource Project Management</span>}
//                 </Link>
//               )
