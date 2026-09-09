import React, { useEffect } from "react";
import "react-phone-input-2/lib/style.css";
import { Toaster } from "react-hot-toast";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";

import LoginPage from "./pages/LoginPage";
import Layout from "./components/Layout/Layout";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";

// Finance Management (Application Switcher landing page)
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import { FINANCE_ALL_ROLES, AR_MAKER_ROLES, AR_CHECKER_ROLES } from "./config/sidebarConfig";

// Accounts Payable
import { AP_ROUTES } from "./pages/accounts-payable/constants/routes";
import { AP_ALL_ROLES } from "./pages/accounts-payable/constants/apRoles";
import APDashboardPage from "./pages/accounts-payable/dashboard/pages/APDashboardPage.jsx";
import VendorListPage from "./pages/accounts-payable/vendor/pages/VendorListPage.jsx";
import VendorDetailPage from "./pages/accounts-payable/vendor/pages/VendorDetailPage.jsx";
import VendorOnboardingPage from "./pages/accounts-payable/vendor/pages/VendorOnboardingPage.jsx";
import VendorUpdatePage from "./pages/accounts-payable/vendor/pages/VendorUpdatePage.jsx";
import InvoiceUploadPage from "./pages/accounts-payable/invoice/pages/InvoiceUploadPage.jsx";
import InvoiceOcrReviewQueuePage from "./pages/accounts-payable/invoice/pages/InvoiceOcrReviewQueuePage.jsx";
import InvoiceValidationQueuePage from "./pages/accounts-payable/invoice/pages/InvoiceValidationQueuePage.jsx";
import InvoiceListPage from "./pages/accounts-payable/invoice/pages/InvoiceListPage.jsx";
import InvoiceDetailPage from "./pages/accounts-payable/invoice/pages/InvoiceDetailPage.jsx";
import PaymentReadyPage from "./pages/accounts-payable/payment/pages/PaymentReadyPage.jsx";
import PaymentHistoryPage from "./pages/accounts-payable/payment/pages/PaymentHistoryPage.jsx";
import PaymentMarkAsPaidPage from "./pages/accounts-payable/payment/pages/PaymentMarkAsPaidPage.jsx";
import PaymentQueuePage from "./pages/accounts-payable/payment/pages/PaymentQueuePage.jsx";
import PaymentDetailsPage from "./pages/accounts-payable/payment/pages/PaymentDetailsPage.jsx";
import APReportsPage from "./pages/accounts-payable/reports/pages/APReportsPage.jsx";
import APSettingsPage from "./pages/accounts-payable/settings/pages/APSettingsPage.jsx";
import SystemConfigurationPage from "./pages/accounts-payable/system-configuration/pages/SystemConfigurationPage.jsx";
import {
  PROCUREMENT_PERMISSIONS,
  PROCUREMENT_ANY_VIEW_PERMISSIONS,
} from "./pages/accounts-payable/constants/procurementPermissions";
import ProcurementPage from "./pages/accounts-payable/procurement/pages/ProcurementPage.jsx";
import PrDetailPage from "./pages/accounts-payable/procurement/pages/PrDetailPage.jsx";
import PurchaseOrderDetailPage from "./pages/accounts-payable/procurement/pages/PurchaseOrderDetailPage.jsx";
import RfqDetailPage from "./pages/accounts-payable/procurement/pages/RfqDetailPage.jsx";


// Resource Management
import AdminPannel from "./pages/resource_management/pages/admin/AdminPannel.jsx";
import ClientPage from "./pages/resource_management/models/ClientPage.jsx";
import AssetList from "./pages/resource_management/assests/AssetList.jsx";
import AssetDetail from "./pages/resource_management/assests/AssetDetail.jsx";
import RMSProjectList from "./pages/resource_management/pages/project/RMSProjectList.jsx";
import RMSProjectDetails from "./pages/resource_management/pages/project/RMSProjectDetails.jsx";
import WorkforceAvailability from "./pages/resource_management/pages/workforce/WorkforceAvailability.jsx";
import ResourceIntelligenceCenter from "./pages/resource_management/components/resource-intelligence/ResourceIntelligenceCenter.jsx";
import DemandWorkspacePage from "./pages/resource_management/demand/pages/DemandWorkspacePage.jsx";
import DemandDetailPage from "./pages/resource_management/demand/pages/DemandDetailPage.jsx";
import PMRoleOffPage from "./pages/resource_management/pages/roleoff/pm.js";
import RMRoleOffPage from "./pages/resource_management/pages/roleoff/rm.js";
import DMRoleOffPage from "./pages/resource_management/pages/roleoff/dm.js";
import BenchPage from "./pages/resource_management/bench/pages/BenchPage.jsx";
import RoleOffDashboard from "./pages/resource_management/pages/roleoff/RoleOffDashboard.jsx";
import BenchPoolDashboard from "./pages/resource_management/bench/pages/BenchPoolDashboard.jsx";
import UtilizationPerformanceDashboard from "./pages/resource_management/bench/pages/UtilizationPerformanceDashboard.jsx";
import OperationalProjectDetailPage from "./pages/resource_management/bench/pages/OperationalProjectDetailPage.jsx";
import UtilizationReportingDashboard from "./pages/resource_management/bench/pages/UtilizationReportingDashboard.jsx";

// Timesheets

import InitialPasswordSetup from "./pages/UserManagement/auth/InitialPasswordSetup";
import TimesheetHistoryPage from "./pages/Timesheet/TimesheetHistoryPage";
import ManagerApprovalPage from "./pages/Timesheet/ManagerApproval/ManagerApprovalPage";
import DashboardPage from "./pages/Timesheet/DashboardPage";
import ManagerDashboard from "./pages/Timesheet/ManagerDashboard";
import IntranetForm from "./components/forms/IntranetForm";
import ReportDashboard from "./pages/Timesheet/ReportDashboard";
import MonthlyTSReport from "./pages/Timesheet/MonthlyTSReport";
import ManagerReportSection from "./pages/Timesheet/ManagerReportSection";
import ManagerMonthlyReport from "./pages/Timesheet/ManagerMonthlyReport";
import TSAdminPanel from "./pages/Timesheet/Admin/TSAdminPannel.jsx";
import TimesheetHistory from "./pages/Timesheet/TimesheetHistory.jsx";

// ✅ Project Management
import ProjectDashboard from "./pages/Projects/manager/ProjectDashboard";
import Summary from "./pages/Projects/Summary/Summary.jsx";
// import Backlog from "./pages/Projects/manager/Backlog/Backlog";
import Board from "./pages/Projects/manager/Board";
import CreateProjectModal from "./pages/Projects/manager/CreateProjectModal";
import ProjectTabs from "./pages/Projects/manager/ProjectTabs";
import ReadOnlyDashboard from "./pages/Projects/User/ReadOnlyDashboard";

import UserBacklog from "./pages/Projects/User/UserBacklog/userbacklog";
import UserProjectTabs from "./pages/Projects/User/UserProjectTabs";
import ProjectList from "./pages/Projects/manager/ProjectList";
import UserProjectList from "./pages/Projects/User/UserProjectList";
import EmployeePerformance from "./pages/Projects/manager/EmployeePerformance";
import Userprofile from "./pages/Projects/User/Userprofile";
import IssueTracker from "./pages/Projects/manager/Backlog/IssueTracker";
import ViewSheet from "./pages/Projects/manager/Backlog/ViewSheet";
import ProjectStatusReportWrapper from "./pages/Projects/manager/ProjectStatusReportWrapper";
import UserIssueTracker from "./pages/Projects/User/UserBacklog/IssueTracker";
import CycleRunsPage from "./pages/Projects/Testmanagement/TestExecution/CycleRunsPage";
import AddCasesFromProjectModal from "./pages/Projects/Testmanagement/TestDesign/modals/AddCasesFromProjectModal.jsx";
import MyWorkPage from "./pages/Projects/MyWork/MyWorkPage";
// ✅ Employee Onboarding
import EmpDashboard from "./pages/employee-onboarding/EmpDashboard.jsx";
import EmployeeProfileView from "./pages/employee-onboarding/employeeProfile/EmployeeProfileView.jsx";
import CreateOffer from "./pages/employee-onboarding/components/CreateOffer";
import BulkUpload from "./pages/employee-onboarding/components/BulkUpload.jsx";
import ViewEmpDetails from "./pages/employee-onboarding/components/ViewEmpDetails.jsx";
import HrConfiguration from "./pages/employee-onboarding/hr-configuration/HrConfiguration.jsx";
import CountryManagement from "./pages/employee-onboarding/hr-configuration/country/CountryManagement.jsx";
import IdentityTypeManagement from "./pages/employee-onboarding/hr-configuration/identity/IdentityTypeManagement.jsx";
import CountryIdentityMapping from "./pages/employee-onboarding/hr-configuration/mapping/CountryIdentityMapping.jsx";
import EducationDashboard from "./pages/employee-onboarding/hr-configuration/education/EducationDashboard.jsx";
import EducationLevelManagement from "./pages/employee-onboarding/hr-configuration/education/levels/EducationLevelManagement.jsx";
import EducationDocumentManagement from "./pages/employee-onboarding/hr-configuration/education/documents/EducationDocumentManagement.jsx";
import CountryEducationMapping from "./pages/employee-onboarding/hr-configuration/education/mapping/CountryEducationMapping.jsx";
import DegreeMasterManagement from "./pages/employee-onboarding/hr-configuration/education/degrees/DegreeMasterManagement.jsx";

