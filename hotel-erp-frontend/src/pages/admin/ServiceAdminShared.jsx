import { NavLink } from "react-router-dom";

export const SERVICE_VIEW_STORAGE_KEY = "admin_services_view";

export const panelStyle = {
  background: "white",
  borderRadius: 16,
  border: "1px solid #f1f0ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
};

export const inputStyle = {
  width: "100%",
  background: "#f9f8f3",
  border: "1px solid #e2e8e1",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

export const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: 8,
};

export const statusFilterOptions = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Hiện" },
  { value: "inactive", label: "Đã ẩn" },
];

const TOAST_STYLES = {
  success: {
    bg: "#1e3a2f",
    border: "#2d5a45",
    text: "#a7f3d0",
    prog: "#34d399",
    icon: "check_circle",
  },
  warning: {
    bg: "#3a2e1a",
    border: "#5a4820",
    text: "#fcd34d",
    prog: "#fbbf24",
    icon: "warning",
  },
  error: {
    bg: "#3a1e1e",
    border: "#5a2d2d",
    text: "#fca5a5",
    prog: "#f87171",
    icon: "error",
  },
  info: {
    bg: "#1e2f3a",
    border: "#2d4a5a",
    text: "#93c5fd",
    prog: "#60a5fa",
    icon: "info",
  },
};

export function getIncludeInactive(statusFilter) {
  return statusFilter !== "active";
}

export function applyStatusFilter(rows, statusFilter) {
  if (statusFilter === "inactive") {
    return rows.filter((item) => !item.isActive);
  }

  if (statusFilter === "active") {
    return rows.filter((item) => item.isActive);
  }

  return rows;
}

export function ServiceAdminShell({
  view,
  title,
  subtitle,
  stats,
  filterContent,
  primaryAction,
  children,
}) {
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#6b7280",
            }}
          >
            Service Admin
          </p>
          <h2
            style={{
              margin: "6px 0 0",
              fontSize: 26,
              fontWeight: 800,
              color: "#1c1917",
            }}
          >
            {title}
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6b7280" }}>
            {subtitle}
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>{primaryAction}</div>
      </div>

      <div style={{ ...panelStyle, padding: 10, marginBottom: 20 }}>
        <div
          style={{
            display: "inline-flex",
            background: "#f6f4ee",
            borderRadius: 16,
            padding: 6,
            gap: 6,
          }}
        >
          <ServiceViewLink
            to="/admin/services/categories"
            active={view === "categories"}
            icon="category"
            label="Nhóm"
          />
          <ServiceViewLink
            to="/admin/services/items"
            active={view === "items"}
            icon="room_service"
            label="Dịch vụ"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {stats.map((stat) => (
          <div key={stat.label} style={{ ...panelStyle, padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "#78716c",
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 26,
                    fontWeight: 800,
                    color: "#1c1917",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#78716c",
                  }}
                >
                  {stat.description}
                </div>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: "rgba(79,100,91,.12)",
                  color: "#4f645b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section style={{ ...panelStyle, padding: 24, marginBottom: 24 }}>
        {filterContent}
      </section>

      {children}
    </div>
  );
}

function ServiceViewLink({ to, active, icon, label }) {
  return (
    <NavLink
      to={to}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 12,
        textDecoration: "none",
        background: active ? "#4f645b" : "transparent",
        color: active ? "#ecfdf5" : "#57534e",
        fontWeight: active ? 700 : 600,
        transition: "all .15s",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

export function Modal({ open, title, description, onClose, children }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,25,23,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "white",
          borderRadius: 24,
          border: "1px solid #ede7dd",
          boxShadow: "0 24px 60px rgba(28,25,23,.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "22px 24px 16px",
            borderBottom: "1px solid #f1f0ea",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 22, color: "#1c1917" }}>
              {title}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78716c" }}>
              {description || "Giao diện đồng bộ với admin hiện tại."}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#78716c",
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

export function StatusChip({ active, label }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        background: active ? "#ecfdf5" : "#f5f5f4",
        color: active ? "#047857" : "#78716c",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".06em",
      }}
    >
      {label || (active ? "Hoạt động" : "Đã ẩn")}
    </span>
  );
}

