import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useLoadingStore } from "../store/loadingStore";
import { logout } from "../api/authApi";
import { getMyProfile } from "../api/userProfileApi";
import { useSignalR } from "../hooks/useSignalR";
import NotificationMenu from "../components/NotificationMenu";

export default function AdminLayout() {
  const { user, permissions } = useAdminAuthStore();
  const clearAuth = useAdminAuthStore((s) => s.clearAuth);
  const updateUser = useAdminAuthStore((s) => s.updateUser);
  const isLoading = useLoadingStore((s) => s.isLoading);
  const navigate = useNavigate();

  useSignalR(); // Initialize WebSocket connection global

  const [topSearch, setTopSearch] = useState("");
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // vẫn logout phía client dù server lỗi
    }
    clearAuth();
    navigate("/login");
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getMyProfile();
        if (res.data) {
          updateUser(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    };
    if (user?.id || user?.fullName) {
      fetchProfile();
    }
  }, [user?.id, user?.fullName, updateUser]);

  const onSearch = (val) => {
    setTopSearch(val);
    // Logic search global hoặc truyền qua context nếu cần
  };

  const hasPermission = (code) =>
    permissions.some(
      (p) =>
        (typeof p === "string" &&
          (p === code || (code === "VIEW_ROLES" && p === "MANAGE_ROLES"))) ||
        (typeof p === "object" &&
          (p.permissionCode === code ||
            (code === "VIEW_ROLES" && p.permissionCode === "MANAGE_ROLES"))),
    );

  const ch = (user?.fullName || "A")[0].toUpperCase();

  return (
    <>
      <style>{`
        .spinner-overlay { position:fixed; inset:0; background:rgba(255,255,255,0.6); z-index:9999; display:flex; alignItems:center; justify-content:center; }
        .spinner { width:40px; height:40px; border:4px solid #e5e7eb; border-top:4px solid #4f645b; border-radius:50%; animation:spin 0.8s linear infinite; }
      `}</style>

      {isLoading && (
        <div className="spinner-overlay">
          <div className="spinner" />
        </div>
      )}

      <div
        style={{
          fontFamily: "'Manrope', sans-serif",
          background: "#f8f9fa",
          minHeight: "100vh",
        }}
      >
        {/* SideNavBar */}
        <aside
          style={{
            width: 256,
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            borderRight: "1px solid #f1f0ea",
            background: "white",
            display: "flex",
            flexDirection: "column",
            padding: "32px 16px",
            zIndex: 50,
          }}
        >
          <div style={{ marginBottom: 40, paddingLeft: 16 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.15em",
                color: "#1a3826",
                textTransform: "uppercase",
              }}
            >
              The Ethereal
            </h1>
            <p
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "#6b7280",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Hotel ERP
            </p>
          </div>

          <nav
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {hasPermission("VIEW_DASHBOARD") && (
              <NavLink to="/admin/dashboard" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"
                          : "'FILL' 0",
                      }}
                    >
                      dashboard
                    </span>
                    <span>Dashboard</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("MANAGE_ROOMS") && (
              <NavLink to="/admin/rooms" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      meeting_room
                    </span>
                    <span>Quản lý Phòng</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("MANAGE_ROOMS") && (
              <NavLink to="/admin/housekeeping" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      cleaning_services
                    </span>
                    <span>Dọn phòng</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("MANAGE_ROOMS") && (
              <NavLink to="/admin/room-types" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      category
                    </span>
                    <span>Hạng phòng</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("MANAGE_INVENTORY") && (
              <NavLink to="/admin/items" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      inventory_2
                    </span>
                    <span>Vật tư & Minibar</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("MANAGE_INVENTORY") && (
              <NavLink to="/admin/loss-damage" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      report_problem
                    </span>
                    <span>Thất thoát & Đền bù</span>
                  </>
                )}
              </NavLink>
            )}

            {/* Thêm các mục khác tương tự */}
            {hasPermission("MANAGE_BOOKINGS") && (
              <NavLink to="/admin/bookings" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      confirmation_number
                    </span>
                    <span>Booking & Voucher</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("MANAGE_INVOICES") && (
              <NavLink to="/admin/invoices" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      receipt_long
                    </span>
                    <span>Invoices</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("MANAGE_USERS") && (
              <NavLink to="/admin/staff" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      group
                    </span>
                    <span>Danh sách Nhân sự</span>
                  </>
                )}
              </NavLink>
            )}

            {hasPermission("VIEW_ROLES") && (
              <NavLink to="/admin/roles" style={navStyle}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      shield_person
                    </span>
                    <span>Vai trò & Phân quyền</span>
                  </>
                )}
              </NavLink>
            )}
          </nav>

          <div
            style={{
              marginTop: "auto",
              paddingLeft: 16,
              paddingRight: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 12,
                background: "none",
                border: "1px solid #e2e8e1",
                color: "#6b7280",
                fontWeight: 500,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                logout
              </span>
              Đăng xuất
            </button>
          </div>
        </aside>

        {/* TopNavBar */}
        <header
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "calc(100% - 256px)",
            height: 64,
            zIndex: 40,
            background: "rgba(255,255,255,.8)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #f1f0ea",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div style={{ position: "relative", width: 320 }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                  fontSize: 18,
                }}
              >
                search
              </span>
              <input
                value={topSearch}
                onChange={(e) => onSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: 9999,
                  padding: "8px 16px 8px 40px",
                  fontSize: 12,
                  outline: "none",
                }}
                placeholder="Tìm kiếm tài nguyên..."
              />
            </div>
            <nav style={{ display: "flex", gap: 24 }}>
              {["Hotels", "Analytics", "Reports"].map((item, i) => (
                <a
                  key={item}
                  href="#"
                  style={{
                    fontSize: 14,
                    fontWeight: i === 1 ? 600 : 500,
                    color: i === 1 ? "#1a3826" : "#6b7280",
                    textDecoration: "none",
                    borderBottom: i === 1 ? "2px solid #1a3826" : "none",
                    paddingBottom: i === 1 ? 4 : 0,
                  }}
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <NotificationMenu />
              <button
                style={{
                  padding: 8,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  borderRadius: "50%",
                }}
              >
                <span className="material-symbols-outlined">help_outline</span>
              </button>
            </div>
            <div style={{ width: 1, height: 32, background: "#e5e7eb" }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ textAlign: "right" }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1c1917",
                    margin: 0,
                  }}
                >
                  {user?.fullName || "—"}
                </p>
                <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>
                  {user?.role || "—"}
                </p>
              </div>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid rgba(79,100,91,.1)",
                  }}
                  alt="Avatar"
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(79,100,91,.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4f645b",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {ch}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          style={{
            marginLeft: 256,
            paddingTop: 64,
            minHeight: "100vh",
          }}
        >
          <div style={{ padding: 32 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}

const navStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 16px",
  borderRadius: 12,
  textDecoration: "none",
  fontSize: 14,
  fontWeight: isActive ? 700 : 500,
  color: isActive ? "#1a3826" : "#6b7280",
  background: isActive ? "rgba(236,253,245,.5)" : "transparent",
  transition: "all .15s",
});