// import AdminApprovalActions from "./pages/employee-onboarding/admin/AdminApprovalActions.jsx";
import AdminApprovalDashboard from "./pages/employee-onboarding/admin/AdminApprovalDashboard.jsx"; import AdminOfferView from "./pages/employee-onboarding/admin/AdminOfferView.jsx";

// AI Screening (AIRS)
import RecruiterDashboardPage from "./pages/airs/dashboard/RecruiterDashboardPage.jsx";
import JdLibrary from "./pages/airs/pages/JdLibrary.jsx";
import JdCreate from "./pages/airs/pages/JdCreate.jsx";
import JdDetails from "./pages/airs/pages/JdDetails.jsx";
import Campaigns from "./pages/airs/campaigns/Campaigns.jsx";
import CampaignDetails from "./pages/airs/campaigns/CampaignDetails.jsx";

import AirsPlaceholder from "./pages/airs/pages/AirsPlaceholder.jsx";

import ResumeIntakePage from "./pages/airs/resume-intake/ResumeIntakePage.jsx";
import IntakeFlowPage from "./pages/airs/resume-intake/intake/IntakeFlowPage.jsx";
import ReviewPage from "./pages/airs/resume-intake/intake/ReviewPage.jsx";
import CandidateRankingPage from "./pages/ai-screening/candidates/CandidateRankingPage.jsx";
import CandidateScorePage from "./pages/ai-screening/candidates/CandidateScore/CandidateScorePage.jsx";
import InterviewQueuePage from "./pages/airs/interview-queue/InterviewQueuePage.jsx";
import InterviewCalendarPage from "./pages/airs/interview-calendar/InterviewCalendarPage.jsx";
import PipelineBoardPage from "./pages/airs/pipeline/PipelineBoardPage.jsx";
import GlobalCandidatesPage from "./pages/airs/global-candidates/GlobalCandidatesPage.jsx";
import PipelineCandidateScorecardPage from "./pages/airs/pipeline/PipelineCandidateScorecardPage.jsx";
import TalentPoolPage from "./pages/airs/talent-pool/TalentPoolPage.jsx";
import TalentPoolCandidateProfilePage from "./pages/airs/talent-pool/profile/TalentPoolCandidateProfilePage.jsx";
import AnalyticsPage from "./pages/airs/analytics/AnalyticsPage.jsx";
import SettingsPage from "./pages/airs/settings/SettingsPage.jsx";
import SkillOntologyPage from "./pages/airs/skill-ontology/SkillOntologyPage.jsx";
import SkillDetailPage from "./pages/airs/skill-ontology/SkillDetailPage.jsx";
import HierarchyPage from "./pages/airs/skill-ontology/HierarchyPage.jsx";
import UnknownSkillDetailPage from "./pages/airs/skill-ontology/UnknownSkillDetailPage.jsx";
import PromptTemplatesPage from "./pages/airs/prompt-templates/PromptTemplatesPage.jsx";
import PromptTemplateViewPage from "./pages/airs/prompt-templates/PromptTemplateViewPage.jsx";

import AdminOfferLettersDashboard from "./pages/employee-onboarding/admin/AdminOfferLettersDashboard.jsx";
import HrOnboardingDashboard from "./pages/employee-onboarding/hr/HrOnboardingDashboard.jsx";
import HrProfileView from "./pages/employee-onboarding/hr/HrProfileView.jsx";
import BackgroundCheckPage from "./pages/employee-onboarding/hr/BackgroundCheckPage.jsx";
import OnboardingTask from "./pages/employee-onboarding/onboarding-task/OnboardingTask.jsx";
import EmployeeDirectory from "./pages/employee-onboarding/employee-directory/EmployeeDirectory.jsx";
import EmployeeVerification from "./pages/employee-onboarding/employee-verification/EmployeeVerification.jsx";
import EmployeeDocumentsTemplate from "./pages/employee-onboarding/employee-documents-template/EmployeeDocumentsTemplate.jsx";
import OrganizationTree from "./pages/employee-onboarding/organization-tree/OrganizationTree.jsx";
import SummaryPage from "./pages/employee-onboarding/summary-page/SummaryPage.jsx";
import EmployeeDocumentsPage from "./pages/employee-onboarding/employeedocuments/EmployeeDocuments.jsx";
import HeadcountDemographicsPage from "./pages/employee-onboarding/analytics/HeadcountDemographics.jsx";
import EmployeeListPage from "./pages/employee-onboarding/employeelist/EmployeeList.jsx";
import EmployeeCredentials from "./pages/employee-onboarding/employee-credentials/EmployeeCredentials.jsx";
import CoreEmployeeDetails from "./pages/employee-onboarding/core-employee/CoreEmployeeDetailsDashboard.jsx";
import EmployeeOnboardingLayout from "./pages/employee-onboarding/EmployeeOnboardingLayout.jsx";
import OnboardingSummary from "./pages/employee-onboarding/summary-page/OnboardingSummary.jsx";
import DepartmentsMappingDashboard from "./pages/employee-onboarding/hr-configuration/departments/DepartmentsMappingDashboard.jsx";
import DepartmentsList from "./pages/employee-onboarding/hr-configuration/departments/departmentsList/DepartmentsList.jsx";
import DesignationsList from "./pages/employee-onboarding/hr-configuration/departments/designationsList/DesignationsList.jsx";
import WeeklyJoiningDashboard from "./pages/employee-onboarding/weekly-joining-report-dashboard/WeeklyJoiningDashboard.jsx";
import DocumentTemplates from "./pages/employee-onboarding/document-templates/DocumentTemplates.jsx";
import ManageSkillTaxonomy from "./pages/employee-onboarding/manage-skill-taxonomy/ManageSkillTaxonomy.jsx";
import AddCertificate from "./pages/employee-onboarding/manage-skill-taxonomy/AddCertificate.jsx";

import EmployeeDocuments from "./pages/employee-onboarding/employeedocuments/EmployeeDocuments.jsx";

import OfferPreview from "./pages/employee-onboarding/offer-preview/OfferPreview.jsx";
import FinalOfferPreview from "./pages/employee-onboarding/final-offer-preview/FinalOfferPreview.jsx";
import OfferGeneratedPreview from "./pages/employee-onboarding/offer-generated-preview/OfferGeneratedPreview.jsx";

