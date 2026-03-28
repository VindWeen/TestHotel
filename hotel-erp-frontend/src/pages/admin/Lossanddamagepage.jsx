// src/pages/admin/LossAndDamagePage.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import axiosClient from "../../api/axios";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCurrency = (n) =>
  n == null ? "0đ" : new Intl.NumberFormat("vi-VN").format(n) + "đ";

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
});

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
function Toast({ id, msg, type = "success", onDismiss }) {
  const cfg = {
    success: {
      bg: "#ffffff",
      border: "#e2e8f0",
      text: "#1a202c",
      icon: "check_circle",
      iconColor: "#22c55e",
    },
    error: {
      bg: "#ffffff",
      border: "#e2e8f0",
      text: "#1a202c",
      icon: "error",
      iconColor: "#ef4444",
    },
  }[type] || {
    bg: "#ffffff",
    border: "#e2e8f0",
    text: "#1a202c",
    icon: "info",
    iconColor: "#3b82f6",
  };

  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        borderRadius: 16,
        boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        pointerEvents: "auto",
        marginBottom: 12,
        padding: "14px 20px",
        animation: "toastIn .4s cubic-bezier(.22,1,.36,1) forwards",
        minWidth: 300,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          color: cfg.iconColor,
          fontSize: 24,
          fontVariationSettings: "'FILL' 1",
        }}
      >
        {cfg.icon}
      </span>
      <p style={{ fontSize: 14, fontWeight: 600, margin: 0, flex: 1 }}>{msg}</p>
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
              background: "#0f172a",
              fontSize: 14,
              fontWeight: 700,
              color: "white",
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
    return () => clearInterval(intervalRef.current);
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
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
                body { background: #f8fafc; color: #1e293b; font-family: 'Inter', sans-serif; }
                .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; vertical-align:middle; }
                @keyframes toastIn { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes modalSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes spin { to{transform:rotate(360deg)} }
                .card-premium { background: white; border: 1px solid #f1f5f9; border-radius: 24px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); transition: all 0.3s ease; }
                .card-premium:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.05); }
                .table-row { transition: background 0.1s; border-bottom: 1px solid #f8fafc; }
                .table-row:hover { background: #fbfbfc; }
                .btn-icon-p { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #f1f5f9; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #64748b; }
                .btn-icon-p:hover { border-color: #0f172a; color: #0f172a; transform: scale(1.05); background: #f8fafc; }
                .badge-p { padding: 4px 12px; borderRadius: 20px; fontSize: 12px; fontWeight: 700; display: inline-flex; alignItems: center; gap: 6px; }
            `}</style>

      <div
        style={{
          position: "fixed",
          bottom: 40,
          right: 40,
          zIndex: 2000,
          pointerEvents: "none",
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
      <ConfirmDialog
        open={!!deleteTarget}
        title="Xác nhận xóa"
        message="Hành động này sẽ xóa vĩnh viễn biên bản và tất cả hình ảnh liên quan."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 20px" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#64748b",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                inventory_2
              </span>{" "}
              Quản lý kho vật tư
            </div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Thất thoát &amp; Đền bù
            </h1>
          </div>
        </header>

        {/* Dashboard Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div className="card-premium">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#94a3b8",
                    margin: "0 0 4px",
                  }}
                >
                  SỰ CỐ TRÊN TRANG NÀY
                </p>
                <h2
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: "#0f172a",
                    margin: 0,
                  }}
                >
                  {stats.totalOnPage}{" "}
                  <span
                    style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500 }}
                  >
                    Bản ghi
                  </span>
                </h2>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "#fff7ed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f97316",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 28 }}
                >
                  warning
                </span>
              </div>
            </div>
          </div>
          <div className="card-premium">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#94a3b8",
                    margin: "0 0 4px",
                  }}
                >
                  TỔNG TIỀN ĐỀN BÙ
                </p>
                <h2
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: "#ef4444",
                    margin: 0,
                  }}
                >
                  {fmtCurrency(stats.penaltyOnPage)}
                </h2>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "#fef2f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 28 }}
                >
                  monetization_on
                </span>
              </div>
            </div>
          </div>
          <div className="card-premium">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#94a3b8",
                    margin: "0 0 4px",
                  }}
                >
                  CẬP NHẬT GẦN NHẤT
                </p>
                <h2
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: "#0f172a",
                    margin: 0,
                  }}
                >
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </h2>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 28 }}
                >
                  update
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            background: "white",
            borderRadius: 24,
            padding: "20px 24px",
            border: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#f8fafc",
                padding: "8px 16px",
                borderRadius: 12,
                border: "1px solid #f1f5f9",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: "#94a3b8" }}
              >
                calendar_today
              </span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, fromDate: e.target.value }))
                }
                style={{
                  border: "none",
                  background: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  outline: "none",
                  color: "#1e293b",
                }}
              />
              <span style={{ color: "#e2e8f0" }}>—</span>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, toDate: e.target.value }))
                }
                style={{
                  border: "none",
                  background: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  outline: "none",
                  color: "#1e293b",
                }}
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid #f1f5f9",
                fontSize: 13,
                fontWeight: 600,
                background: "#f8fafc",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="Pending">Chờ xử lý</option>
              <option value="Confirmed">Đã xác nhận</option>
              <option value="Waived">Miễn trừ</option>
            </select>
            <button
              onClick={() => fetchRecords()}
              style={{
                padding: "10px 24px",
                background: "#0f172a",
                color: "white",
                borderRadius: 12,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                manage_search
              </span>{" "}
              Lọc kết quả
            </button>
          </div>
          <button
            onClick={() => {
              setFilters({ fromDate: "", toDate: "", status: "" });
              fetchRecords();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Làm mới bộ lọc
          </button>
        </div>

        {/* Main Table */}
        <div
          style={{
            background: "white",
            borderRadius: 28,
            border: "1px solid #f1f5f9",
            overflow: "hidden",
            boxShadow: "0 4px 30px rgba(0,0,0,0.02)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fbfbfc" }}>
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
                  <td
                    colSpan={8}
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    Đang đồng bộ dữ liệu...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: 60,
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    Phòng ban chưa ghi nhận sự cố nào
                  </td>
                </tr>
              ) : (
                paged.map((rec) => {
                  const imgs = rec.images || [];
                  const dt = fmtDateTime(rec.createdAt);
                  return (
                    <tr key={rec.id} className="table-row">
                      <td
                        style={{
                          padding: "20px 24px",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        #{rec.id}
                      </td>
                      <td style={{ padding: "20px 24px" }}>
                        {imgs.length > 0 ? (
                          <div
                            className="badge-p"
                            style={{ background: "#ecfdf5", color: "#065f46" }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 16 }}
                            >
                              image
                            </span>{" "}
                            Có hình ảnh ({imgs.length})
                          </div>
                        ) : (
                          <div
                            className="badge-p"
                            style={{ background: "#f1f5f9", color: "#64748b" }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 16 }}
                            >
                              hide_image
                            </span>{" "}
                            Không có ảnh
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "20px 24px" }}>
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontWeight: 800,
                            fontSize: 14,
                            display: "inline-block",
                          }}
                        >
                          {rec.roomNumber}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "20px 24px",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {rec.itemName}
                      </td>
                      <td
                        style={{
                          padding: "20px 24px",
                          fontSize: 15,
                          fontWeight: 800,
                          color: "#64748b",
                        }}
                      >
                        {rec.quantity}
                      </td>
                      <td
                        style={{
                          padding: "20px 24px",
                          fontSize: 15,
                          fontWeight: 800,
                          color: "#ef4444",
                        }}
                      >
                        {fmtCurrency(rec.penaltyAmount)}
                      </td>
                      <td style={{ padding: "20px 24px" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {dt.date}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {dt.time}
                        </div>
                      </td>
                      <td style={{ padding: "20px 24px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn-icon-p"
                            onClick={() => setDetailItem(rec)}
                            title="Xem chi tiết"
                          >
                            <span className="material-symbols-outlined">
                              visibility
                            </span>
                          </button>
                          <button
                            className="btn-icon-p"
                            onClick={() => setEditItem(rec)}
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined">
                              edit_square
                            </span>
                          </button>
                          <button
                            className="btn-icon-p"
                            onClick={() => setDeleteTarget(rec)}
                            title="Xóa"
                            style={{ color: "#ef4444" }}
                          >
                            <span className="material-symbols-outlined">
                              delete_forever
                            </span>
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
              padding: "20px 32px",
              borderTop: "1px solid #f8fafc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
              Hiển thị <strong>{paged.length}</strong> /{" "}
              <strong>{records.length}</strong> biên bản sự cố
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn-icon-p"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  className="btn-icon-p"
                  onClick={() => setPage(i + 1)}
                  style={
                    page === i + 1
                      ? {
                          background: "#0f172a",
                          color: "white",
                          borderColor: "#0f172a",
                          fontWeight: 800,
                        }
                      : {}
                  }
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="btn-icon-p"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
