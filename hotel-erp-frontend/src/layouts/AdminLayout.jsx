import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useLoadingStore } from "../store/loadingStore";
import { logout } from "../api/authApi";
import { getMyProfile } from "../api/userProfileApi";
import { useSignalR } from "../hooks/useSignalR";
import NotificationMenu from "../components/NotificationMenu";

const THEME_STORAGE_KEY = "admin-theme-mode";
const SIDEBAR_WIDTH = 256;

function getPalette(mode) {
  if (mode === "dark") {
    return {
      pageBg: "#0f1720",
      shellBg: "#111827",
      headerBg: "rgba(15,23,32,.88)",
      panelBg: "#18212f",
      panelMuted: "#111827",
      panelBorder: "rgba(148,163,184,.14)",
      textMain: "#e5eef6",
      textSub: "#9fb1c5",
      brand: "#8fbfa6",
      brandStrong: "#6ea089",
      activeBg: "rgba(110,160,137,.18)",
      activeText: "#d8f3e7",
      overlay: "rgba(2,6,23,.62)",
      divider: "rgba(148,163,184,.16)",
    };
  }

  return {
    pageBg: "#f8f9fa",
    shellBg: "#ffffff",
    headerBg: "rgba(255,255,255,.82)",
    panelBg: "#ffffff",
    panelMuted: "#f3f4f6",
    panelBorder: "#f1f0ea",
    textMain: "#1c1917",
    textSub: "#6b7280",
    brand: "#1a3826",
    brandStrong: "#4f645b",
    activeBg: "rgba(236,253,245,.55)",
    activeText: "#1a3826",
    overlay: "rgba(15,23,42,.34)",
    divider: "#e5e7eb",
  };
}

function navStyle(palette) {
  return ({ isActive }) => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 12,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: isActive ? 700 : 500,
    color: isActive ? palette.activeText : palette.textSub,
    background: isActive ? palette.activeBg : "transparent",
    transition: "all .15s",
  });
}

function buildNavItems(hasPermission) {
  return [
    hasPermission("VIEW_DASHBOARD") && { to: "/admin/dashboard", icon: "dashboard", label: "Dashboard" },
    hasPermission("MANAGE_ROOMS") && { to: "/admin/rooms", icon: "meeting_room", label: "Quản lý phòng" },
    hasPermission("MANAGE_ROOMS") && { to: "/admin/maintenance", icon: "construction", label: "Bảo trì phòng" },
    hasPermission("MANAGE_ROOMS") && { to: "/admin/housekeeping", icon: "cleaning_services", label: "Dọn phòng" },
    hasPermission("MANAGE_ROOMS") && { to: "/admin/room-types", icon: "category", label: "Hạng phòng" },
    hasPermission("MANAGE_INVENTORY") && { to: "/admin/items", icon: "inventory_2", label: "Vật tư & Minibar" },
    hasPermission("MANAGE_INVENTORY") && { to: "/admin/loss-damage", icon: "report_problem", label: "Thất thoát & Đền bù" },
    hasPermission("MANAGE_BOOKINGS") && { to: "/admin/bookings", icon: "confirmation_number", label: "Booking & Voucher" },
    hasPermission("MANAGE_SERVICES") && { to: "/admin/services", icon: "room_service", label: "Quản lý dịch vụ" },
    hasPermission("MANAGE_INVOICES") && { to: "/admin/invoices", icon: "receipt_long", label: "Hóa đơn" },
    hasPermission("MANAGE_USERS") && { to: "/admin/memberships", icon: "workspace_premium", label: "Khách hàng thành viên" },
    hasPermission("MANAGE_USERS") && { to: "/admin/shifts", icon: "schedule", label: "Ca làm việc" },
    hasPermission("MANAGE_CONTENT") && { to: "/admin/articles", icon: "article", label: "Bài viết" },
    hasPermission("MANAGE_CONTENT") && { to: "/admin/attractions", icon: "place", label: "Địa điểm" },
    hasPermission("MANAGE_CONTENT") && { to: "/admin/reviews", icon: "reviews", label: "Đánh giá" },
    hasPermission("MANAGE_USERS") && { to: "/admin/staff", icon: "group", label: "Danh sách Nhân sự" },
    hasPermission("VIEW_ROLES") && { to: "/admin/roles", icon: "shield_person", label: "Vai trò & Phân quyền" },
  ].filter(Boolean);
}