// ✅ Expense Management (XMS)
import XmsDashboardPage from "./pages/expense-management/pages/dashboard/DashboardPage.jsx";
import XmsCreateExpensePage from "./pages/expense-management/pages/expenses/CreateExpensePage.jsx";
import XmsMyExpensesPage from "./pages/expense-management/pages/expenses/MyExpensesPage.jsx";
import XmsAllExpensesPage from "./pages/expense-management/pages/expenses/AllExpensesPage.jsx";
import XmsExpenseReportsPage from "./pages/expense-management/pages/expenses/ExpenseReportsPage.jsx";
import XmsExpenseReportDetailPage from "./pages/expense-management/pages/expenses/ExpenseReportDetailPage.jsx";
import XmsReceiptLibraryPage from "./pages/expense-management/pages/receipts/ReceiptLibraryPage.jsx";
import XmsOcrProcessingPage from "./pages/expense-management/pages/receipts/OcrProcessingPage.jsx";
import XmsRequestAdvancePage from "./pages/expense-management/pages/cash-advance/RequestAdvancePage.jsx";
import XmsMyAdvancesPage from "./pages/expense-management/pages/cash-advance/MyAdvancesPage.jsx";
import XmsSettlementPage from "./pages/expense-management/pages/cash-advance/SettlementPage.jsx";
import XmsApprovalsPage from "./pages/expense-management/approval-engine/pages/ApprovalsPage.jsx";
import XmsApprovalFlowsPage from "./pages/expense-management/approval-engine/pages/ApprovalFlowsPage.jsx";
import XmsApprovalFlowBuilderPage from "./pages/expense-management/approval-engine/pages/ApprovalFlowBuilderPage.jsx";
import XmsCatchAllFlowPage from "./pages/expense-management/approval-engine/pages/CatchAllFlowPage.jsx";
import XmsDepartmentApproversPage from "./pages/expense-management/approval-engine/pages/DepartmentApproversPage.jsx";
import XmsDelegationsPage from "./pages/expense-management/approval-engine/pages/DelegationsPage.jsx";
import XmsVerificationPage from "./pages/expense-management/pages/finance/VerificationPage.jsx";
import XmsReimbursementsPage from "./pages/expense-management/pages/finance/ReimbursementsPage.jsx";
import XmsPaymentStatusPage from "./pages/expense-management/pages/finance/PaymentStatusPage.jsx";
import XmsApPaymentQueuePage from "./pages/expense-management/pages/ap-payments/ApPaymentQueuePage.jsx";
import XmsBillableExpensesPage from "./pages/expense-management/pages/client-billing/BillableExpensesPage.jsx";
import XmsInvoiceHandoffPage from "./pages/expense-management/pages/client-billing/InvoiceHandoffPage.jsx";
import XmsInvoiceStatusPage from "./pages/expense-management/pages/client-billing/InvoiceStatusPage.jsx";
import XmsExpenseCategoriesPage from "./pages/expense-management/pages/masters/CategoriesLedgerPage.jsx";
import XmsGlAccountsPage from "./pages/expense-management/pages/masters/GlAccountsPage.jsx";
import XmsCostCenterManagementPage from "./pages/expense-management/pages/masters/CostCenterManagementPage.jsx";
import XmsProjectsMasterPage from "./pages/expense-management/pages/masters/ProjectsMasterPage.jsx";
import XmsClientsMasterPage from "./pages/expense-management/pages/masters/ClientsMasterPage.jsx";
import XmsCurrencyManagementPage from "./pages/expense-management/pages/masters/CurrencyManagementPage.jsx";
import XmsTaxConfigurationPage from "./pages/expense-management/pages/masters/TaxConfigurationPage.jsx";
import XmsPolicyDashboardPage from "./pages/expense-management/pages/PolicyDashboard.jsx";
import XmsPolicyBundlesPage from "./pages/expense-management/pages/PolicyBundles.jsx";
import XmsPolicyRulesPage from "./pages/expense-management/pages/PolicyRules.jsx";
import XmsPolicyGroupsPage from "./pages/expense-management/pages/PolicyGroups.jsx";
import XmsPolicyAssignmentsPage from "./pages/expense-management/pages/PolicyAssignments.jsx";
import XmsSeverityThresholdPage from "./pages/expense-management/pages/SeverityThreshold.jsx";
import XmsPolicyVersionsPage from "./pages/expense-management/pages/PolicyVersions.jsx";
import { POLICY_VIEW_ROLES } from "./pages/expense-management/components/policy/common/policyEnums.js";
import XmsReportsPage from "./pages/expense-management/pages/reports/ReportsPage.jsx";
import XmsNotificationsPage from "./pages/expense-management/pages/activity/NotificationsPage.jsx";
import XmsAuditLogsPage from "./pages/expense-management/pages/activity/AuditLogsPage.jsx";
import XmsSettingsPage from "./pages/expense-management/pages/settings/SettingsPage.jsx";

// ✅ User Management
import CreateUser from "./pages/UserManagement/admin/userManagement/CreateUser";
import EditUser from "./pages/UserManagement/admin/userManagement/EditUser";
import UpdateUserRoles from "./pages/UserManagement/admin/userManagement/UpdateUserRoles";
import EditUserRoleForm from "./pages/UserManagement/admin/userManagement/EditUserRoleForm";
import UsersTable from "./pages/UserManagement/admin/userManagement/UsersTable";

// ✅ Roles & Permissions
import RoleManagement from "./pages/UserManagement/admin/roleManagement/RoleManagement";
import PermissionManagement from "./pages/UserManagement/admin/permissionManagement/PermissionManagement";
import PermissionGroupManagement from "./pages/UserManagement/admin/permissionGroupManagement/PermissionGroupManagement";
import GroupDetails from "./pages/UserManagement/admin/permissionGroupManagement/GroupDetails";

import AccessPointForm from "./pages/UserManagement/admin/accessPointManagement/AccessPointForm";
import AccessPointDetails from "./pages/UserManagement/admin/accessPointManagement/AccessPointDetails";
import AccessPointEdit from "./pages/UserManagement/admin/accessPointManagement/AccessPointEdit";
import AccessPointMapping from "./pages/UserManagement/admin/accessPointManagement/AccessPointMapping";
import AccessPointManagement from "./pages/UserManagement/admin/accessPointManagement/AccessPointManagement";
import BulkAccessPointCreate from "./pages/UserManagement/admin/accessPointManagement/BulkAccessPointCreate";
import BulkPermissionMapping from "./pages/UserManagement/admin/accessPointManagement/BulkPermissionMapping";
import Profile from "./pages/UserManagement/user/Profile";
import EditProfile from "./pages/UserManagement/user/EditProfile";

import Register from "./pages/UserManagement/auth/Register";
import InterviewFeedbackFormPage from "./pages/public/InterviewFeedbackFormPage.jsx";


// ✅ Leave Management
import EmployeePanel from "./pages/leave_management/EmployeePanel";
import AdminPanel from "./pages/leave_management/AdminPanel";
import HRManageTools from "./pages/leave_management/HRManageTools";
import EmployeeLeaveBalances from "./pages/leave_management/models/EmployeeLeaveBalances";
import Unauthorized from "./pages/leave_management/Unauthorized";
import EditHolidaysPage from "./pages/leave_management/models/EditHolidaysPage";
// import ManagerDashboard from "./pages/Timesheet/ManagerDashboard";
import LeavePolicy from "./pages/leave_management/models/LeavePolicy";
import LeaveDetailsPage from "./pages/leave_management/charts/LeaveDetailsPage";
import ManageBlockLeave from "./pages/leave_management/models/ManageBlockLeave";
// import ProtectedRoute from "./pages/leave_management/ProtectedRoutes";
import ApprovalRulesPage from "./pages/leave_management/models/ApprovalRulesPage.jsx";
import RiskRegisterPage from "./pages/Projects/manager/riskManagement/RiskRegisterPage.jsx";
import LeaveUploadWizard from "./pages/leave_management/models/LeaveUploadWizard.jsx";
import ApplyLeaveOnBehalf from "./pages/leave_management/models/ApplyLeaveOnBehalf.jsx";
import { JobProgressProvider, useJobProgress } from "./contexts/JobProgressContext.jsx";
import LeaveBalanceJobProgress from "./pages/leave_management/models/LeaveBalanceJobProgress.jsx";

import EmployeeExitDashboard from "./pages/employee-exit/EmployeeExitDashboard.jsx";
import ExitDetailsPage from "./pages/employee-exit/ExitDetailsPage.jsx";

import AccountReceivableLayout from "./pages/account_receivable/pages/AccountReceivableLayout.jsx";
import AccountReceivableDashboard from "./pages/account_receivable/pages/Dashboard.jsx";
import Overview from "./pages/account_receivable/pages/Overview.jsx";
import BillingConfigurations from "./pages/account_receivable/pages/BillingConfigurations.jsx";
import NewConfigurationWizard from "./pages/account_receivable/pages/NewConfigurationWizard.jsx";
import BillingApprovals from "./pages/account_receivable/pages/BillingApprovals.jsx";
import BillingDataAcquisition from "./pages/account_receivable/pages/BillingDataAcquisition.jsx";
import AcquisitionDetail from "./pages/account_receivable/pages/AcquisitionDetail.jsx";
import TaxCalculationPage from "./pages/account_receivable/pages/TaxCalculation.jsx";
import InvoiceGeneration from "./pages/account_receivable/pages/InvoiceGeneration.jsx";
import InvoiceDetail from "./pages/account_receivable/pages/InvoiceDetail.jsx";
import Configurations from "./pages/account_receivable/pages/Configurations.jsx";
import MasterDataOverview from "./pages/account_receivable/pages/master-data/MasterDataOverview.jsx";
import BillingTypeMasterPage from "./pages/account_receivable/pages/master-data/BillingTypeMasterPage.jsx";
import BillingFrequencyMasterPage from "./pages/account_receivable/pages/master-data/BillingFrequencyMasterPage.jsx";
import PaymentTermsMasterPage from "./pages/account_receivable/pages/master-data/PaymentTermsMasterPage.jsx";
import TaxConfigurationMasterPage from "./pages/account_receivable/pages/master-data/TaxConfigurationMasterPage.jsx";
import TaxConfigurationRegionDetailPage from "./pages/account_receivable/pages/master-data/TaxConfigurationRegionDetailPage.jsx";

