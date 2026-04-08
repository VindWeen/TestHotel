// src/pages/admin/LossAndDamagePage.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axiosClient from "../../api/axios";
const fmtCurrency = (n) =>
  n == null ? "0đ" : `${new Intl.NumberFormat("vi-VN").format(n)}đ`;

const inputStyle = {
  width: "100%",
  border: "1.5px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  outline: "none",
  transition: "all 0.2s",
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return {
    date: date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

const parseImages = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.startsWith("http") ? [{ url: value }] : [];
  }
};

const normalizeLossRecord = (item) => ({
  ...item,
  images: parseImages(item.images || item.imgUrl),
  replenishedQuantity: Number(item.replenishedQuantity || 0),
  remainingToReplenish: Math.max(
    0,
    Number(
      item.remainingToReplenish ??
        Number(item.quantity || 0) - Number(item.replenishedQuantity || 0),
    ),
  ),
});

const canReplenishRecord = (item) =>
  item?.status === "Confirmed" &&
  Number(item?.remainingToReplenish || 0) > 0 &&
  Number(item?.availableStock || 0) > 0;

const getReplenishGroupKey = (item) => {
  if (item?.bookingDetailId) return `booking-detail-${item.bookingDetailId}`;
  if (item?.roomNumber) return `room-${item.roomNumber}`;
  return `loss-${item?.id ?? "unknown"}`;
};

const getBulkReplenishCandidates = (records, seedItem) => {
  if (!seedItem) return [];
  const groupKey = getReplenishGroupKey(seedItem);
  return records
    .filter((item) => getReplenishGroupKey(item) === groupKey)
    .filter((item) => item.status === "Confirmed" && Number(item.remainingToReplenish || 0) > 0)
    .sort((a, b) => {
      if ((a.roomNumber || "") !== (b.roomNumber || "")) {
        return String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""));
      }
      return String(a.itemName || "").localeCompare(String(b.itemName || ""));
    });
};