export default function AdminLayout() {
  const { user, permissions } = useAdminAuthStore();
  const clearAuth = useAdminAuthStore((s) => s.clearAuth);
  const updateUser = useAdminAuthStore((s) => s.updateUser);
  const isLoading = useLoadingStore((s) => s.isLoading);
  const navigate = useNavigate();

  useSignalR();

  const [topSearch, setTopSearch] = useState("");
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(THEME_STORAGE_KEY) || "light";
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1100;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const palette = useMemo(() => getPalette(themeMode), [themeMode]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getMyProfile();
        if (res.data) updateUser(res.data);
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    };

    if (user?.id || user?.fullName) {
      fetchProfile();
    }
  }, [user?.id, user?.fullName, updateUser]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncViewport = () => {
      const mobile = window.innerWidth < 1100;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    document.body.style.background = palette.pageBg;
  }, [themeMode, palette.pageBg]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // vẫn logout phía client dù server lỗi
    }
    clearAuth();
    navigate("/login");
  };

  const onSearch = (value) => setTopSearch(value);

  const hasPermission = (code) =>
    permissions.some(
      (p) =>
        (typeof p === "string" && p === code) ||
        (typeof p === "object" && p.permissionCode === code),
    );

  const navItems = useMemo(() => buildNavItems(hasPermission), [permissions]);
  const ch = (user?.fullName || "A")[0].toUpperCase();
  const canUseNotificationCenter = user?.role === "Admin" || user?.role === "Manager";

  return (
    <>
      <style>{`
        .spinner-overlay { position:fixed; inset:0; background:rgba(255,255,255,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; }
        .spinner { width:40px; height:40px; border:4px solid #e5e7eb; border-top:4px solid #4f645b; border-radius:50%; animation:spin 0.8s linear infinite; }
        .admin-sidebar-nav::-webkit-scrollbar { width: 0; }
        .admin-sidebar-nav:hover::-webkit-scrollbar { width: 8px; }
        .admin-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .admin-sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; }
        .admin-sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(120, 113, 108, 0.35); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1099px) {
          .admin-desktop-links { display: none !important; }
        }
      `}</style>

      {isLoading && (
        <div className="spinner-overlay">
          <div className="spinner" />
        </div>
      )}

      <div
        style={{
          fontFamily: "'Manrope', sans-serif",
          background: palette.pageBg,
          minHeight: "100vh",
          color: palette.textMain,
        }}
      >
        {isMobile && sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
            style={{
              position: "fixed",
              inset: 0,
              border: "none",
              background: palette.overlay,
              zIndex: 45,
              cursor: "pointer",
            }}
          />
        )}

        <aside
          style={{
            width: SIDEBAR_WIDTH,
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            transform: isMobile ? (sidebarOpen ? "translateX(0)" : "translateX(-100%)") : "translateX(0)",
            transition: "transform .25s ease",
            borderRight: `1px solid ${palette.panelBorder}`,
            background: palette.shellBg,
            display: "flex",
            flexDirection: "column",
            padding: "32px 16px",
            zIndex: 50,
            overflow: "hidden",
            boxShadow: isMobile ? "0 18px 48px rgba(0,0,0,.22)" : "none",
          }}
        >
          <div style={{ marginBottom: 40, paddingLeft: 16 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.15em",
                color: palette.brand,
                textTransform: "uppercase",
              }}
            >
              The Ethereal
            </h1>
            <p
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: palette.textSub,
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Hotel ERP
            </p>
          </div>

          <nav
            className="admin-sidebar-nav"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minHeight: 0,
              overflowY: "auto",
              paddingRight: 6,
              scrollbarWidth: "thin",
            }}
          >
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} style={navStyle(palette)}>
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: isActive ? "'FILL' 1,'wght' 400" : "'FILL' 0",
                      }}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
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
                border: `1px solid ${palette.panelBorder}`,
                color: palette.textSub,
                fontWeight: 500,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                logout
              </span>
              Đăng xuất
            </button>
          </div>
        </aside>

        <header
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: isMobile ? "100%" : `calc(100% - ${SIDEBAR_WIDTH}px)`,
            height: 64,
            zIndex: 40,
            background: palette.headerBg,
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${palette.panelBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 16px" : "0 32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 32, flex: 1 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${palette.panelBorder}`,
                  background: palette.panelBg,
                  color: palette.textMain,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
            )}

            <div style={{ position: "relative", width: isMobile ? "100%" : 320, maxWidth: isMobile ? "100%" : 320 }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: palette.textSub,
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
                  background: palette.panelMuted,
                  color: palette.textMain,
                  border: `1px solid ${palette.panelBorder}`,
                  borderRadius: 9999,
                  padding: "8px 16px 8px 40px",
                  fontSize: 12,
                  outline: "none",
                }}
                placeholder="Tìm kiếm tài nguyên..."
              />
            </div>

            <nav className="admin-desktop-links" style={{ display: "flex", gap: 24 }}>
              {["Hotels", "Analytics", "Reports"].map((item, i) => (
                <a
                  key={item}
                  href="#"
                  style={{
                    fontSize: 14,
                    fontWeight: i === 1 ? 600 : 500,
                    color: i === 1 ? palette.brand : palette.textSub,
                    textDecoration: "none",
                    borderBottom: i === 1 ? `2px solid ${palette.brand}` : "none",
                    paddingBottom: i === 1 ? 4 : 0,
                  }}
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16, marginLeft: 12 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
                title={themeMode === "dark" ? "Chuyển sang light mode" : "Chuyển sang dark mode"}
                style={{
                  padding: 8,
                  border: `1px solid ${palette.panelBorder}`,
                  background: palette.panelBg,
                  cursor: "pointer",
                  color: palette.textSub,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 19 }}>
                  {themeMode === "dark" ? "light_mode" : "dark_mode"}
                </span>
              </button>

              {canUseNotificationCenter ? <NotificationMenu /> : null}

              <button
                style={{
                  padding: 8,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: palette.textSub,
                  borderRadius: "50%",
                }}
              >
                <span className="material-symbols-outlined">help_outline</span>
              </button>
            </div>

            {!isMobile && <div style={{ width: 1, height: 32, background: palette.divider }} />}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              {!isMobile && (
                <div style={{ textAlign: "right" }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: palette.textMain,
                      margin: 0,
                    }}
                  >
                    {user?.fullName || "—"}
                  </p>
                  <p style={{ fontSize: 10, color: palette.textSub, margin: 0 }}>
                    {user?.role || "—"}
                  </p>
                </div>
              )}

              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: `2px solid ${palette.panelBorder}`,
                  }}
                  alt="Avatar"
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: themeMode === "dark" ? "rgba(143,191,166,.18)" : "rgba(79,100,91,.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: palette.brandStrong,
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

        <main
          style={{
            marginLeft: isMobile ? 0 : SIDEBAR_WIDTH,
            paddingTop: 64,
            minHeight: "100vh",
          }}
        >
          <div style={{ padding: isMobile ? 16 : 32 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
