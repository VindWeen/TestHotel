// Khai báo toàn bộ nested routes
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/admin/DashboardPage";
import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import RequirePermission from "./RequirePermission";
import PublicOnlyRoute from "./PublicOnlyRoute";
import UserListPage from "../pages/admin/UserListPage";
import RolePermissionPage from "../pages/admin/RolePermissionPage";

export default function AdminRoutes() {
  return (
    <Routes>
      {/* Route công khai — đã đăng nhập sẽ bị redirect theo role */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/403"
        element={
          <div style={{ padding: 40, fontFamily: "sans-serif" }}>
            <h2>403 — Không đủ quyền truy cập</h2>
          </div>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />

        <Route
          path="staff"
          element={
            <RequirePermission permission="MANAGE_USERS">
              <UserListPage />
            </RequirePermission>
          }
        />
        <Route
          path="roles"
          element={
            <RequirePermission permission="MANAGE_ROLES">
              <RolePermissionPage />
            </RequirePermission>
          }
        />
      </Route>

      {/* Wildcard: đã đăng nhập → redirect theo role, chưa đăng nhập → /login */}
      <Route
        path="*"
        element={
          <PublicOnlyRoute>
            <Navigate to="/login" replace />
          </PublicOnlyRoute>
        }
      />
    </Routes>
  );
}
