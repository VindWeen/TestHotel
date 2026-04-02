import { useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { getDefaultAdminPath } from "../routes/permissionRouting";

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const token = useAdminAuthStore((s) => s.token);
  const role = useAdminAuthStore((s) => s.user?.role);
  const permissions = useAdminAuthStore((s) => s.permissions);
  const homePath = token ? getDefaultAdminPath(role, permissions) : "/login";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
        background:
          "radial-gradient(circle at 12% 14%, rgba(79,100,91,.18) 0%, rgba(79,100,91,0) 42%), radial-gradient(circle at 86% 90%, rgba(239,68,68,.12) 0%, rgba(239,68,68,0) 38%), linear-gradient(180deg,#f8faf8 0%,#f3f4f6 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 860,
          borderRadius: 24,
          border: "1px solid #e5e7eb",
          background: "rgba(255,255,255,.92)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 28px 80px rgba(15,23,42,.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "22px 24px",
            borderBottom: "1px solid #eef0f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "#4f645b",
                color: "#e7fef3",
                display: "grid",
                placeItems: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                lock
              </span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".08em", textTransform: "uppercase" }}>
                Access Control
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "#1f2937" }}>
                Quyền truy cập không hợp lệ
              </p>
            </div>
          </div>
          <div style={{ padding: "6px 10px", borderRadius: 9999, background: "#fef2f2", color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>
            Error 403
          </div>
        </div>

        <div style={{ padding: "34px 24px 30px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 58, lineHeight: 0.95, color: "#111827", letterSpacing: "-0.03em" }}>
              403
            </h1>
            <div style={{ height: 46, width: 1, background: "#d1d5db" }} />
            <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, color: "#1f2937", letterSpacing: "-0.01em" }}>
              Không đủ quyền truy cập
            </h2>
          </div>

          <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.7, color: "#4b5563", maxWidth: 640 }}>
            Tài khoản của bạn đã đăng nhập thành công, nhưng chưa có quyền thực hiện thao tác hoặc mở trang này.
            Vui lòng quay lại khu vực bạn được phân quyền hoặc liên hệ quản trị viên để được cấp quyền phù hợp.
          </p>

          <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate(homePath)}
              style={{
                padding: "11px 16px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
                color: "#e7fef3",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Về trang chính
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                padding: "11px 16px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Quay lại trang trước
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