const STATUS_CFG = {
  Pending: {
    label: "Chờ xử lý",
    bg: "#fff7ed",
    color: "#c2410c",
    dot: "#f97316",
  },
  Confirmed: {
    label: "Đã xác nhận",
    bg: "#f0fdf4",
    color: "#15803d",
    dot: "#22c55e",
  },
  Waived: {
    label: "Miễn trừ",
    bg: "#f8fafc",
    color: "#475569",
    dot: "#94a3b8",
  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: {
    bg: "#1e3a2f",
    border: "#2d5a45",
    text: "#a7f3d0",
    prog: "#34d399",
    icon: "check_circle",
  },
  error: {
    bg: "#3a1e1e",
    border: "#5a2d2d",
    text: "#fca5a5",
    prog: "#f87171",
    icon: "error",
  },
  warning: {
    bg: "#3a2e1a",
    border: "#5a4820",
    text: "#fcd34d",
    prog: "#fbbf24",
    icon: "warning",
  },
  info: {
    bg: "#1e2f3a",
    border: "#2d4a5a",
    text: "#93c5fd",
    prog: "#60a5fa",
    icon: "info",
  },
};

function Toast({ id, msg, type = "success", dur = 3500, onDismiss }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), dur);
    return () => clearTimeout(t);
  }, [id, dur, onDismiss]);
  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(0,0,0,.35)",
        pointerEvents: "auto",
        marginBottom: 10,
        animation: "toastIn .32s cubic-bezier(.22,1,.36,1) forwards",
        minWidth: 280,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 12px 8px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            flexShrink: 0,
            marginTop: 1,
            fontVariationSettings: "'FILL' 1",
          }}
        >
          {s.icon}
        </span>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            margin: 0,
            flex: 1,
          }}
        >
          {msg}
        </p>
        <button
          onClick={() => onDismiss(id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.4,
            color: "inherit",
            padding: 2,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            close
          </span>
        </button>
      </div>
      <div
        style={{
          margin: "0 12px 8px",
          height: 3,
          borderRadius: 9999,
          background: "rgba(255,255,255,.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: s.prog,
            animation: `toastProgress ${dur}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          background: "white",
          borderRadius: 24,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
          animation: "modalSlideUp .3s ease-out",
          padding: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fef2f2",
            color: "#f87171",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
            report
          </span>
        </div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#0f172a",
            margin: "0 0 8px",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "#64748b",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "white",
              fontWeight: 700,
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: "#ef4444",
              fontWeight: 700,
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <div
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
            ) : (
              "Xác nhận xóa"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modals Utils ─────────────────────────────────────────────────────────────
const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modalContentStyle = {
  background: "white",
  borderRadius: 28,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
  animation: "modalSlideUp .3s ease-out",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ open, item, onClose }) {
  if (!open || !item) return null;
  const imgs = item.images || [];
  const dt = fmtDateTime(item.createdAt);
  const st = STATUS_CFG[item.status] || STATUS_CFG.Pending;

  return (
    <div
      style={modalOverlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          ...modalContentStyle,
          width: "100%",
          maxWidth: 840,
          maxHeight: "85vh",
        }}
      >
        <div
          style={{
            padding: "28px 32px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Chi tiết sự cố #{item.id}
            </span>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#0f172a",
                margin: "4px 0 0",
              }}
            >
              Biên bản báo cáo vật tư
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid #f1f5f9",
              background: "white",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div
          style={{
            padding: 32,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 32,
          }}
        >
          <div>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Minh chứng hiện trường
            </h4>
            {imgs.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {imgs.map((img, i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                      cursor: "zoom-in",
                    }}
                    onClick={() => window.open(img.url, "_blank")}
                  >
                    <img
                      src={img.url}
                      alt="Damage"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        aspectRatio: "4/3",
                        display: "block",
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "50px 0",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 20,
                  border: "2px dashed #e2e8f0",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 36, color: "#cbd5e1" }}
                >
                  no_photography
                </span>
                <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
                  Không có ảnh chứng cứ
                </p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Thông tin chi tiết
              </h4>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    background: "#f1f5f9",
                    padding: "16px 20px",
                    borderRadius: 16,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      margin: "0 0 6px",
                    }}
                  >
                    Vật tư bị hỏng/mất
                  </p>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0f172a",
                      margin: 0,
                    }}
                  >
                    {item.itemName} · Phòng {item.roomNumber}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div
                    style={{
                      flex: 1,
                      background: "#f8fafc",
                      padding: "14px 18px",
                      borderRadius: 16,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748b",
                        margin: "0 0 4px",
                      }}
                    >
                      SỐ LƯỢNG
                    </p>
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#0f172a",
                        margin: 0,
                      }}
                    >
                      {item.quantity}
                    </p>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#fff1f2",
                      padding: "14px 18px",
                      borderRadius: 16,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#e11d48",
                        margin: "0 0 4px",
                      }}
                    >
                      ĐỀN BÙ
                    </p>
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#e11d48",
                        margin: 0,
                      }}
                    >
                      {fmtCurrency(item.penaltyAmount)}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div
                    style={{
                      flex: 1,
                      background: "#eff6ff",
                      padding: "14px 18px",
                      borderRadius: 16,
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", margin: "0 0 4px" }}>
                      ĐÃ BỔ SUNG
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "#1d4ed8", margin: 0 }}>
                      {item.replenishedQuantity || 0}
                    </p>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#fff7ed",
                      padding: "14px 18px",
                      borderRadius: 16,
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#c2410c", margin: "0 0 4px" }}>
                      CÒN THIẾU
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "#c2410c", margin: 0 }}>
                      {item.remainingToReplenish || 0}
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    background: st.bg,
                    padding: "14px 18px",
                    borderRadius: 16,
                    border: `1px solid ${st.color}20`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: st.color,
                      margin: "0 0 4px",
                    }}
                  >
                    TRẠNG THÁI
                  </p>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: st.color,
                      margin: 0,
                    }}
                  >
                    {st.label}
                  </p>
                </div>
                <div
                  style={{
                    background: "white",
                    padding: "16px 20px",
                    borderRadius: 16,
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Báo cáo của nhân viên
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#475569",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {item.description || "— Không có ghi chú thêm —"}
                  </p>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    textAlign: "right",
                    margin: 0,
                  }}
                >
                  Người báo: <strong>{item.reporterName}</strong> lúc {dt.time}{" "}
                  {dt.date}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ open, item, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    quantity: 0,
    penaltyAmount: 0,
    description: "",
    status: "Pending",
  });
  const [saving, setSaving] = useState(false);
  const [existingImages, setExistingImages] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (item) {
      setForm({
        quantity: item.quantity,
        penaltyAmount: item.penaltyAmount,
        description: item.description,
        status: item.status,
      });
      setExistingImages(item.images || []);
      setNewImageFiles([]);
      setNewPreviews([]);
    }
  }, [item]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter((f) => f.size <= 5 * 1024 * 1024);
    setNewImageFiles((prev) => [...prev, ...validFiles]);
    setNewPreviews((prev) => [
      ...prev,
      ...validFiles.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    formData.append(
      "keepImagesJson",
      JSON.stringify(existingImages.map((img) => img.url)),
    );
    newImageFiles.forEach((f) => formData.append("images", f));
    try {
      await axiosClient.put(`/LossAndDamages/${item.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast("Đã lưu thay đổi thành công.");
      onSaved();
      onClose();
    } catch {
      showToast("Cập nhật thất bại.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !item) return null;

  return (
    <div
      style={modalOverlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ ...modalContentStyle, width: "100%", maxWidth: 560 }}>
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
            }}
          >
            Hiệu chỉnh biên bản #{item.id}
          </h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div style={{ padding: 32, maxHeight: "70vh", overflowY: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                }}
              >
                Số lượng hỏng
              </label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  background: "white",
                  padding: "10px 14px",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                }}
              >
                Số tiền đền bù
              </label>
              <input
                type="number"
                value={form.penaltyAmount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, penaltyAmount: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  background: "white",
                  padding: "10px 14px",
                }}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 20,
            }}
          >
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Trạng thái xử lý
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              style={{
                ...inputStyle,
                background: "white",
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <option value="Pending">Chờ xử lý</option>
              <option value="Confirmed">Đã xác nhận</option>
              <option value="Waived">Miễn trừ</option>
            </select>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 20,
            }}
          >
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Ghi chú sự cố
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              style={{
                ...inputStyle,
                background: "white",
                padding: "10px 14px",
                resize: "none",
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                marginBottom: 8,
                display: "block",
              }}
            >
              Hình ảnh minh chứng
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {existingImages.map((img) => (
                <div
                  key={img.url}
                  style={{
                    position: "relative",
                    width: 70,
                    height: 70,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <img
                    src={img.url}
                    alt="old"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    onClick={() =>
                      setExistingImages((p) =>
                        p.filter((x) => x.url !== img.url),
                      )
                    }
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: "rgba(0,0,0,0.5)",
                      border: "none",
                      color: "white",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 12 }}>×</span>
                  </button>
                </div>
              ))}
              {newPreviews.map((url, idx) => (
                <div
                  key={url}
                  style={{
                    position: "relative",
                    width: 70,
                    height: 70,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "2px solid #3b82f6",
                  }}
                >
                  <img
                    src={url}
                    alt="new"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    onClick={() => {
                      setNewImageFiles((p) => p.filter((_, i) => i !== idx));
                      setNewPreviews((p) => p.filter((_, i) => i !== idx));
                    }}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: "rgba(59,130,246,0.8)",
                      border: "none",
                      color: "white",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 12 }}>×</span>
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current.click()}
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 12,
                  border: "2px dashed #e2e8f0",
                  background: "#f8fafc",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                <span className="material-symbols-outlined">add_a_photo</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              hidden
              multiple
              onChange={handleFileChange}
            />
          </div>
        </div>
        <div
          style={{
            padding: "24px 32px",
            background: "#f8fafc",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "white",
              fontSize: 14,
              fontWeight: 700,
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 28px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
              fontSize: 14,
              fontWeight: 700,
              color: "#e7fef3",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {saving ? (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
            ) : (
              "Lưu thay đổi"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplenishModal({ open, item, onClose, onSaved, showToast }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    const maxSuggested = Math.max(
      1,
      Math.min(
        Number(item.remainingToReplenish || 0),
        Number(item.availableStock || 0),
      ),
    );
    setQuantity(maxSuggested);
    setNote("");
  }, [item]);

  if (!open || !item) return null;

  const canSubmit =
    item.status === "Confirmed" &&
    Number(item.remainingToReplenish || 0) > 0 &&
    Number(item.availableStock || 0) > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await axiosClient.post(`/LossAndDamages/${item.id}/replenish`, {
        quantity: Number(quantity),
        note: note.trim() || null,
      });
      showToast(res.data?.message || "Đã bổ sung vật tư thành công.");
      onSaved();
      onClose();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "Bổ sung vật tư thất bại.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={modalOverlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ ...modalContentStyle, width: "100%", maxWidth: 520 }}>
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
              Bổ sung vật tư #{item.id}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "4px 0 0" }}>
              {item.itemName} · Phòng {item.roomNumber}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>THIẾU CẦN BÙ</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{item.remainingToReplenish}</div>
            </div>
            <div style={{ background: "#ecfdf5", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>TỒN KHẢ DỤNG</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#166534" }}>{item.availableStock ?? 0}</div>
            </div>
            <div style={{ background: "#eff6ff", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 4 }}>ĐÃ BỔ SUNG</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1d4ed8" }}>{item.replenishedQuantity || 0}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Số lượng bổ sung lần này
            </label>
            <input
              type="number"
              min={1}
              max={Math.max(1, Math.min(item.remainingToReplenish || 1, item.availableStock || 1))}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Ghi chú bổ sung
            </label>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Ví dụ: thay bàn mới từ kho tầng 1, bổ sung thêm 1 chai do kho chỉ còn ít..."
            />
          </div>

          {!canSubmit ? (
            <div style={{ background: "#fff7ed", color: "#c2410c", borderRadius: 14, padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>
              {item.status !== "Confirmed"
                ? "Chỉ bổ sung được khi biên bản đã ở trạng thái Đã xác nhận."
                : "Kho hiện chưa có tồn khả dụng hoặc biên bản đã được bổ sung đủ."}
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: "20px 32px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "white",
              fontWeight: 700,
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: saving || !canSubmit ? "#cbd5e1" : "#166534",
              color: "white",
              fontWeight: 800,
              cursor: saving || !canSubmit ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Đang bổ sung..." : "Xác nhận bổ sung"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchReplenishModal({ open, seedItem, records, onClose, onSaved, showToast }) {
  const candidates = useMemo(
    () => getBulkReplenishCandidates(records, seedItem),
    [records, seedItem],
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || candidates.length === 0) {
      setSelectedIds([]);
      setQuantities({});
      setNote("");
      return;
    }

    const initialQuantities = {};
    const initialIds = [];
    candidates.forEach((item) => {
      const suggested = Math.max(
        1,
        Math.min(
          Number(item.remainingToReplenish || 0),
          Number(item.availableStock || 0),
        ),
      );
      initialQuantities[item.id] = suggested;
      if (Number(item.availableStock || 0) > 0) {
        initialIds.push(item.id);
      }
    });
    setQuantities(initialQuantities);
    setSelectedIds(initialIds);
    setNote("");
  }, [open, candidates]);

  if (!open || !seedItem) return null;

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const updateQuantity = (id, value, max) => {
    const parsed = Number.parseInt(value, 10);
    const safeValue = Number.isFinite(parsed)
      ? Math.max(1, Math.min(max, parsed))
      : 1;
    setQuantities((prev) => ({ ...prev, [id]: safeValue }));
  };

  const selectedCandidates = candidates.filter((item) => selectedIds.includes(item.id));
  const canSubmit = selectedCandidates.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      for (const item of selectedCandidates) {
        const max = Math.max(
          1,
          Math.min(
            Number(item.remainingToReplenish || 0),
            Number(item.availableStock || 0),
          ),
        );
        await axiosClient.post(`/LossAndDamages/${item.id}/replenish`, {
          quantity: Math.max(1, Math.min(max, Number(quantities[item.id] || 1))),
          note: note.trim() || null,
        });
      }
      showToast(
        selectedCandidates.length === 1
          ? "Đã bổ sung vật tư đã chọn."
          : `Đã bổ sung ${selectedCandidates.length} vật tư trong một lượt.`,
      );
      onSaved();
      onClose();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "Bổ sung hàng loạt thất bại.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={modalOverlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ ...modalContentStyle, width: "100%", maxWidth: 760 }}>
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
              Bổ sung hàng loạt
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "4px 0 0" }}>
              Phòng {seedItem.roomNumber || "—"} · cùng lượt lưu trú
            </h3>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>
              Chọn các vật tư đã đền bù cần bổ sung lại vào phòng trong một lượt.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "white",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={{ padding: 24, display: "grid", gap: 16 }}>
          {candidates.length === 0 ? (
            <div style={{ background: "#f8fafc", borderRadius: 16, padding: 20, color: "#64748b", fontWeight: 600 }}>
              Không còn vật tư nào trong cùng booking cần bổ sung.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {candidates.map((item) => {
                const max = Math.max(
                  1,
                  Math.min(
                    Number(item.remainingToReplenish || 0),
                    Number(item.availableStock || 0),
                  ),
                );
                const disabled = Number(item.availableStock || 0) <= 0;
                const checked = selectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1.4fr 0.8fr 0.8fr",
                      gap: 14,
                      alignItems: "center",
                      padding: 16,
                      borderRadius: 16,
                      border: checked ? "1.5px solid #4f645b" : "1px solid #e2e8f0",
                      background: disabled ? "#f8fafc" : checked ? "#f0faf5" : "white",
                      opacity: disabled ? 0.7 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleSelect(item.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.itemName}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        Thiếu cần bù: {item.remainingToReplenish} · Tồn khả dụng: {item.availableStock}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>
                        SỐ LƯỢNG BÙ
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={max}
                        value={quantities[item.id] ?? max}
                        disabled={!checked || disabled}
                        onChange={(e) => updateQuantity(item.id, e.target.value, max)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>#{item.id}</div>
                      <div style={{ marginTop: 4 }}>
                        {disabled ? "Hết tồn kho" : `Tối đa ${max}`}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>
              Ghi chú chung
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: đã lấy vật tư từ kho tầng 2 để bù lại minibar"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {!canSubmit ? (
            <div style={{ background: "#fff7ed", color: "#c2410c", borderRadius: 14, padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>
              Chọn ít nhất một vật tư còn tồn kho để bổ sung hàng loạt.
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "white",
                fontWeight: 700,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: "10px 22px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
                color: "#e7fef3",
                fontWeight: 800,
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: canSubmit ? 1 : 0.55,
              }}
            >
              {saving ? "Đang bổ sung..." : "Bổ sung đã chọn"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export function LossAndDamageHeader({ recordCount, onRefresh }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#1c1917",
              letterSpacing: "-0.025em",
              margin: "0 0 4px",
            }}
          >
            Thất thoát &amp; Đền bù
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Tổng{" "}
            <span style={{ fontWeight: 700, color: "#1c1917" }}>{recordCount}</span>{" "}
            biên bản sự cố
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 22px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            background: "white",
            color: "#1c1917",
            border: "1.5px solid #e2e8e1",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            refresh
          </span>
          Làm mới
        </button>
      </div>
    </>
  );
}

export function LossAndDamageStats({ stats, lastUpdated, fmtCurrency }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          background: "#fff7ed",
          border: "1.5px solid #fde68a",
          borderRadius: 16,
          padding: "16px 18px",
        }}
      >
        <p
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            color: "#d97706",
            margin: "0 0 6px",
            opacity: 0.8,
          }}
        >
          SỰ CỐ TRÊN TRANG
        </p>
        <p style={{ fontSize: 28, fontWeight: 800, color: "#d97706", margin: 0 }}>
          {stats.totalOnPage}{" "}
          <span
            style={{
              fontSize: 13,
              color: "#d97706",
              fontWeight: 500,
              opacity: 0.7,
            }}
          >
            Bản ghi
          </span>
        </p>
      </div>

      <div
        style={{
          background: "#fef2f2",
          border: "1.5px solid #fecaca",
          borderRadius: 16,
          padding: "16px 18px",
        }}
      >
        <p
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            color: "#dc2626",
            margin: "0 0 6px",
            opacity: 0.8,
          }}
        >
          TỔNG TIỀN ĐỀN BÙ
        </p>
        <p style={{ fontSize: 24, fontWeight: 800, color: "#dc2626", margin: 0 }}>
          {fmtCurrency(stats.penaltyOnPage)}
        </p>
      </div>

      <div
        style={{
          background: "#f8f9fa",
          border: "1.5px solid #f1f0ea",
          borderRadius: 16,
          padding: "16px 18px",
        }}
      >
        <p
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            color: "#6b7280",
            margin: "0 0 6px",
            opacity: 0.8,
          }}
        >
          CẬP NHẬT GẦN NHẤT
        </p>
        <p style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", margin: 0 }}>
          {lastUpdated
            ? lastUpdated.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--"}
        </p>
      </div>
    </div>
  );
}

export function LossAndDamageToolbar({
  filters,
  setFilters,
  onApplyFilters,
  onClearFilters,
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        padding: "18px 22px",
        border: "1px solid #f1f0ea",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#f9f8f3",
            padding: "8px 16px",
            borderRadius: 12,
            border: "1.5px solid #e2e8e1",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 18, color: "#9ca3af" }}
          >
            calendar_today
          </span>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
            style={{
              border: "none",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              outline: "none",
              color: "#1c1917",
            }}
          />
          <span style={{ color: "#e2e8f0" }}>—</span>
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
            style={{
              border: "none",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              outline: "none",
              color: "#1c1917",
            }}
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "1.5px solid #e2e8e1",
            fontSize: 13,
            fontWeight: 600,
            background: "#f9f8f3",
            cursor: "pointer",
            outline: "none",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Pending">Chờ xử lý</option>
          <option value="Confirmed">Đã xác nhận</option>
          <option value="Waived">Miễn trừ</option>
        </select>
        <button
          onClick={onApplyFilters}
          style={{
            padding: "10px 22px",
            background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
            color: "#e7fef3",
            borderRadius: 12,
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            manage_search
          </span>
          Lọc kết quả
        </button>
      </div>
      <button
        onClick={onClearFilters}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "9px 16px",
          borderRadius: 10,
          border: "1.5px solid #e2e8e1",
          background: "white",
          color: "#6b7280",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,.04)",
          fontFamily: "Manrope, sans-serif",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#4f645b";
          e.currentTarget.style.color = "#4f645b";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#e2e8e1";
          e.currentTarget.style.color = "#6b7280";
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          filter_alt_off
        </span>
        Xóa bộ lọc
      </button>
    </div>
  );
}

