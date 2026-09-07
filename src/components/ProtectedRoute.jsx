import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Accepts `roles` and `allowedRoles` as equivalent. Both spellings are in use
// across App.jsx; previously only `roles` was read, so every route declaring
// `allowedRoles` silently fell through to an authentication-only check with no
// role enforcement at all.
//
// Permission-based checks (`permission`, `anyPermissions`, `allPermissions`) are additive —
// existing role-only routes are unaffected since these default to falsy/empty. A route may
// combine a role gate with a permission gate (e.g. AP_ALL_ROLES as a coarse module boundary,
// plus a specific UMS permission for the exact page) — both must pass.
export default function ProtectedRoute({
  roles = [],
  allowedRoles = [],
  permission,
  anyPermissions = [],
  allPermissions = [],
  children,
}) {
  const { isAuthenticated, hasRole, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const requiredRoles = roles.length > 0 ? roles : allowedRoles;

  // Not logged in → login
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Logged in but lacking the role → unauthorized
  if (requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (anyPermissions.length > 0 && !hasAnyPermission(anyPermissions)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allPermissions.length > 0 && !hasAllPermissions(allPermissions)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}