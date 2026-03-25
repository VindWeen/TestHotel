// Khai báo toàn bộ nested routes
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/admin/DashboardPage";
import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import RequirePermission from "./RequirePermission";
import UserListPage from "../pages/admin/UserListPage";
import RolePermissionPage from "../pages/admin/RolePermissionPage";

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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

        {/* ← thêm vào đây */}
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

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