import { showStatusToast } from "./components/toastfy/toast";
import { IdentificationIcon } from "@heroicons/react/24/outline";
import OnboardingDashboard from "./pages/employee-onboarding/onboarding-task/OnboardingDashboard.jsx";
import OnboardingSummaryPage from "./pages/employee-onboarding/summary-page/SummaryPage.jsx";



const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const isfirsttlogin = localStorage.getItem("isfirsttlogin");

  // console.log("isfirsttlogin:", isfirsttlogin);

  // ✅ Redirect if first login
  if (isfirsttlogin === "true") {
    logout();
    localStorage.setItem("isfirsttlogin", true);
    showStatusToast("Please change your password first.");
    return <Navigate to="/" replace />;
  }

  // ✅ If not authenticated, go to login
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  // ✅ Role-based restriction check
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowedRoles = allowedRoles.map((role) => role.toUpperCase());
    const hasRole = user?.roles?.some((role) =>
      normalizedAllowedRoles.includes(role.toUpperCase())
    );
    // console.log("ProtectedRoute check:", {
      // isAuthenticated,
      // user,
      // allowedRoles,
      // match: hasRole,
    // });

    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // ✅ Default: render protected content
  return <>{children}</>;
};

const SaveLastPath = () => {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== "/" && location.pathname !== "/login") {
      localStorage.setItem("lastPath", location.pathname + location.search);
    }
  }, [location]);
  return null;
};

// ✅ Project Manager Demo Layout
const ProjectManager = () => {
  const [showCreateProjectModal, setShowCreateProjectModal] =
    React.useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* <div className="flex-1 flex flex-col">
        <ProjectTabs selectedTab="summary" onTabSelect={() => {}} />
        <main className="flex-1 overflow-auto bg-white">
          <Summary project={null} tasks={[]} />
        </main>
      </div>

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onProjectCreated={() => {}}
      /> */}
    </div>
  );
};

const RoleOffEntry = () => {
  const { user } = useAuth();

  if (user?.roles?.includes("Resource_Manager")) {
    return <Navigate to="/resource-management/roleoff/rm" replace />;
  }

  if (user?.roles?.includes("Delivery_Manager")) {
    return <Navigate to="/resource-management/roleoff/dm" replace />;
  }

  return <Navigate to="/resource-management/roleoff/pm" replace />;
};

