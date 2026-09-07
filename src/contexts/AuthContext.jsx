// src/contexts/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import { showStatusToast } from "../components/toastfy/toast";
import axios from "axios";
import { useWebSocket } from "../pages/leave_management/websockets/WebSocketProvider";
import { useApprovalWebSocket } from "../pages/expense-management/approval-engine/websocket/ApprovalWebSocketProvider";

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const { updateToken } = useWebSocket();
  const { updateToken: updateApprovalToken } = useApprovalWebSocket() ?? {};
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isfirsttlogin, setIsfirsttlogin] = useState(false);
  const isLoggingOut = useRef(false);

  const loadUser = (token) => {
    try {
      const decoded = jwtDecode(token);
      setUser(decoded);
      setIsAuthenticated(true);
    } catch {
      showStatusToast("Invalid or tampered token. Please login again.");
      logout(true);
    }
  };

  // ✅ stores access token + refresh token
  const login = (token, isFirstLogin = false) => {
    if (isFirstLogin) {
      localStorage.setItem("lastPath", "/change-password");
      setIsfirsttlogin(true);
      localStorage.setItem("isfirsttlogin", true);
    } else {
      localStorage.setItem("lastPath", "/dashboard");
    }

    // store access token — axiosInstance reads this key
    localStorage.setItem("token", token);

    loadUser(token);
    updateApprovalToken?.(token);
  };

  const logout = (expired = false) => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

// blacklist both tokens on backend
    if (localStorage.getItem("token")) {

      axios.post(
      `${window.__APP_CONFIG__.USER_MANAGEMENT_URL}/auth/logout`,
      {},
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      },
    )
        .then((res) => {
          // console.log("Logout:", res.data)
        })
        .catch((err) => console.error("Logout failed:", err.response?.data || err.message));
    }

    // clear all auth keys
    localStorage.removeItem("token");
    // localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("lastPath");
    updateToken(null);
    updateApprovalToken?.(null);

    if (localStorage.getItem("isfirsttlogin")) {
      localStorage.removeItem("isfirsttlogin");
      setIsfirsttlogin(false);
    }

    setUser(null);
    setIsAuthenticated(false);

    if (expired) {
      navigate("/", { replace: true });
    }

    setTimeout(() => {
      isLoggingOut.current = false;
    }, 2000);
  };

  // ✅ single useEffect on mount — restore session from localStorage
  // also sets expiry timer (interceptor handles actual refresh)
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    try {
      const decoded = jwtDecode(token);

      loadUser(token);

      if (decoded.exp) {
        const timeLeft = decoded.exp - Date.now() / 1000;

        // IMPORTANT:
        // Do NOT logout immediately if token expired.
        // Axios interceptor will silently refresh token.
        if (timeLeft <= 0) {
          return;
        }

        const timer = setTimeout(() => {
          // console.log("Access token expired.");
        }, timeLeft * 1000);

        return () => clearTimeout(timer);
      }

    } catch {
      showStatusToast("Invalid token detected. Please login again.");
      logout(true);
    }
  }, []);

  const getUserRoles = () => {
    if (!user) return [];
    const roles = user.roles || user.role || [];
    if (!roles) return [];
    if (Array.isArray(roles)) return roles.map((r) => r.toUpperCase());
    return roles.split(",").map((r) => r.trim().toUpperCase());
  };

  const hasRole = (allowedRoles) => {
    const userRoles = getUserRoles();
    return allowedRoles.some((role) => userRoles.includes(role.toUpperCase()));
  };

  // Permissions are a separate JWT claim from roles — UMS is the source of truth for which
  // permissions a role maps to, so the frontend never encodes that mapping itself; it only
  // reads whatever flat permission-code array (e.g. "PR_VIEW", "PR_APPROVE") the token carries.
  const getUserPermissions = () => {
    if (!user) return [];
    const permissions = user.permissions || [];
    if (!Array.isArray(permissions)) return [];
    return permissions.map((p) => String(p).toUpperCase());
  };

  const hasPermission = (permission) => {
    if (!permission) return true;
    return getUserPermissions().includes(String(permission).toUpperCase());
  };

  const hasAnyPermission = (permissions = []) => {
    if (!permissions || permissions.length === 0) return true;
    const userPermissions = getUserPermissions();
    return permissions.some((p) => userPermissions.includes(String(p).toUpperCase()));
  };

  const hasAllPermissions = (permissions = []) => {
    if (!permissions || permissions.length === 0) return true;
    const userPermissions = getUserPermissions();
    return permissions.every((p) => userPermissions.includes(String(p).toUpperCase()));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        isfirsttlogin,
        hasRole,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};