export function LossAndDamageTable({
  loading,
  paged,
  records,
  page,
  pageSize,
  recordsCount,
  totalPages,
  fmtDateTime,
  fmtCurrency,
  onView,
  onEdit,
  onReplenish,
  onBatchReplenish,
  onDelete,
  onPageChange,
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        border: "1px solid #f1f0ea",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(249,248,243,.6)" }}>
            {[
              "ID",
              "Minh chứng",
              "Phòng",
              "Vật liệu sự cố",
              "Số lượng",
              "Đền bù",
              "Thời gian báo cáo",
              "Thao tác",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: "18px 24px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                Đang đồng bộ dữ liệu...
              </td>
            </tr>
          ) : paged.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
                Phòng ban chưa ghi nhận sự cố nào
              </td>
            </tr>
          ) : (
            paged.map((rec) => {
              const imgs = rec.images || [];
              const dt = fmtDateTime(rec.createdAt);
              const batchCandidates = getBulkReplenishCandidates(records, rec);
              const canBatchReplenish = batchCandidates.length > 1;
              return (
                <tr key={rec.id} className="table-row">
                  <td style={{ padding: "20px 24px", fontSize: 13, fontWeight: 700, color: "#64748b" }}>
                    #{rec.id}
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    {imgs.length > 0 ? (
                      <div className="badge-p" style={{ background: "#ecfdf5", color: "#065f46" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          image
                        </span>
                        Có hình ảnh ({imgs.length})
                      </div>
                    ) : (
                      <div className="badge-p" style={{ background: "#f1f5f9", color: "#64748b" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          hide_image
                        </span>
                        Không có ảnh
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    <div
                      style={{
                        padding: "3px 10px",
                        borderRadius: 8,
                        background: "#f0faf5",
                        color: "#1a3826",
                        fontWeight: 800,
                        fontSize: 14,
                        display: "inline-block",
                        border: "1.5px solid #a7f3d0",
                      }}
                    >
                      {rec.roomNumber}
                    </div>
                  </td>
                  <td style={{ padding: "20px 24px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    <div>{rec.itemName}</div>
                    {rec.status === "Confirmed" ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: rec.remainingToReplenish > 0 ? "#fff7ed" : "#ecfdf5",
                          color: rec.remainingToReplenish > 0 ? "#c2410c" : "#15803d",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {rec.remainingToReplenish > 0
                          ? `Còn thiếu ${rec.remainingToReplenish}`
                          : "Đã bổ sung đủ"}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: "20px 24px", fontSize: 15, fontWeight: 800, color: "#64748b" }}>
                    {rec.quantity}
                  </td>
                  <td style={{ padding: "20px 24px", fontSize: 15, fontWeight: 800, color: "#ef4444" }}>
                    {fmtCurrency(rec.penaltyAmount)}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{dt.date}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{dt.time}</div>
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-icon-p" onClick={() => onView(rec)} title="Xem chi tiết">
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      <button className="btn-icon-p" onClick={() => onEdit(rec)} title="Chỉnh sửa">
                        <span className="material-symbols-outlined">edit_square</span>
                      </button>
                      <button
                        className="btn-icon-p"
                        onClick={() => onReplenish(rec)}
                        title="Bổ sung lại vào phòng"
                        disabled={rec.status !== "Confirmed" || rec.remainingToReplenish <= 0}
                        style={
                          rec.status !== "Confirmed" || rec.remainingToReplenish <= 0
                            ? { opacity: 0.4, cursor: "not-allowed" }
                            : { color: "#166534" }
                        }
                      >
                        <span className="material-symbols-outlined">inventory_2</span>
                      </button>
                      <button
                        className="btn-icon-p"
                        onClick={() => onBatchReplenish(rec)}
                        title="Bổ sung hàng loạt theo booking"
                        disabled={!canBatchReplenish}
                        style={
                          !canBatchReplenish
                            ? { opacity: 0.4, cursor: "not-allowed" }
                            : { color: "#1d4ed8" }
                        }
                      >
                        <span className="material-symbols-outlined">playlist_add_check</span>
                      </button>
                      <button className="btn-icon-p" onClick={() => onDelete(rec)} title="Xóa" style={{ color: "#ef4444" }}>
                        <span className="material-symbols-outlined">delete_forever</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <footer
        style={{
          padding: "14px 24px",
          borderTop: "1px solid #f1f0ea",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, recordsCount)} /{" "}
          <span style={{ fontWeight: 700, color: "#6b7280" }}>{recordsCount}</span> biên bản
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="pg-btn" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              chevron_left
            </span>
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const n = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i;
            if (n > totalPages) return null;
            return (
              <button key={n} className={`pg-btn${n === page ? " active" : ""}`} onClick={() => onPageChange(n)}>
                {n}
              </button>
            );
          })}
          <button className="pg-btn" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              chevron_right
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LossAndDamagePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    status: "",
  });
  const [toasts, setToasts] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [replenishItem, setReplenishItem] = useState(null);
  const [batchReplenishItem, setBatchReplenishItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const intervalRef = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
  }, []);

  const dismissToast = useCallback(
    (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const fetchRecords = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.fromDate) params.append("fromDate", filters.fromDate);
        if (filters.toDate) params.append("toDate", filters.toDate);
        if (filters.status) params.append("status", filters.status);
        const res = await axiosClient.get(
          `/LossAndDamages?${params.toString()}`,
        );
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setRecords(data.map(normalizeLossRecord));
        setLastUpdated(new Date());
      } catch {
        if (!silent) showToast("Lỗi kết nối máy chủ.", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filters, showToast],
  );

  useEffect(() => {
    fetchRecords();
    intervalRef.current = setInterval(() => fetchRecords(true), 30000);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [fetchRecords]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await axiosClient.delete(`/LossAndDamages/${deleteTarget.id}`);
      showToast("Đã xóa vĩnh viễn biên bản.");
      setDeleteTarget(null);
      fetchRecords(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const stats = {
    totalOnPage: records.slice((page - 1) * pageSize, page * pageSize).length,
    penaltyOnPage: records
      .slice((page - 1) * pageSize, page * pageSize)
      .reduce((s, r) => s + (r.penaltyAmount || 0), 0),
  };

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const paged = records.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <style>{`        * { font-family: 'Manrope', sans-serif; }        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes modalSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .table-row { transition: background 0.1s; border-bottom: 1px solid #f1f0ea; }
        .table-row:hover { background: #fafaf8 !important; }
        .btn-icon-p { width: 34px; height: 34px; border-radius: 9px; border: 1.5px solid #f1f0ea; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: #6b7280; }
        .btn-icon-p:hover { border-color: #4f645b; color: #4f645b; background: #f0faf5; }
        .pg-btn { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#6b7280; background:transparent; border:none; cursor:pointer; transition:background .15s,color .15s; font-family:'Manrope',sans-serif; }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
        .badge-p { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
      `}</style>

      <div
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 120,
          pointerEvents: "none",
          minWidth: 280,
          width: "fit-content",
        }}
      >
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={dismissToast} />
        ))}
      </div>
      <DetailModal
        open={!!detailItem}
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
      <EditModal
        open={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSaved={() => fetchRecords(true)}
        showToast={showToast}
      />
      <ReplenishModal
        open={!!replenishItem}
        item={replenishItem}
        onClose={() => setReplenishItem(null)}
        onSaved={() => fetchRecords(true)}
        showToast={showToast}
      />
      <BatchReplenishModal
        open={!!batchReplenishItem}
        seedItem={batchReplenishItem}
        records={records}
        onClose={() => setBatchReplenishItem(null)}
        onSaved={() => fetchRecords(true)}
        showToast={showToast}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Xác nhận xóa"
        message="Hành động này sẽ xóa vĩnh viễn biên bản và tất cả hình ảnh liên quan."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 0 }}>
        <LossAndDamageHeader
          recordCount={records.length}
          onRefresh={() => fetchRecords()}
        />
        <LossAndDamageStats
          stats={stats}
          lastUpdated={lastUpdated}
          fmtCurrency={fmtCurrency}
        />
        <LossAndDamageToolbar
          filters={filters}
          setFilters={setFilters}
          onApplyFilters={() => fetchRecords()}
          onClearFilters={() => {
            setFilters({ fromDate: "", toDate: "", status: "" });
            fetchRecords();
          }}
        />
        <LossAndDamageTable
          loading={loading}
          paged={paged}
          records={records}
          page={page}
          pageSize={pageSize}
          recordsCount={records.length}
          totalPages={totalPages}
          fmtDateTime={fmtDateTime}
          fmtCurrency={fmtCurrency}
          onView={setDetailItem}
          onEdit={setEditItem}
          onReplenish={setReplenishItem}
          onBatchReplenish={setBatchReplenishItem}
          onDelete={setDeleteTarget}
          onPageChange={setPage}
        />
      </div>
    </>
  );
}