export function EmptyState({ label, icon }) {
  return (
    <div style={{ textAlign: "center", color: "#9ca3af" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 42 }}>
        {icon}
      </span>
      <p style={{ margin: "10px 0 0", fontWeight: 500 }}>{label}</p>
    </div>
  );
}

export function IconButton({ icon, title, onClick, danger = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid #ece7de",
        background: danger ? "#fff7f7" : "white",
        color: danger ? "#dc2626" : "#57534e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {icon}
      </span>
    </button>
  );
}

export function FormFooter({ submitting, onClose }) {
  return (
    <div
      style={{
        marginTop: 20,
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: "10px 16px",
          borderRadius: 12,
          border: "1px solid #e7e5e4",
          background: "white",
          color: "#57534e",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Đóng
      </button>
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "10px 18px",
          borderRadius: 12,
          border: "none",
          background: "#4f645b",
          color: "#e7fef3",
          fontWeight: 700,
          cursor: "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </div>
  );
}

export function VisibilitySwitch({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "relative",
          width: 46,
          height: 26,
          borderRadius: 999,
          background: checked ? "#4f645b" : "#d6d3d1",
          transition: "all .18s",
          boxShadow: checked
            ? "inset 0 0 0 1px rgba(79,100,91,.15)"
            : "inset 0 0 0 1px rgba(120,113,108,.12)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 2px 6px rgba(0,0,0,.18)",
            transition: "all .18s",
          }}
        />
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: checked ? "#166534" : "#78716c",
          textTransform: "uppercase",
          letterSpacing: ".05em",
        }}
      >
        {checked ? "Hiện" : "Ẩn"}
      </span>
    </button>
  );
}

export function primaryButton(soft) {
  return {
    padding: "10px 18px",
    borderRadius: 12,
    border: soft ? "1px solid #d8dfd7" : "none",
    background: soft ? "white" : "#4f645b",
    color: soft ? "#1c1917" : "#e7fef3",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: soft
      ? "0 1px 3px rgba(0,0,0,.06)"
      : "0 8px 18px rgba(79,100,91,.18)",
  };
}

export function ServiceToast({ id, msg, type = "success", dur = 4000, onDismiss }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;

  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.3)",
        pointerEvents: "auto",
        marginBottom: 10,
        animation: "toastIn .35s cubic-bezier(.22,1,.36,1) forwards",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "13px 13px 9px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 19,
            flexShrink: 0,
            marginTop: 1,
            fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20",
          }}
        >
          {s.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".08em",
              opacity: 0.5,
              marginBottom: 2,
            }}
          >
            Cập nhật hiển thị
          </div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {msg}
          </p>
        </div>
        <button
          onClick={() => onDismiss(id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.4,
            padding: 2,
            color: "inherit",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            close
          </span>
        </button>
      </div>
      <div
        style={{
          margin: "0 12px 9px",
          height: 3,
          borderRadius: 9999,
          background: "rgba(255,255,255,.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: s.prog,
            animation: `toastProgress ${dur}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

export function ServiceToastContainer({ toasts, onDismiss }) {
  return (
    <>
      <style>{`
        @keyframes toastProgress { from { width: 100%; } to { width: 0; } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-6px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 300,
          minWidth: 280,
          maxWidth: 360,
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => (
          <ServiceToast key={toast.id} {...toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

export function ServicePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}) {
  if (totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    const pageNumber = totalPages <= 5 ? index + 1 : Math.max(1, page - 2) + index;
    return pageNumber > totalPages ? null : pageNumber;
  }).filter(Boolean);

  return (
    <div
      style={{
        padding: "14px 20px",
        borderTop: "1px solid #f1f0ea",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
        {start}–{end} / {totalItems}
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <PaginationButton
          label="chevron_left"
          icon
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        {pageNumbers.map((pageNumber) => (
          <PaginationButton
            key={pageNumber}
            label={String(pageNumber)}
            active={pageNumber === page}
            onClick={() => onPageChange(pageNumber)}
          />
        ))}
        <PaginationButton
          label="chevron_right"
          icon
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}

function PaginationButton({ label, onClick, disabled = false, active = false, icon = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        minWidth: 32,
        height: 32,
        padding: icon ? 0 : "0 10px",
        borderRadius: 9,
        border: active ? "none" : "1px solid #ece7de",
        background: active ? "#4f645b" : "white",
        color: active ? "#ecfdf5" : "#6b7280",
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon ? (
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {label}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
