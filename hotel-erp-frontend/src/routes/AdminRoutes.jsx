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
import LossAndDamagePage from "../pages/admin/Lossanddamagepage";
import RoomManagementPage from "../pages/admin/RoomManagementPage";
import RoomTypesPage from "../pages/admin/RoomTypesPage";
import RoomDetailPage from "../pages/admin/RoomDetailPage";
import EquipmentPage from "../pages/admin/EquipmentPage";

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
        {/* Mặc định redirect về dashboard */}
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Quản lý Phòng */}
        <Route
          path="rooms"
          element={
            <RequirePermission permission="MANAGE_ROOMS">
              <RoomManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="rooms/:id"
          element={
            <RequirePermission permission="MANAGE_ROOMS">
              <RoomDetailPage />
            </RequirePermission>
          }
        />

        {/* Hạng phòng */}
        <Route
          path="room-types"
          element={
            <RequirePermission permission="MANAGE_ROOMS">
              <RoomTypesPage />
            </RequirePermission>
          }
        />

        {/* Vật tư & Minibar — placeholder, thay bằng page thực khi có */}
        <Route
          path="items"
          element={
            <RequirePermission permission="MANAGE_INVENTORY">
              <EquipmentPage />
            </RequirePermission>
          }
        />

        {/* Booking & Voucher — placeholder, thay bằng page thực khi có */}
        <Route
          path="bookings"
          element={
            <RequirePermission permission="MANAGE_BOOKINGS">
              <ComingSoonPage icon="confirmation_number" title="Booking & Voucher" />
            </RequirePermission>
          }
        />

        {/* Nhân sự */}
        <Route
          path="staff"
          element={
            <RequirePermission permission="MANAGE_USERS">
              <UserListPage />
            </RequirePermission>
          }
        />

        {/* Vai trò & Phân quyền */}
        <Route
          path="roles"
          element={
            <RequirePermission permission="VIEW_ROLES">
              <RolePermissionPage />
            </RequirePermission>
          }
        />
        <Route
          path="loss-damage"
          element={
            <RequirePermission permission="MANAGE_INVENTORY">
              <LossAndDamagePage />
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

// ─── Placeholder component dùng chung cho trang đang phát triển ───────────────
function ComingSoonPage({ icon, title }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 40px",
        fontFamily: "'Manrope', sans-serif",
        textAlign: "center",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 64, color: "#d1d5db", display: "block", marginBottom: 16 }}
      >
        {icon}
      </span>
      <h2
        style={{ color: "#1c1917", margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
        Trang này đang được phát triển và sẽ sớm ra mắt.
      </p>
    </div>
  );
}
