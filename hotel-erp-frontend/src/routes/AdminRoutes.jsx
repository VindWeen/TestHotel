import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import RequirePermission from "./RequirePermission";
import PublicOnlyRoute from "./PublicOnlyRoute";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { getDefaultAdminPath } from "./permissionRouting";
import { SERVICE_VIEW_STORAGE_KEY } from "../pages/admin/ServiceAdminShared";

const LoginPage = lazy(() => import("../pages/LoginPage"));
const ForbiddenPage = lazy(() => import("../pages/ForbiddenPage"));
const DashboardPage = lazy(() => import("../pages/admin/DashboardPage"));
const UserListPage = lazy(() => import("../pages/admin/UserListPage"));
const RolePermissionPage = lazy(() => import("../pages/admin/RolePermissionPage"));
const LossAndDamagePage = lazy(() => import("../pages/admin/LossAndDamagePage"));
const RoomManagementPage = lazy(() => import("../pages/admin/RoomManagementPage"));
const RoomTypesPage = lazy(() => import("../pages/admin/RoomTypesPage"));
const RoomDetailPage = lazy(() => import("../pages/admin/RoomDetailPage"));
const HousekeepingPage = lazy(() => import("../pages/admin/HousekeepingPage"));
const EquipmentPage = lazy(() => import("../pages/admin/EquipmentPage"));
const BookingListPage = lazy(() => import("../pages/admin/BookingListPage"));
const BookingDetailPage = lazy(() => import("../pages/admin/BookingDetailPage"));
const InvoiceListPage = lazy(() => import("../pages/admin/InvoiceListPage"));
const InvoiceDetailPage = lazy(() => import("../pages/admin/InvoiceDetailPage"));
const ServiceItemsPage = lazy(() => import("../pages/admin/ServiceItemsPage"));
const ServiceCategoryPage = lazy(() => import("../pages/admin/ServiceCategoryPage"));
const OrderServicePage = lazy(() => import("../pages/admin/OrderServicePage"));
const MembershipPage = lazy(() => import("../pages/admin/MembershipPage"));

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Manrope', sans-serif",
        color: "#6b7280",
        fontSize: 14,
      }}
    >
      Đang tải trang...
    </div>
  );
}

function withSuspense(node) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

function AdminIndexRedirect() {
  const role = useAdminAuthStore((s) => s.user?.role);
  const permissions = useAdminAuthStore((s) => s.permissions);
  return <Navigate to={getDefaultAdminPath(role, permissions)} replace />;
}

function ServiceIndexRedirect() {
  const lastView =
    typeof window !== "undefined"
      ? sessionStorage.getItem(SERVICE_VIEW_STORAGE_KEY)
      : null;
  const target =
    lastView === "categories"
      ? "/admin/services/categories"
      : "/admin/services/items";

  return <Navigate to={target} replace />;
}

// Khai báo toàn bộ nested routes
export default function AdminRoutes() {
  return (
    <Routes>
      {/* Route công khai - đã đăng nhập sẽ bị redirect theo role */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>{withSuspense(<LoginPage />)}</PublicOnlyRoute>
        }
      />

      <Route path="/403" element={withSuspense(<ForbiddenPage />)} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Mặc định redirect theo permission */}
        <Route index element={<AdminIndexRedirect />} />
        <Route
          path="dashboard"
          element={
            <RequirePermission permission="VIEW_DASHBOARD">
              {withSuspense(<DashboardPage />)}
            </RequirePermission>
          }
        />

        {/* Quản lý Phòng */}
        <Route
          path="rooms"
          element={
            <RequirePermission permission="MANAGE_ROOMS">
              {withSuspense(<RoomManagementPage />)}
            </RequirePermission>
          }
        />
        <Route
          path="rooms/:id"
          element={
            <RequirePermission permission="MANAGE_ROOMS">
              {withSuspense(<RoomDetailPage />)}
            </RequirePermission>
          }
        />

        <Route
          path="housekeeping"
          element={
            <RequirePermission permission="MANAGE_ROOMS">
              {withSuspense(<HousekeepingPage />)}
            </RequirePermission>
          }
        />

        {/* Hạng phòng */}
        <Route
          path="room-types"
          element={
            <RequirePermission permission="MANAGE_ROOMS">
              {withSuspense(<RoomTypesPage />)}
            </RequirePermission>
          }
        />

        {/* Vật tư & Minibar */}
        <Route
          path="items"
          element={
            <RequirePermission permission="MANAGE_INVENTORY">
              {withSuspense(<EquipmentPage />)}
            </RequirePermission>
          }
        />

        <Route
          path="bookings"
          element={
            <RequirePermission permission="MANAGE_BOOKINGS">
              {withSuspense(<BookingListPage />)}
            </RequirePermission>
          }
        />
        <Route
          path="bookings/:id"
          element={
            <RequirePermission permission="MANAGE_BOOKINGS">
              {withSuspense(<BookingDetailPage />)}
            </RequirePermission>
          }
        />

        <Route
          path="invoices"
          element={
            <RequirePermission permission="MANAGE_INVOICES">
              {withSuspense(<InvoiceListPage />)}
            </RequirePermission>
          }
        />
        <Route
          path="invoices/:id"
          element={
            <RequirePermission permission="MANAGE_INVOICES">
              {withSuspense(<InvoiceDetailPage />)}
            </RequirePermission>
          }
        />

        <Route
          path="services"
          element={
            <RequirePermission permission="MANAGE_SERVICES">
              <ServiceIndexRedirect />
            </RequirePermission>
          }
        />
        <Route
          path="services/categories"
          element={
            <RequirePermission permission="MANAGE_SERVICES">
              {withSuspense(<ServiceCategoryPage />)}
            </RequirePermission>
          }
        />
        <Route
          path="services/items"
          element={
            <RequirePermission permission="MANAGE_SERVICES">
              {withSuspense(<ServiceItemsPage />)}
            </RequirePermission>
          }
        />
        <Route
          path="order-services"
          element={
            <RequirePermission permission="MANAGE_SERVICES">
              {withSuspense(<OrderServicePage />)}
            </RequirePermission>
          }
        />

        {/* Nhân sự */}
        <Route
          path="staff"
          element={
            <RequirePermission permission="MANAGE_USERS">
              {withSuspense(<UserListPage />)}
            </RequirePermission>
          }
        />
        <Route
          path="memberships"
          element={
            <RequirePermission permission="MANAGE_USERS">
              {withSuspense(<MembershipPage />)}
            </RequirePermission>
          }
        />

        {/* Vai trò & Phân quyền */}
        <Route
          path="roles"
          element={
            <RequirePermission permission="VIEW_ROLES">
              {withSuspense(<RolePermissionPage />)}
            </RequirePermission>
          }
        />
        <Route
          path="loss-damage"
          element={
            <RequirePermission permission="MANAGE_INVENTORY">
              {withSuspense(<LossAndDamagePage />)}
            </RequirePermission>
          }
        />
      </Route>

      {/* Wildcard: đã đăng nhập -> redirect theo role, chưa đăng nhập -> /login */}
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