// ✅ Application Routes
const AppRoutes = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only perform auto-restoration if we are on the landing page or login redirect
    const currentPath = location.pathname;

    if (isAuthenticated && (currentPath === "/" || currentPath === "/login")) {
      const lastPath = localStorage.getItem("lastPath");

      if (lastPath === "/change-password" && currentPath !== "/change-password") {
        navigate("/change-password", { replace: true });
      }
      else if (lastPath && lastPath !== "/" && lastPath !== "/login" && lastPath !== currentPath) {
        navigate(lastPath, { replace: true });
      }
      else if (currentPath === "/") {
        if (user?.roles?.includes("Delivery_Manager")) {
          navigate("/resource-management/demand", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    }
  }, [isAuthenticated, user, navigate]); // Added user dependency

  return (
    <>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<Register />} />
        {/* Fully public, unauthenticated — no session, no app shell. See
            src/pages/public/InterviewFeedbackFormPage.jsx. */}
        <Route path="/interview-feedback/:token" element={<InterviewFeedbackFormPage />} />

        {/* Unauthorized should be here */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/change-password" element={<InitialPasswordSetup />} />
        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Main */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Finance Management landing page — reached via the Application Switcher */}
          <Route
            path="/finance/dashboard"
            element={
              <ProtectedRoute allowedRoles={FINANCE_ALL_ROLES}>
                <FinanceDashboard />
              </ProtectedRoute>
            }
          />

          {/* Accounts Payable — page skeletons only, business logic lands in later phases */}
          <Route
            path={AP_ROUTES.DASHBOARD}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <APDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.VENDOR_LIST}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <VendorListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.VENDOR_ONBOARD}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <VendorOnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.VENDOR_DETAIL()}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <VendorDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.VENDOR_UPDATE()}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <VendorUpdatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.INVOICE_UPLOAD}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <InvoiceUploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.INVOICE_OCR_REVIEW}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <InvoiceOcrReviewQueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.INVOICE_VALIDATION}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <InvoiceValidationQueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.INVOICE_LIST}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <InvoiceListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.INVOICE_DETAIL()}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <InvoiceDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.PAYMENT_QUEUE}
            element={
              <ProtectedRoute allowedRoles={["AP_Executive", "Admin", "Super_Admin"]}>
                <PaymentQueuePage />
              </ProtectedRoute>
            }
          />
          {/* <Route
            path={AP_ROUTES.PAYMENT_QUEUE_DETAIL()}
            element={
              <ProtectedRoute allowedRoles={["AP_Executive", "Admin", "Super_Admin"]}>
                <PaymentDetailsPage />
              </ProtectedRoute>
            }
          /> */}
          <Route
            path={AP_ROUTES.PAYMENT_READY}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <PaymentReadyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.PAYMENT_HISTORY}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <PaymentHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.PAYMENT_MARK_PAID()}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <PaymentMarkAsPaidPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.REPORTS}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <APReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.SETTINGS}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <APSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.SYSTEM_CONFIG}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES}>
                <SystemConfigurationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.PROCUREMENT}
            element={
              // AP_ALL_ROLES stays as the coarse "is this an AP user at all" gate; the real
              // Procurement authorization is the permission check layered on top — a user
              // needs at least one of the five *_VIEW permissions to land on this page (each
              // tab inside it is then independently gated by its own single permission).
              <ProtectedRoute allowedRoles={AP_ALL_ROLES} anyPermissions={PROCUREMENT_ANY_VIEW_PERMISSIONS}>
                <ProcurementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.PROCUREMENT_PR_DETAIL()}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES} permission={PROCUREMENT_PERMISSIONS.PR_VIEW}>
                <PrDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.PROCUREMENT_PO_DETAIL()}
            element={
              <ProtectedRoute allowedRoles={AP_ALL_ROLES} permission={PROCUREMENT_PERMISSIONS.PO_VIEW}>
                <PurchaseOrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={AP_ROUTES.PROCUREMENT_RFQ_DETAIL()}
            element={
              // RFQ is a sourcing/quotation activity — gated by QUOTATION_VIEW, the closest
              // matching permission (no dedicated RFQ permission exists in the UMS matrix).
              <ProtectedRoute allowedRoles={AP_ALL_ROLES} permission={PROCUREMENT_PERMISSIONS.QUOTATION_VIEW}>
                <RfqDetailPage />
              </ProtectedRoute>
            }
          />

          {/* <Route path="/projects/manager" element={<ProjectManager />} /> */}
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/timesheets" element={<TimesheetHistoryPage />} />
          {/* <Route path="/managerapproval" element={<ManagerApprovalPage />} /> */}
          <Route path="/managerapproval" element={<TSAdminPanel />} />
          <Route path="/timesheet/dashboard" element={<DashboardPage />} />
          <Route
            path="/timesheets/managerdashboard"
            element={<ManagerDashboard />}
          />
          <Route
            path="/timesheets/managerreport"
            element={<ManagerReportSection />}
          />
          <Route
            path="/timesheets/reportdashboard"
            element={<ReportDashboard />}
          />
          <Route
            path="/timesheets/managermonthlyreport"
            element={<ManagerMonthlyReport />}
          />
          <Route
            path="/timesheets/monthlytsreport"
            element={<MonthlyTSReport />}
          />
          <Route path="/timesheets/history" element={<TimesheetHistory />} />
          {/* Account Receivable — Maker (Finance Executive + Super Admin) vs
              Checker (Finance Manager + Super Admin). See AR_MAKER_ROLES /
              AR_CHECKER_ROLES in config/sidebarConfig.js: Super Admin keeps
              access to everything below unchanged; Finance Executive only
              gets the Maker (create/draft/submit) routes; Finance Manager
              only gets the Checker (billing-approvals) route. */}
          <Route path="/account-receivable" element={<AccountReceivableLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><AccountReceivableDashboard /></ProtectedRoute>} />
            <Route
              path="project-billing-setup"
              element={<Navigate to="overview" replace />}
            />
            <Route
              path="project-billing-setup/overview"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><Overview /></ProtectedRoute>}
            />
            <Route
              path="project-billing-setup/configurations"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><BillingConfigurations /></ProtectedRoute>}
            />
            <Route
              path="project-billing-setup/workspace"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><NewConfigurationWizard /></ProtectedRoute>}
            />
            <Route
              path="project-billing-setup/configurations/new"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><NewConfigurationWizard /></ProtectedRoute>}
            />
            <Route
              path="project-billing-setup/configurations/:configId"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><NewConfigurationWizard /></ProtectedRoute>}
            />
            <Route
              path="billing-approvals"
              element={<ProtectedRoute allowedRoles={AR_CHECKER_ROLES}><BillingApprovals /></ProtectedRoute>}
            />
            <Route
              path="billing-data-acquisition"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><BillingDataAcquisition /></ProtectedRoute>}
            />
            <Route
              path="billing-data-acquisition/workspace"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><BillingDataAcquisition /></ProtectedRoute>}
            />
            <Route
              path="billing-data-acquisition/:projectId"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><AcquisitionDetail /></ProtectedRoute>}
            />
            <Route
              path="tax-configuration"
              element={<Navigate to="/account-receivable/master-data/tax-configuration" replace />}
            />
            <Route
              path="tax-calculation"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><TaxCalculationPage /></ProtectedRoute>}
            />
            <Route
              path="tax-calculation/:snapshotId"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><TaxCalculationPage /></ProtectedRoute>}
            />
            <Route
              path="invoice-generation"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><InvoiceGeneration /></ProtectedRoute>}
            />
            <Route
              path="invoices/:snapshotId"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><InvoiceDetail /></ProtectedRoute>}
            />
            <Route
              path="configurations"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><Configurations /></ProtectedRoute>}
            />
            <Route
              path="configuration"
              element={<Navigate to="configurations" replace />}
            />
            {/* Configuration history removed — not supported by backend */}
            <Route
              path="master-data"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><MasterDataOverview /></ProtectedRoute>}
            />
            <Route
              path="master-data/billing-types"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><BillingTypeMasterPage /></ProtectedRoute>}
            />
            <Route
              path="master-data/billing-frequency"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><BillingFrequencyMasterPage /></ProtectedRoute>}
            />
            <Route
              path="master-data/payment-terms"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><PaymentTermsMasterPage /></ProtectedRoute>}
            />
            <Route
              path="master-data/tax-regions"
              element={<Navigate to="/account-receivable/master-data/tax-configuration" replace />}
            />
            <Route
              path="master-data/tax-configuration"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><TaxConfigurationMasterPage /></ProtectedRoute>}
            />
            <Route
              path="master-data/tax-configuration/:taxRegionId"
              element={<ProtectedRoute allowedRoles={AR_MAKER_ROLES}><TaxConfigurationRegionDetailPage /></ProtectedRoute>}
            />
          </Route>
          <Route path="/intranet-form" element={<IntranetForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          {/* Projects */}
          {/* <Route path="/projects/dashboard" element={<AdminDashboard />} /> */}

          <Route
            path="/projects"
            element={

              <ProjectDashboard />

            }
          />

          <Route path="/projects" element={<ProjectManager />} />
          <Route path="/projects/:projectId" element={<ProjectTabs />} />
          <Route path="/projects/list" element={<ProjectList />} />

          <Route
            path="/projects/:projectId/issuetracker"
            element={<IssueTracker />}
          />
          <Route
            path="/projects/:projectId/cycles/runs/:runId/test-runs"
            element={<AddCasesFromProjectModal />}
          />

          <Route
            path="/projects/:projectId/cycles/:cycleId/runs"
            element={<CycleRunsPage />}
          />


          <Route path="/projects/admin" element={<ProjectManager />} />


          <Route
            path="/projects/:projectId/issues/:type/:id/view"
            element={<ViewSheet />}
          />
          <Route
            path="/projects/:projectId/status-report"
            element={<ProjectStatusReportWrapper />}
          />
          <Route
            path="/projects/:projectId/risk-management"
            element={<RiskRegisterPage />}
          />
          <Route
            path="/projects/:projectId/risk-management"
            element={<RiskRegisterPage />}
          />
          <Route path="/my-work" element={<MyWorkPage />} />
          {/* Employee Onboarding */}

          {/* <Route path="/employee-onboarding" element={<EmpDashboard />}/>
          <Route path="/employee-onboarding/onboarding-task" element={<OnboardingTask />} />
          <Route path="/employee-onboarding/employee-directory" element={<EmployeeDirectory />} />
          <Route path="/employee-onboarding/employee-verification" element={<EmployeeVerification />} />
          <Route path="/employee-onboarding/employee-documents-template" element={<EmployeeDocumentsTemplate />} />
          <Route path = "/employee-onboarding/organization-tree" element={<OrganizationTree />} />
          <Route path = "/employee-onboarding/organization-tree" element={<OrganizationTree />} />
          <Route path="/employee-onboarding/summary-page" element={<SummaryPage />} />
          <Route path="analytics" element={<HeadcountDemographicsPage />} />
          <Route path="/employee-onboarding/offer/:user_uuid" element={<ViewEmpDetails />}/>
          <Route path="/employee-onboarding/employeeProfile" element={<EmployeeProfileView />}/>
          <Route path="/employee-onboarding" element={<EmpDashboard />} />
          <Route path="/employee-onboarding/create" element={<CreateOffer />} />
          <Route path="/employee-onboarding/bulk-upload" element={<BulkUpload />}/>
          <Route path="/employee-onboarding/hr-configuration/country" element={<CountryManagement />}/>
          <Route path="/employee-onboarding/hr-configuration" element={<HrConfiguration />}/>
          <Route path="/employee-onboarding/hr-configuration/identity" element={<IdentityTypeManagement />}/>
          <Route path="/employee-onboarding/hr-configuration/mapping" element={<CountryIdentityMapping />}/>
          <Route path="/employee-onboarding/hr-configuration/education" element={<EducationDashboard />}/>
          <Route path="/employee-onboarding/hr-configuration/education/levels" element={<EducationLevelManagement />}/>
          <Route path="/employee-onboarding/hr-configuration/education/documents" element={<EducationDocumentManagement />}/>
          <Route path="/employee-onboarding/hr-configuration/education/mapping" element={<CountryEducationMapping />}/>
          <Route path="/employee-onboarding/admin/approval-dashboard" element={<AdminApprovalDashboard />}/>
          <Route path="/employee-onboarding/admin/offer/:user_uuid" element={<AdminOfferView />}/>
          <Route path="/employee-onboarding/hr" element={<HrOnboardingDashboard />}/>
          <Route path="/employee-onboarding/hr/profile/:user_uuid" element={<HrProfileView />}/>
          <Route path="/employee-onboarding/analytics" element={<HeadcountDemographicsPage />}/>
          <Route path="/employee-onboarding/employeelist" element={<EmployeeListPage/>}/>
          <Route path="/employee-onboarding/employeedocuments" element={<EmployeeDocuments/>}/>
          <Route path="/employee-onboarding/employee-credentials" element={<EmployeeCredentials/>}/>
          <Route path="/employee-onboarding/core-employee" element={<CoreEmployeeDetails/>}/> */}

          {/* Employee Onboarding */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/employee-onboarding/*" element={<EmployeeOnboardingLayout />}>

            <Route index element={
              <ProtectedRoute roles={["HR", "MANAGER"]}>
                <EmpDashboard />
              </ProtectedRoute>
            }
            />

            <Route path="create" element={<ProtectedRoute roles={["HR"]}><CreateOffer /></ProtectedRoute>} />
            <Route path="bulk-upload" element={<ProtectedRoute roles={["HR"]}><BulkUpload /></ProtectedRoute>} />
            <Route path="onboarding-task" element={<ProtectedRoute roles={["HR", "MANAGER", "ADMIN"]}><OnboardingTask /></ProtectedRoute>} />

            <Route path="hr-configuration" element={<ProtectedRoute roles={["HR", "ADMIN"]}><HrConfiguration /></ProtectedRoute>} />
            <Route path="hr-configuration/country" element={<ProtectedRoute roles={["HR", "ADMIN"]}><CountryManagement /></ProtectedRoute>} />
            <Route path="hr-configuration/identity" element={<ProtectedRoute roles={["HR", "ADMIN"]}><IdentityTypeManagement /></ProtectedRoute>} />
            <Route path="hr-configuration/mapping" element={<ProtectedRoute roles={["HR", "ADMIN"]}><CountryIdentityMapping /></ProtectedRoute>} />
            <Route path="hr-configuration/education" element={<ProtectedRoute roles={["HR", "ADMIN"]}><EducationDashboard /></ProtectedRoute>} />
            <Route path="hr-configuration/education/levels" element={<ProtectedRoute roles={["HR", "ADMIN"]}><EducationLevelManagement /></ProtectedRoute>} />
            <Route path="hr-configuration/education/documents" element={<ProtectedRoute roles={["HR", "ADMIN"]}><EducationDocumentManagement /></ProtectedRoute>} />
            <Route path="hr-configuration/education/mapping" element={<ProtectedRoute roles={["HR", "ADMIN"]}><CountryEducationMapping /></ProtectedRoute>} />
            <Route path="hr-configuration/departments" element={<ProtectedRoute roles={["HR", "ADMIN"]}><DepartmentsMappingDashboard /></ProtectedRoute>} />
            <Route path="hr-configuration/departments/departmentsList" element={<ProtectedRoute roles={["HR", "ADMIN"]}><DepartmentsList /></ProtectedRoute>} />
            <Route path="hr-configuration/departments/designationsList" element={<ProtectedRoute roles={["HR", "ADMIN"]}><DesignationsList /></ProtectedRoute>} />
            <Route path="hr-configuration/education/degrees" element={<ProtectedRoute roles={["HR", "ADMIN"]}><DegreeMasterManagement /></ProtectedRoute>} />


            <Route path="hr" element={<ProtectedRoute roles={["HR"]}><HrOnboardingDashboard /></ProtectedRoute>} />
            <Route path="hr/profile/:user_uuid" element={<ProtectedRoute roles={["HR"]}><HrProfileView /></ProtectedRoute>} />
            <Route path="backgroundcheck" element={<ProtectedRoute roles={["HR"]}><BackgroundCheckPage /></ProtectedRoute>} />

            <Route path="admin/approval-dashboard" element={<ProtectedRoute roles={["ADMIN", "HR"]}><AdminApprovalDashboard /></ProtectedRoute>} />
            <Route path="admin/offer/:user_uuid" element={<ProtectedRoute roles={["ADMIN", "HR"]}><AdminOfferView /></ProtectedRoute>} />
            <Route path="admin/offer-letters" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminOfferLettersDashboard /></ProtectedRoute>} />

            <Route path="employee-directory" element={<ProtectedRoute ><EmployeeDirectory /></ProtectedRoute>} />
            <Route path="employeelist" element={<ProtectedRoute ><EmployeeListPage /></ProtectedRoute>} />
            <Route path="organization-tree" element={<ProtectedRoute ><OrganizationTree /></ProtectedRoute>} />

            <Route path="employee-verification" element={<ProtectedRoute roles={["HR", "MANAGER"]}><EmployeeVerification /></ProtectedRoute>} />
            <Route path="employee-documents-template" element={<ProtectedRoute roles={["HR"]}><EmployeeDocumentsTemplate /></ProtectedRoute>} />
            <Route path="employeedocuments" element={<ProtectedRoute roles={["HR", "MANAGER"]}><EmployeeDocumentsPage /></ProtectedRoute>} />
            {/* <Route path="employee-credentials" element={<ProtectedRoute roles={["HR","MANAGER"]}><EmployeeCredentials /></ProtectedRoute>} /> */}
            <Route path="employeeProfile" element={<ProtectedRoute ><EmployeeProfileView /></ProtectedRoute>} />
            <Route path="employeeProfile/:employee_uuid" element={<ProtectedRoute ><EmployeeProfileView /></ProtectedRoute>}></Route>
            <Route path="core-employee" element={<ProtectedRoute roles={["HR", "MANAGER"]}><CoreEmployeeDetails /></ProtectedRoute>} />
            <Route path="employee-onboarding/core-employee/create/:userUuid" element={<CoreEmployeeDetails />} />

            <Route path="summary-page" element={<ProtectedRoute roles={["HR", "MANAGER", "ADMIN"]}><SummaryPage /></ProtectedRoute>} />
            <Route path="onboarding-summary" element={<OnboardingSummary />} />
            <Route path="analytics" element={<ProtectedRoute roles={["HR", "MANAGER"]}><HeadcountDemographicsPage /></ProtectedRoute>} />

            <Route path="weekly-joining-report-dashboard" element={<ProtectedRoute roles={["HR", "MANAGER"]}><WeeklyJoiningDashboard /></ProtectedRoute>} />
            <Route path="manage-skill-taxonomy" element={<ProtectedRoute allowedRoles={["ADMIN"]}><ManageSkillTaxonomy /></ProtectedRoute>} />
            <Route path="manage-skill-taxonomy/requests" element={<ProtectedRoute allowedRoles={["ADMIN"]}><ManageSkillTaxonomy /></ProtectedRoute>} />
            <Route path="manage-skill-taxonomy/certificates" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AddCertificate /></ProtectedRoute>} />
            <Route path="manage-skill-taxonomy/certificates/general" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AddCertificate /></ProtectedRoute>} />
            <Route path="document-templates" element={<ProtectedRoute roles={["HR"]}><DocumentTemplates /></ProtectedRoute>} />
            <Route path="offer/:user_uuid" element={<ViewEmpDetails />} />
            <Route path="offer-preview/:offerId" element={<OfferPreview />} />
            <Route path="final-offer-preview/:offerId" element={<FinalOfferPreview />} />
            <Route path="offer-generated-preview/:offerId" element={<OfferGeneratedPreview />} />



          </Route>
          {/* User Management */}
          <Route path="/user-management/users" element={<UsersTable />} />
          <Route
            path="/user-management/users/create"
            element={<CreateUser />}
          />
          <Route
            path="/user-management/users/edit/:id"
            element={<EditUser />}
          />
          <Route
            path="/user-management/users/roles"
            element={<UpdateUserRoles />}
          />
          <Route
            path="/user-management/roles/edit-role/:userId"
            element={<EditUserRoleForm />}
          />
          <Route path="/user-management/roles" element={<RoleManagement />} />
          <Route
            path="/user-management/permissions"
            element={<PermissionManagement />}
          />
          <Route
            path="/user-management/groups"
            element={<PermissionGroupManagement />}
          />
          <Route
            path="/user-management/groups/:groupId"
            element={<GroupDetails />}
          />
          <Route
            path="/user-management/access-points"
            element={<AccessPointManagement />}
          />
          <Route
            path="/user-management/access-points/create"
            element={<AccessPointForm />}
          />
          <Route
            path="/user-management/access-points/:access_uuid"
            element={<AccessPointDetails />}
          />
          <Route
            path="/user-management/access-points/edit/:access_uuid"
            element={<AccessPointEdit />}
          />
          <Route
            path="/user-management/access-points/admin/access-point-mapping"
            element={<AccessPointMapping />}
          />
          <Route
            path="/user-management/access-points/create-bulk"
            element={<BulkAccessPointCreate />}
          />
          <Route
            path="/user-management/access-point-map-permission-bulk"
            element={<BulkPermissionMapping />}
          />
          {/* <Route
            path="/user-management/users"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <UsersTable />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/users/create"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <CreateUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/users/edit/:id"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <EditUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/users/roles"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <UpdateUserRoles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/roles/edit-role/:userId"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <EditUserRoleForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/roles"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <RoleManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/permissions"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <PermissionManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/groups"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <PermissionGroupManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/groups/:groupId"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <GroupDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/access-points"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <AccessPointManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/access-points/create"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <AccessPointForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/access-points/:access_id"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <AccessPointDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/access-points/edit/:access_id"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <AccessPointEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/access-points/admin/access-point-mapping"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}>
                <AccessPointMapping />
              </ProtectedRoute>
            }
          /> */}
          {/* Leave Management */}
          <Route
            path="/leave-management"
            element={
              <ProtectedRoute
                allowedRoles={["General", "HR", "Manager", "Hr-Manager", "Super_Admin", "Admin"]}
              >
                <EmployeePanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leave-management/manager"
            element={
              <ProtectedRoute allowedRoles={["Manager"]}>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leave-management/hr"
            element={
              <ProtectedRoute allowedRoles={["HR", "Super_Admin", "Admin"]}>
                <HRManageTools />
              </ProtectedRoute>
            }
          />
          <Route
            path={`/employee-leave-balance`}
            element={
              <ProtectedRoute allowedRoles={["HR"]}>
                <EmployeeLeaveBalances />
              </ProtectedRoute>
            }
          />
          <Route
            path={`/edit-holidays`}
            element={
              <ProtectedRoute allowedRoles={["HR"]}>
                <EditHolidaysPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={`/block-leave-dates/:employeeId`}
            element={
              <ProtectedRoute allowedRoles={["Manager", "Super_Admin", "Admin"]}>
                <ManageBlockLeave />
              </ProtectedRoute>
            }
          />
          <Route
            path={`/leave-upload`}
            element={
              <ProtectedRoute allowedRoles={["HR", "Super_Admin", "Admin"]}>
                <LeaveUploadWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leave-policy"
            element={
              <ProtectedRoute allowedRoles={["HR", "Super_Admin", "Admin", "Manager", "Hr-Manager", "General", "Reporting_manager"]}>
                <LeavePolicy />
              </ProtectedRoute>
            }
          />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path={`/leave-details/:employeeId/:leaveName`}
            element={
              <ProtectedRoute allowedRoles={["General", "Super_Admin", "Admin"]}>
                <LeaveDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/approval-rules"
            element={
              <ProtectedRoute allowedRoles={["HR", "Hr-Manager", "Super_Admin", "Admin"]}>
                <ApprovalRulesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/behalf-leave"
            element={
              <ProtectedRoute allowedRoles={["HR", "Hr-Manager", "Manager", "Super_Admin", "Admin"]}>
                <ApplyLeaveOnBehalf />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leave-policies"
            element={
              <Navigate
                to="https://celebrated-renewal-07a16fae8e.strapiapp.com"
                replace
              />
            }
          />
          {/* Resource Management */}
          <Route
            path="/resource-management"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <AdminPannel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/bench"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <BenchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/bench/report"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <BenchPoolDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/bench/utilization-performance"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <UtilizationPerformanceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/bench/utilization-performance/projects/:projectId"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <OperationalProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/bench/utilization-reporting"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <UtilizationReportingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/client-details/:clientId"
            element={
              <ProtectedRoute
                allowedRoles={["General", "HR", "Manager", "Hr-Manager"]}
              >
                <ClientPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assets/:clientId/:assetId"
            element={
              <ProtectedRoute
                allowedRoles={["General", "HR", "Manager", "Hr-Manager"]}
              >
                <AssetDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-assets/:clientId"
            element={
              <ProtectedRoute
                allowedRoles={["General", "HR", "Manager", "Hr-Manager"]}
              >
                <AssetList />
              </ProtectedRoute>
            }
          />


          <Route
            path="/resource-management/projects"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <RMSProjectList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/projects/:projectId"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <RMSProjectDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/workforce-availability"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <WorkforceAvailability />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/workforce-availability/resource/:resourceId"
            element={
              <ProtectedRoute allowedRoles={["Admin", "Resource_Manager"]}>
                <ResourceIntelligenceCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/demand"
            element={
              <ProtectedRoute allowedRoles={["Resource_Manager", "Delivery_Manager", "Admin", "Super_Admin"]}>
                <DemandWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/demand/:demandId"
            element={
              <ProtectedRoute allowedRoles={["Resource_Manager", "Delivery_Manager", "Admin", "Super_Admin"]}>
                <DemandDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/roleoff"
            element={
              <ProtectedRoute allowedRoles={["Project_Manager", "Resource_Manager", "Delivery_Manager", "Admin", "Super_Admin"]}>
                <RoleOffEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/roleoff/pm"
            element={
              <ProtectedRoute allowedRoles={["Project_Manager"]}>
                <PMRoleOffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/roleoff/rm"
            element={
              <ProtectedRoute allowedRoles={["Resource_Manager"]}>
                <RMRoleOffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource-management/roleoff/dm"
            element={
              <ProtectedRoute allowedRoles={["Delivery_Manager"]}>
                <DMRoleOffPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/resource-management/roleoff/report"
            element={
              <ProtectedRoute allowedRoles={["Project_Manager", "Resource_Manager", "Delivery_Manager"]}>
                <RoleOffDashboard />
              </ProtectedRoute>
            }
          />          {/* AI Screening (AIRS) Routes */}
          <Route
            path="/ai-screening/dashboard"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN", "RECRUITER", "HIRING_MANAGER"]}>
                <RecruiterDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/jds"
            element={
              <ProtectedRoute roles={["General"]}>
                <JdLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/jds/create"
            element={
              <ProtectedRoute roles={["General"]}>
                <JdCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/jds/:id"
            element={
              <ProtectedRoute roles={["General"]}>
                <JdDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/campaigns"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN", "RECRUITER", "HIRING_MANAGER"]}>
                <Campaigns />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/campaigns/:id"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN", "RECRUITER", "HIRING_MANAGER"]}>
                <CampaignDetails />
              </ProtectedRoute>
            }
          />
          {/* Was a tab inside CampaignDetails.jsx — moved to its own page with
              a campaign selector. Same roles that could see that tab
              (canSeePipeline = HR_ADMIN/RECRUITER); HIRING_MANAGER is
              deliberately excluded, matching the tab's old visibility. */}
          <Route
            path="/ai-screening/interview-calendar"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN", "RECRUITER"]}>
                <InterviewCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/resume-intake"
            element={
              <ProtectedRoute roles={["General"]}>
                <ResumeIntakePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/resume-intake/new"
            element={
              <ProtectedRoute roles={["General"]}>
                <IntakeFlowPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/resume-intake/review/:candidateId"
            element={
              <ProtectedRoute roles={["General"]}>
                <ReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/candidates"
            element={
              <ProtectedRoute roles={["General"]}>
                <CandidateRankingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/candidates/:candidateId"
            element={
              <ProtectedRoute roles={["General"]}>
                <CandidateScorePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/interview-queue"
            element={
              <ProtectedRoute allowedRoles={["HIRING_MANAGER", "HR_ADMIN"]}>
                <InterviewQueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/pipeline"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN", "RECRUITER", "HIRING_MANAGER"]}>
                <PipelineBoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/pipeline/candidates/:candidateId"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN", "RECRUITER", "HIRING_MANAGER"]}>
                <PipelineCandidateScorecardPage />
              </ProtectedRoute>
            }
          />
          {/* Global Candidate Directory (GET /candidates) — distinct from
              /ai-screening/candidates below, which is the campaign-scoped
              Candidates & Ranking page. HR_ADMIN only, matching the
              backend's require_roles(UserRole.HR_ADMIN) on this endpoint. */}
          <Route
            path="/ai-screening/global-candidates"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
                <GlobalCandidatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/talent-pool"
            element={
              <ProtectedRoute roles={["General"]}>
                <TalentPoolPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/talent-pool/:candidateId"
            element={
              <ProtectedRoute roles={["General"]}>
                <TalentPoolCandidateProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/analytics"
            element={
              <ProtectedRoute roles={["General"]}>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/settings"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/skill-ontology"
            element={
              <ProtectedRoute roles={["General"]}>
                <SkillOntologyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/skill-ontology/hierarchy"
            element={
              <ProtectedRoute roles={["General"]}>
                <HierarchyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/skill-ontology/:skillId"
            element={
              <ProtectedRoute roles={["General"]}>
                <SkillDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/skill-ontology/unknown/:unknownSkillId"
            element={
              <ProtectedRoute roles={["General"]}>
                <UnknownSkillDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Prompt Templates — HR_ADMIN only. Uses ProtectedRoute's working
              `allowedRoles` prop (see the note on the Campaign routes above),
              so this module has real route-level RBAC enforcement. Create/Edit
              are modals opened from the list/view pages (see
              AddPromptTemplateModal/EditPromptTemplateModal), matching the
              skill-ontology module's pattern — only List and View are routed. */}
          <Route
            path="/ai-screening/prompt-templates"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
                <PromptTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-screening/prompt-templates/:id/view"
            element={
              <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
                <PromptTemplateViewPage />
              </ProtectedRoute>
            }
          />

          {/* employee exit routes*/}

          <Route element={<EmployeeOnboardingLayout />}>
            <Route path="/employee-exit" element={<EmployeeExitDashboard />} />
            <Route path="/employee-exit/:exit_uuid" element={<ExitDetailsPage />} />
          </Route>

          {/* Expense Management (XMS) */}
          <Route path="/expense-management/dashboard" element={<ProtectedRoute allowedRoles={["General", "Manager", "Finance", "Admin", "Super_Admin"]}><XmsDashboardPage /></ProtectedRoute>} />

          <Route path="/expense-management/expenses/create" element={<ProtectedRoute allowedRoles={["General", "Manager"]}><XmsCreateExpensePage /></ProtectedRoute>} />
          <Route path="/expense-management/expenses/my" element={<ProtectedRoute allowedRoles={["General", "Manager"]}><XmsMyExpensesPage /></ProtectedRoute>} />
          <Route path="/expense-management/expenses/reports/:reportId" element={<ProtectedRoute allowedRoles={["General", "Manager"]}><XmsExpenseReportDetailPage /></ProtectedRoute>} />
          <Route path="/expense-management/expenses/all" element={<ProtectedRoute allowedRoles={["Manager"]}><XmsAllExpensesPage /></ProtectedRoute>} />
          <Route path="/expense-management/expenses/reports" element={<ProtectedRoute allowedRoles={["Manager"]}><XmsExpenseReportsPage /></ProtectedRoute>} />

          <Route path="/expense-management/receipts/library" element={<ProtectedRoute allowedRoles={["General"]}><XmsReceiptLibraryPage /></ProtectedRoute>} />
          <Route path="/expense-management/receipts/ocr-processing" element={<ProtectedRoute allowedRoles={["General"]}><XmsOcrProcessingPage /></ProtectedRoute>} />

          <Route path="/expense-management/cash-advance/request" element={<ProtectedRoute allowedRoles={["General"]}><XmsRequestAdvancePage /></ProtectedRoute>} />
          <Route path="/expense-management/cash-advance/my" element={<ProtectedRoute allowedRoles={["General"]}><XmsMyAdvancesPage /></ProtectedRoute>} />
          <Route path="/expense-management/cash-advance/settlement" element={<ProtectedRoute allowedRoles={["General"]}><XmsSettlementPage /></ProtectedRoute>} />

          {/* No role gate (§1.5): any employee can be a resolved approver (NAMED_USER/DEPARTMENT_OWNER/
              COST_CENTER_OWNER), not just "Manager" - the backend itself has no role restriction on
              these endpoints either, "My Approvals" is presence-based, not role-based. */}
          <Route path="/expense-management/approvals/pending" element={<Navigate to="/expense-management/approvals" replace />} />
          <Route path="/expense-management/approvals/approved" element={<Navigate to="/expense-management/approvals" replace />} />
          <Route path="/expense-management/approvals/rejected" element={<Navigate to="/expense-management/approvals" replace />} />
          <Route path="/expense-management/approvals" element={<ProtectedRoute><XmsApprovalsPage /></ProtectedRoute>} />

          {/* Approval Rules (Admin config) - ADMIN-only, matching the Masters section's own role gate. */}
          <Route path="/expense-management/approval-rules/flows" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsApprovalFlowsPage /></ProtectedRoute>} />
          <Route path="/expense-management/approval-rules/flows/new" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsApprovalFlowBuilderPage /></ProtectedRoute>} />
          <Route path="/expense-management/approval-rules/flows/:flowId/edit" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsApprovalFlowBuilderPage /></ProtectedRoute>} />
          <Route path="/expense-management/approval-rules/catch-all" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsCatchAllFlowPage /></ProtectedRoute>} />
          <Route path="/expense-management/approval-rules/department-approvers" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsDepartmentApproversPage /></ProtectedRoute>} />
          <Route path="/expense-management/approval-rules/delegations" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsDelegationsPage /></ProtectedRoute>} />

          <Route path="/expense-management/finance/verification" element={<ProtectedRoute allowedRoles={["Finance", "Finance_Executive"]}><XmsVerificationPage /></ProtectedRoute>} />
          <Route path="/expense-management/finance/reimbursements" element={<ProtectedRoute allowedRoles={["Finance", "Finance_Executive"]}><XmsReimbursementsPage /></ProtectedRoute>} />
          <Route path="/expense-management/finance/payment-status" element={<ProtectedRoute allowedRoles={["Finance", "Finance_Executive"]}><XmsPaymentStatusPage /></ProtectedRoute>} />
          <Route path="/expense-management/ap-payments/queue" element={<ProtectedRoute allowedRoles={["AP_Executive"]}><XmsApPaymentQueuePage /></ProtectedRoute>} />

          <Route path="/expense-management/client-billing/billable-expenses" element={<ProtectedRoute allowedRoles={["Finance", "Finance_Executive"]}><XmsBillableExpensesPage /></ProtectedRoute>} />
          <Route path="/expense-management/client-billing/invoice-handoff" element={<ProtectedRoute allowedRoles={["Finance", "Finance_Executive"]}><XmsInvoiceHandoffPage /></ProtectedRoute>} />
          <Route path="/expense-management/client-billing/invoice-status" element={<ProtectedRoute allowedRoles={["Finance", "Finance_Executive"]}><XmsInvoiceStatusPage /></ProtectedRoute>} />

          <Route path="/expense-management/masters/expense-categories" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsExpenseCategoriesPage /></ProtectedRoute>} />
          <Route path="/expense-management/masters/gl-accounts" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsGlAccountsPage /></ProtectedRoute>} />
          <Route path="/expense-management/masters/cost-center-management" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsCostCenterManagementPage /></ProtectedRoute>} />
          <Route path="/expense-management/masters/projects" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsProjectsMasterPage /></ProtectedRoute>} />
          <Route path="/expense-management/masters/clients" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsClientsMasterPage /></ProtectedRoute>} />
          <Route path="/expense-management/masters/currency-management" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsCurrencyManagementPage /></ProtectedRoute>} />
          <Route path="/expense-management/masters/tax-configuration" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsTaxConfigurationPage /></ProtectedRoute>} />

          <Route path="/expense-management/policy-engine/dashboard" element={<ProtectedRoute allowedRoles={POLICY_VIEW_ROLES}><XmsPolicyDashboardPage /></ProtectedRoute>} />
          <Route path="/expense-management/policy-engine/bundles" element={<ProtectedRoute allowedRoles={POLICY_VIEW_ROLES}><XmsPolicyBundlesPage /></ProtectedRoute>} />
          <Route path="/expense-management/policy-engine/rules" element={<ProtectedRoute allowedRoles={POLICY_VIEW_ROLES}><XmsPolicyRulesPage /></ProtectedRoute>} />
          <Route path="/expense-management/policy-engine/groups" element={<ProtectedRoute allowedRoles={POLICY_VIEW_ROLES}><XmsPolicyGroupsPage /></ProtectedRoute>} />
          <Route path="/expense-management/policy-engine/assignments" element={<ProtectedRoute allowedRoles={POLICY_VIEW_ROLES}><XmsPolicyAssignmentsPage /></ProtectedRoute>} />
          <Route path="/expense-management/policy-engine/severity-thresholds" element={<ProtectedRoute allowedRoles={POLICY_VIEW_ROLES}><XmsSeverityThresholdPage /></ProtectedRoute>} />
          <Route path="/expense-management/policy-engine/versions" element={<ProtectedRoute allowedRoles={POLICY_VIEW_ROLES}><XmsPolicyVersionsPage /></ProtectedRoute>} />
          <Route path="/expense-management/reports" element={<ProtectedRoute allowedRoles={["Manager", "Finance", "Admin", "Super_Admin"]}><XmsReportsPage /></ProtectedRoute>} />

          <Route path="/expense-management/activity/notifications" element={<ProtectedRoute allowedRoles={["General", "Manager", "Finance", "Admin", "Super_Admin"]}><XmsNotificationsPage /></ProtectedRoute>} />
          <Route path="/expense-management/activity/audit-logs" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsAuditLogsPage /></ProtectedRoute>} />

          <Route path="/expense-management/settings" element={<ProtectedRoute allowedRoles={["Admin", "Super_Admin"]}><XmsSettingsPage /></ProtectedRoute>} />
        </Route>
      </Routes>
      <SaveLastPath />
    </>
  );
};

// add this just above the App function at the bottom of the file
const AppJobProgress = () => {
  const { activeJobId, clearJob } = useJobProgress();

  if (!activeJobId) return null;

  return (
    <LeaveBalanceJobProgress
      jobId={activeJobId}
      onClose={clearJob}
    />
  );
};

// 🚀 App Entry Point
function App() {
  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} style={{ zIndex: 999999 }} />
      <Router basename={window.__APP_CONFIG__.basePath}>
        <></>
        <AuthProvider>
          <NotificationProvider>
            <JobProgressProvider>
              <div className="min-h-screen bg-gray-50">
                <AppRoutes />
              </div>
            </JobProgressProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;


