// src/pages/admin/RoomDetailPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { getRoomById, updateBusinessStatus, updateCleaningStatus, getRooms } from "../../api/roomsApi";
import {
    getInventoryByRoom,
    createInventory,
    updateInventory,
    cloneInventory,
    deleteInventory,
    previewSyncInventoryStock,
    syncInventoryStock,
} from "../../api/roomInventoriesApi";
import { getEquipments } from "../../api/equipmentsApi";

// ??? Toast ????????????????????????????????????????????????????????????????????
const TOAST_CFG = {
    success: { bg: "#1e3a2f", border: "#2d5a45", text: "#a7f3d0", prog: "#34d399", icon: "check_circle" },
    error: { bg: "#3a1e1e", border: "#5a2d2d", text: "#fca5a5", prog: "#f87171", icon: "error" },
    warning: { bg: "#3a2e1a", border: "#5a4820", text: "#fcd34d", prog: "#fbbf24", icon: "warning" },
    info: { bg: "#1e2f3a", border: "#2d4a5a", text: "#93c5fd", prog: "#60a5fa", icon: "info" },
};

function Toast({ id, msg, type = "success", onDismiss }) {
    const s = TOAST_CFG[type] || TOAST_CFG.info;
    useEffect(() => {
        const t = setTimeout(() => onDismiss(id), 4000);
        return () => clearTimeout(t);
    }, [id, onDismiss]);
    return (
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.3)", marginBottom: 10, animation: "toastIn .35s cubic-bezier(.22,1,.36,1) forwards", minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 13px 9px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 19, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: 0, flex: 1 }}>{msg}</p>
                <button onClick={() => onDismiss(id)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2, color: "inherit" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
            </div>
            <div style={{ margin: "0 12px 9px", height: 3, borderRadius: 9999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 9999, background: s.prog, animation: "toastProgress 4000ms linear forwards" }} />
            </div>
        </div>
    );
}

// ??? Skeleton ?????????????????????????????????????????????????????????????????
const Skel = ({ w = "100%", h = 16, r = 8 }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%)", backgroundSize: "600px", animation: "shimmer 1.4s infinite" }} />
);


const cardStyle = {
  background: "white",
  borderRadius: 16,
  boxShadow: "0 1px 4px rgba(0,0,0,.06)",
  border: "1px solid #f1f0ea",
};

export function RoomDetailHeader({
  loadingRoom,
  room,
  activeTab,
  loadingInv,
  savingStatus,
  onBack,
  onPrint,
  onRefreshInventory,
  onSaveStatus,
  Skel,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 32,
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      <div>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            color: "#4f645b",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginBottom: 12,
            padding: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_back
          </span>
          Quay lại danh sách
        </button>
        {loadingRoom ? (
          <Skel w={280} h={34} r={8} />
        ) : (
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#1c1917",
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Chi tiết phòng - {room?.roomNumber}
          </h1>
        )}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onPrint}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            background: "white",
            color: "#1c1917",
            border: "1px solid #e2e8e1",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,.06)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            print
          </span>
          In báo cáo
        </button>
        {activeTab === "inventory" && (
          <button
            onClick={onRefreshInventory}
            disabled={loadingInv}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              background: "white",
              color: "#1c1917",
              border: "1px solid #e2e8e1",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,.06)",
              opacity: loadingInv ? 0.65 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              refresh
            </span>
            {loadingInv ? "Đang tải..." : "Làm mới"}
          </button>
        )}
        {activeTab === "basic" && (
          <button
            onClick={onSaveStatus}
            disabled={savingStatus}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 24px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
              color: "#e7fef3",
              border: "none",
              cursor: "pointer",
              opacity: savingStatus ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(79,100,91,.25)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              save
            </span>
            {savingStatus ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        )}
      </div>
    </div>
  );
}

export function RoomDetailTabs({
  activeTab,
  canManageInventory,
  inventoryCount,
  onChangeTab,
}) {
  const tabs = [
    { key: "basic", label: "Thông tin cơ bản", icon: "info" },
    ...(canManageInventory
      ? [{ key: "inventory", label: "Quản lý vật tư", icon: "inventory_2", count: inventoryCount }]
      : []),
  ];

  return (
    <div style={{ display: "flex", gap: 32, marginBottom: 28, borderBottom: "1px solid #f1f0ea" }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className="tab-btn"
          onClick={() => onChangeTab(tab.key)}
          style={{ color: activeTab === tab.key ? "#4f645b" : "#9ca3af" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 17, fontVariationSettings: activeTab === tab.key ? "'FILL' 1" : "'FILL' 0" }}
            >
              {tab.icon}
            </span>
            {tab.label}
            {tab.count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: activeTab === tab.key ? "rgba(79,100,91,.15)" : "#f3f4f6",
                  color: activeTab === tab.key ? "#4f645b" : "#9ca3af",
                  padding: "1px 7px",
                  borderRadius: 9999,
                }}
              >
                {tab.count}
              </span>
            )}
          </span>
          {activeTab === tab.key && (
            <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#4f645b", borderRadius: "3px 3px 0 0" }} />
          )}
        </button>
      ))}
    </div>
  );
}

export function RoomBasicTab({
  loadingRoom,
  room,
  businessStatus,
  cleaningStatus,
  bsCfg,
  csCfg,
  onBusinessStatusChange,
  onCleaningStatusChange,
  Skel,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardStyle, padding: "28px 32px" }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1c1917", margin: "0 0 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 20, background: "#4f645b", borderRadius: 2 }} />
          Tổng quan phòng
        </h3>
        {loadingRoom ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={70} r={12} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
            {[
              { label: "Số phòng", value: room?.roomNumber, icon: "door_front" },
              { label: "Tầng", value: room?.floor ? `Tầng ${room.floor}` : "-", icon: "apartment" },
              { label: "Hạng phòng", value: room?.roomTypeName || "-", icon: "bed" },
              { label: "View phòng", value: room?.viewType || "-", icon: "landscape" },
            ].map((field, i) => (
              <div key={i} style={{ background: "#fafaf8", borderRadius: 14, padding: "16px 18px", border: "1px solid #f1f0ea" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#9ca3af" }}>{field.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "#9ca3af" }}>{field.label}</span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", margin: 0 }}>{field.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, padding: "28px 32px" }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1c1917", margin: "0 0 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 20, background: "#4f645b", borderRadius: 2 }} />
          Trạng thái vận hành
        </h3>

        {!loadingRoom && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 9999, background: bsCfg.badge }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: bsCfg.dot }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: bsCfg.badgeText }}>Kinh doanh: {bsCfg.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 9999, background: csCfg.badge }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: csCfg.dot }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: csCfg.badgeText }}>Vệ sinh: {csCfg.label}</span>
            </div>
          </div>
        )}

        {loadingRoom ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Skel h={52} r={12} />
            <Skel h={52} r={12} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 8 }}>
                Trạng thái kinh doanh
              </label>
              <select
                value={businessStatus}
                onChange={(e) => onBusinessStatusChange(e.target.value)}
                style={{ width: "100%", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "#31332e", background: "rgba(227,227,219,.5)", outline: "none" }}
              >
                <option value="Available">Sẵn sàng đón khách</option>
                <option value="Occupied">Đang có khách</option>
                <option value="Disabled">Ngưng kinh doanh</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 8 }}>
                Trạng thái buồng phòng
              </label>
              <select
                value={cleaningStatus}
                onChange={(e) => onCleaningStatusChange(e.target.value)}
                style={{ width: "100%", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "#31332e", background: "rgba(227,227,219,.5)", outline: "none" }}
              >
                <option value="Clean">Đã dọn dẹp (Clean)</option>
                <option value="Dirty">Phòng bẩn (Dirty)</option>
                <option value="PendingLoss">Chờ xử lý thất thoát (PendingLoss)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {!loadingRoom && room?.notes && (
        <div style={{ ...cardStyle, padding: "24px 32px" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1c1917", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 4, height: 20, background: "#4f645b", borderRadius: 2 }} />
            Ghi chú
          </h3>
          <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>{room.notes}</p>
        </div>
      )}
    </div>
  );
}

export function RoomInventoryTab({
  inventory,
  paginatedInv,
  loadingInv,
  syncingStock,
  syncPreviewLoading,
  deletingId,
  bulkDeleteMode,
  selectedItemIds,
  bulkDeleting,
  page,
  totalPages,
  pageSize,
  fmtCurrency,
  onAdd,
  onOpenSyncPreview,
  onClone,
  onEdit,
  onDelete,
  onToggleBulkDeleteMode,
  onToggleSelectItem,
  onSelectAllOnPage,
  onClearSelections,
  onDeleteSelected,
  onPageChange,
  Skel,
}) {
  const allOnPageSelected =
    paginatedInv.length > 0 && paginatedInv.every((item) => selectedItemIds.includes(item.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onAdd}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(79,100,91,.25)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>add</span>
            Thêm vật tư
          </button>
          <button
            onClick={onOpenSyncPreview}
            disabled={syncingStock || syncPreviewLoading}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "white", color: "#1c1917", border: "1px solid #e2e8e1", cursor: "pointer", opacity: syncingStock || syncPreviewLoading ? 0.65 : 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>sync_alt</span>
            {syncPreviewLoading ? "Đang tải..." : "Đồng bộ kho vật tư"}
          </button>
          <button
            onClick={onClone}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "white", color: "#1c1917", border: "1px solid #e2e8e1", cursor: "pointer" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>content_copy</span>
            Clone từ phòng mẫu
          </button>
          <button
            onClick={onToggleBulkDeleteMode}
            disabled={loadingInv || bulkDeleting || inventory.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              background: bulkDeleteMode ? "#fef2f2" : "white",
              color: "#dc2626",
              border: "1px solid #fecaca",
              cursor: "pointer",
              opacity: loadingInv || bulkDeleting || inventory.length === 0 ? 0.6 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
              {bulkDeleteMode ? "close" : "delete"}
            </span>
            {bulkDeleteMode ? "Thoát xóa hàng loạt" : "Xóa hàng loạt"}
          </button>
          {bulkDeleteMode && (
            <>
              <button
                onClick={onSelectAllOnPage}
                disabled={paginatedInv.length === 0}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "white", color: "#1c1917", border: "1px solid #e2e8e1", cursor: "pointer", opacity: paginatedInv.length === 0 ? 0.6 : 1 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                  {allOnPageSelected ? "check_box" : "check_box_outline_blank"}
                </span>
                {allOnPageSelected ? "Bỏ chọn trang" : "Chọn cả trang"}
              </button>
              <button
                onClick={onClearSelections}
                disabled={selectedItemIds.length === 0}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "white", color: "#1c1917", border: "1px solid #e2e8e1", cursor: "pointer", opacity: selectedItemIds.length === 0 ? 0.6 : 1 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>deselect</span>
                Bỏ chọn tất cả
              </button>
              <button
                onClick={onDeleteSelected}
                disabled={selectedItemIds.length === 0 || bulkDeleting}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", opacity: selectedItemIds.length === 0 || bulkDeleting ? 0.65 : 1 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                  {bulkDeleting ? "hourglass_empty" : "delete_forever"}
                </span>
                {bulkDeleting ? "Đang xóa..." : `Xóa đã chọn (${selectedItemIds.length})`}
              </button>
              <div style={{ display: "flex", alignItems: "center", padding: "0 6px", fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                Đã chọn: <strong style={{ color: "#4f645b", marginLeft: 4 }}>{selectedItemIds.length}</strong>
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
          Tổng số vật tư: <strong style={{ color: "#4f645b", marginLeft: 4 }}>{inventory.length}</strong>
        </div>
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: bulkDeleteMode ? 920 : 860 }}>
            <thead>
              <tr style={{ background: "rgba(249,248,243,.5)" }}>
                {(bulkDeleteMode
                  ? ["Chọn", "Mã VT", "Tên vật tư", "Loại", "Số lượng", "Giá đền bù (VND)", "Ghi chú", "Thao tác"]
                  : ["Mã VT", "Tên vật tư", "Loại", "Số lượng", "Giá đền bù (VND)", "Ghi chú", "Thao tác"]
                ).map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "14px 20px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "#9ca3af",
                      textAlign: bulkDeleteMode
                        ? i === 0
                          ? "center"
                          : i === 4
                            ? "center"
                            : (i === 5 || i === 7)
                              ? "right"
                              : "left"
                        : i === 3
                          ? "center"
                          : (i === 4 || i === 6)
                            ? "right"
                            : "left",
                      borderBottom: "1px solid #f1f0ea",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingInv ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: bulkDeleteMode ? 8 : 7 }).map((_, j) => (
                      <td key={j} style={{ padding: "16px 20px" }}>
                        <Skel h={13} w={j === 0 ? 60 : j === 3 ? 40 : j === 4 ? 90 : j === 5 ? 160 : 130} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedInv.length === 0 ? (
                <tr>
                  <td colSpan={bulkDeleteMode ? 8 : 7} style={{ padding: "56px 0", textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#d1d5db", display: "block", marginBottom: 12 }}>inventory_2</span>
                    <p style={{ color: "#9ca3af", fontWeight: 500, fontSize: 14, margin: 0 }}>Chưa có vật tư nào trong phòng này</p>
                    <button onClick={onAdd} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#4f645b", color: "#e7fef3", border: "none", cursor: "pointer" }}>
                      + Thêm vật tư đầu tiên
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedInv.map((item, i) => {
                  const code = `VT-${String(item.id).padStart(4, "0")}`;
                  const selected = selectedItemIds.includes(item.id);
                  return (
                    <tr key={item.id} className="inv-row fade-row" style={{ borderBottom: "1px solid #fafaf8", animationDelay: `${i * 25}ms` }}>
                      {bulkDeleteMode && (
                        <td style={{ padding: "16px 20px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => onToggleSelectItem(item.id)}
                            aria-label={selected ? "Bỏ chọn vật tư" : "Chọn vật tư"}
                            aria-pressed={selected}
                            style={{
                              width: 16,
                              height: 16,
                              cursor: "pointer",
                              border: "1.5px solid #94a3b8",
                              borderRadius: 4,
                              backgroundColor: selected ? "#4f645b" : "#fff",
                              boxSizing: "border-box",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                            }}
                          >
                            {selected && (
                              <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#fff", lineHeight: 1 }}>
                                check
                              </span>
                            )}
                          </button>
                        </td>
                      )}
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#4f645b", letterSpacing: ".05em" }}>{code}</span>
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 500, color: "#1c1917" }}>{item.equipmentName}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, background: item.itemType === "Asset" ? "#dbeafe" : "#fef3c7", color: item.itemType === "Asset" ? "#1d4ed8" : "#92400e" }}>
                          {item.itemType}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, padding: "3px 12px", borderRadius: 9999, background: "#e8f0ee", color: "#4f645b" }}>
                          {String(item.quantity ?? 0).padStart(2, "0")}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right", fontSize: 14, fontWeight: 600, color: "#1c1917" }}>
                        {fmtCurrency(item.priceIfLost)}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13, color: "#6b7280", maxWidth: 260 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.note || "-"}
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                          <button className="action-btn" onClick={() => onEdit(item)} title="Chỉnh sửa" style={{ color: "#4f645b" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                          </button>
                          {!bulkDeleteMode && (
                            <button className="action-btn" onClick={() => onDelete(item.id, item.equipmentName)} disabled={deletingId === item.id} title="Xóa" style={{ color: deletingId === item.id ? "#d1d5db" : "#ef4444" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                                {deletingId === item.id ? "hourglass_empty" : "delete"}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loadingInv && inventory.length > pageSize && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, inventory.length)} / {inventory.length} vật tư
            </span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button className="pg-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`pg-btn${n === page ? " active" : ""}`} onClick={() => onPageChange(n)}>
                  {n}
                </button>
              ))}
              <button className="pg-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



export function InventoryModal({ open, onClose, onSave, editItem, roomId, equipments }) {
  const [form, setForm] = useState({ equipmentId: "", itemType: "Asset", quantity: 1, priceIfLost: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (editItem) {
      setForm({
        equipmentId: editItem.equipmentId || "",
        itemType: editItem.itemType || "Asset",
        quantity: editItem.quantity ?? 1,
        priceIfLost: editItem.priceIfLost ?? "",
        note: editItem.note || "",
      });
    } else {
      setForm({ equipmentId: "", itemType: "Asset", quantity: 1, priceIfLost: "", note: "" });
    }
    setErr("");
  }, [editItem, open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.equipmentId) {
      setErr("Vui lòng chọn vật tư từ danh mục.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const payload = {
        equipmentId: Number(form.equipmentId),
        itemType: form.itemType,
        quantity: Number(form.quantity),
        priceIfLost: form.priceIfLost ? Number(form.priceIfLost) : null,
        note: form.note?.trim() || null,
      };
      if (editItem) await updateInventory(editItem.id, payload);
      else await createInventory({ roomId, ...payload });
      onSave();
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,.2)", animation: "modalIn .25s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0 }}>{editItem ? "Chỉnh sửa vật tư" : "Thêm vật tư mới"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 28px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Chọn vật tư *</label>
            <select
              value={form.equipmentId}
              onChange={(e) => {
                const equipmentId = e.target.value;
                const selectedEquipment = equipments.find((x) => String(x.id) === equipmentId);
                setForm((f) => ({ ...f, equipmentId, priceIfLost: f.priceIfLost || selectedEquipment?.defaultPriceIfLost || "" }));
              }}
              style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box" }}
            >
              <option value="">Chọn từ danh mục thiết bị</option>
              {equipments.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name} {equipment.itemCode ? `(${equipment.itemCode})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Loại</label>
              <select value={form.itemType} onChange={(e) => setForm((f) => ({ ...f, itemType: e.target.value }))} style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none" }}>
                <option value="Asset">Asset (Tài sản)</option>
                <option value="Minibar">Minibar</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Số lượng</label>
              <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Giá đền bù (VND)</label>
            <input type="number" min="0" value={form.priceIfLost} onChange={(e) => setForm((f) => ({ ...f, priceIfLost: e.target.value }))} placeholder="5000000" style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Ghi chú</label>
            <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
          </div>
          {err && <div style={{ marginBottom: 16, borderRadius: 12, padding: "10px 14px", background: "rgba(168,56,54,.1)", border: "1px solid rgba(168,56,54,.25)", color: "#a83836", fontSize: 13 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: "none", border: "1.5px solid #e2e8e1", color: "#4b5563", cursor: "pointer" }}>
              Hủy
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Đang lưu..." : editItem ? "Cập nhật" : "Thêm vật tư"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CloneModal({ open, onClose, onSave, currentRoomId, Skel }) {
  const [rooms, setRooms] = useState([]);
  const [sourceRoomId, setSourceRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    getRooms()
      .then((res) => {
        const list = (res.data?.data || []).filter((r) => r.id !== currentRoomId);
        setRooms(list);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
    setSourceRoomId("");
    setErr("");
  }, [open, currentRoomId]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sourceRoomId) {
      setErr("Vui lòng chọn phòng nguồn.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      await cloneInventory(Number(sourceRoomId), [currentRoomId]);
      onSave();
    } catch (e) {
      setErr(e?.response?.data?.message || "Không thể clone vật tư.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,.2)" }}>
        <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0 }}>Clone vật tư từ phòng mẫu</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 28px 24px" }}>
          <div style={{ marginBottom: 8, padding: "12px 14px", background: "#fef3c7", borderRadius: 10, fontSize: 12, color: "#92400e", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>warning</span>
            Thao tác này sẽ sao chép toàn bộ vật tư từ phòng nguồn vào phòng hiện tại. Không ảnh hưởng đến phòng nguồn.
          </div>
          <div style={{ marginBottom: 20, marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Chọn phòng nguồn</label>
            {fetching ? (
              <Skel h={44} r={12} />
            ) : (
              <select value={sourceRoomId} onChange={(e) => setSourceRoomId(e.target.value)} style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none" }}>
                <option value="">-- Chọn phòng --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Phòng {r.roomNumber} {r.roomTypeName ? `(${r.roomTypeName})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          {err && <div style={{ marginBottom: 14, borderRadius: 10, padding: "10px 14px", background: "rgba(168,56,54,.1)", color: "#a83836", fontSize: 13 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: "none", border: "1.5px solid #e2e8e1", color: "#4b5563", cursor: "pointer" }}>
              Hủy
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Đang clone..." : "Clone vật tư"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SyncStockPreviewModal({ open, onClose, onConfirm, syncing, changes, fmtNumber }) {
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 980, boxShadow: "0 24px 64px rgba(0,0,0,.2)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0 }}>Đối soát vật tư của phòng với lần sync trước</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div style={{ padding: "16px 24px", maxHeight: "55vh", overflowY: "auto" }}>
          {changes.length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "#6b7280", fontSize: 14 }}>
              Không có thay đổi vật tư nào của phòng so với lần sync trước.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(249,248,243,.5)" }}>
                  {["Mã VT", "Tên vật tư", "Trước", "Sau", "Chênh lệch"].map((h, i) => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#9ca3af", textAlign: i >= 2 ? "right" : "left", borderBottom: "1px solid #f1f0ea" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {changes.map((row) => {
                  const delta = row.delta ?? 0;
                  return (
                    <tr key={row.equipmentId} style={{ borderBottom: "1px solid #fafaf8" }}>
                      <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#4f645b" }}>{row.itemCode || `VT-${String(row.equipmentId).padStart(4, "0")}`}</td>
                      <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 500, color: "#1c1917" }}>{row.equipmentName}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, color: "#6b7280" }}>{fmtNumber(row.oldRoomQuantity ?? 0)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, color: "#1c1917", fontWeight: 700 }}>{fmtNumber(row.newRoomQuantity ?? 0)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#6b7280" }}>
                        {delta > 0 ? "+" : ""}{fmtNumber(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f0ea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Preview này chỉ đối soát vật tư của riêng phòng trước khi cập nhật số đang dùng trong kho.</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: "none", border: "1.5px solid #e2e8e1", color: "#4b5563", cursor: "pointer" }}>
              Đóng
            </button>
            <button onClick={onConfirm} disabled={syncing || changes.length === 0} style={{ padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", cursor: "pointer", opacity: syncing || changes.length === 0 ? 0.6 : 1 }}>
              {syncing ? "Đang đồng bộ..." : "Đồng bộ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ??? Main Page ????????????????????????????????????????????????????????????????
export default function RoomDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const permissions = useAdminAuthStore((s) => s.permissions);

    const [activeTab, setActiveTab] = useState("basic");
    const [room, setRoom] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [loadingInv, setLoadingInv] = useState(false);
    const [savingStatus, setSavingStatus] = useState(false);
    const [businessStatus, setBusinessStatus] = useState("");
    const [cleaningStatus, setCleaningStatus] = useState("");
    const [toasts, setToasts] = useState([]);

    // Modal states
    const [invModal, setInvModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [cloneModal, setCloneModal] = useState(false);
    const [syncModal, setSyncModal] = useState(false);
    const [syncChanges, setSyncChanges] = useState([]);
    const [syncVersion, setSyncVersion] = useState(null);
    const [syncPreviewLoading, setSyncPreviewLoading] = useState(false);
    const [syncingStock, setSyncingStock] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 8;

    const showToast = useCallback((msg, type = "success") => {
        const tid = Date.now() + Math.random();
        setToasts(prev => [...prev, { id: tid, msg, type }]);
    }, []);

    const dismissToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);
    const hasPermission = useCallback(
        (code) =>
            permissions.some(
                (p) =>
                    (typeof p === "string" && p === code) ||
                    (typeof p === "object" && p.permissionCode === code),
            ),
        [permissions],
    );
    const canManageInventory = hasPermission("MANAGE_INVENTORY");

    // Load room info
    const loadRoom = useCallback(async () => {
        setLoadingRoom(true);
        try {
            const res = await getRoomById(id);
            const data = res.data;
            setRoom(data);
            setBusinessStatus(data.businessStatus || "Available");
            setCleaningStatus(data.cleaningStatus || "Clean");
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể tải thông tin phòng.", "error");
        } finally { setLoadingRoom(false); }
    }, [id]);

    // Load inventory
    const loadInventory = useCallback(async () => {
        if (!canManageInventory) return;
        setLoadingInv(true);
        try {
            const res = await getInventoryByRoom(id);
            // Flatten grouped data
            const grouped = res.data?.data || [];
            const items = grouped.flatMap(g => g.items || []);
            setInventory(items);
            setSelectedItemIds((prev) => prev.filter((x) => items.some((it) => it.id === x)));
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể tải vật tư.", "error");
        } finally { setLoadingInv(false); }
    }, [canManageInventory, id]);

    const loadEquipments = useCallback(async () => {
        if (!canManageInventory) return;
        try {
            const res = await getEquipments();
            setEquipments(res.data?.data || []);
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể tải danh mục vật tư.", "error");
        }
    }, [canManageInventory, showToast]);

    useEffect(() => { loadRoom(); }, [loadRoom]);

    useEffect(() => {
        if (activeTab === "inventory") loadInventory();
    }, [activeTab, loadInventory]);

    useEffect(() => {
        if (canManageInventory) loadEquipments();
        else if (activeTab === "inventory") setActiveTab("basic");
    }, [activeTab, canManageInventory, loadEquipments]);

    // Save status
    const handleSaveStatus = async () => {
        setSavingStatus(true);
        try {
            const tasks = [];
            if (businessStatus !== room?.businessStatus)
                tasks.push(updateBusinessStatus(id, businessStatus));
            if (cleaningStatus !== room?.cleaningStatus)
                tasks.push(updateCleaningStatus(id, cleaningStatus));
            if (tasks.length === 0) { showToast("Không có thay đổi.", "info"); setSavingStatus(false); return; }
            await Promise.all(tasks);
            showToast("Đã lưu trạng thái thành công.", "success");
            loadRoom();
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể lưu trạng thái.", "error");
        } finally { setSavingStatus(false); }
    };

    // Delete inventory item
    const handleDelete = async (itemId, equipmentName) => {
        if (!window.confirm(`Bạn có chắc muốn xóa vật tư "${equipmentName}"?`)) return;
        setDeletingId(itemId);
        try {
            await deleteInventory(itemId);
            showToast(`Đã xóa vật tư "${equipmentName}".`, "success");
            setSelectedItemIds((prev) => prev.filter((x) => x !== itemId));
            loadInventory();
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể xóa vật tư.", "error");
        } finally { setDeletingId(null); }
    };

    const toggleBulkDeleteMode = () => {
        setBulkDeleteMode((prev) => {
            const next = !prev;
            if (!next) setSelectedItemIds([]);
            return next;
        });
    };

    const handleToggleSelectItem = (itemId) => {
        setSelectedItemIds((prev) =>
            prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]
        );
    };

    const handleSelectAllOnPage = () => {
        const pageIds = paginatedInv.map((item) => item.id);
        const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedItemIds.includes(id));
        if (allSelected) {
            setSelectedItemIds((prev) => prev.filter((id) => !pageIds.includes(id)));
            return;
        }
        setSelectedItemIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    };

    const handleClearSelections = () => {
        setSelectedItemIds([]);
    };

    const handleDeleteSelected = async () => {
        if (selectedItemIds.length === 0) {
            showToast("Vui lòng chọn ít nhất 1 vật tư để xóa.", "warning");
            return;
        }
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedItemIds.length} vật tư đã chọn?`)) return;

        setBulkDeleting(true);
        try {
            await Promise.all(selectedItemIds.map((itemId) => deleteInventory(itemId)));
            showToast(`Đã xóa ${selectedItemIds.length} vật tư thành công.`, "success");
            setSelectedItemIds([]);
            setBulkDeleteMode(false);
            loadInventory();
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể xóa hàng loạt vật tư.", "error");
        } finally {
            setBulkDeleting(false);
        }
    };

    const openSyncPreview = async () => {
        setSyncPreviewLoading(true);
        try {
            const res = await previewSyncInventoryStock(Number(id));
            setSyncChanges(res?.data?.data || []);
            setSyncVersion(res?.data?.inventoryVersion ?? null);
            setSyncModal(true);
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể tải preview đồng bộ kho.", "error");
        } finally {
            setSyncPreviewLoading(false);
        }
    };

    const handleSyncStock = async () => {
        setSyncingStock(true);
        try {
            const res = await syncInventoryStock(Number(id), syncVersion ?? 0);
            const changed = res?.data?.updatedEquipments ?? 0;
            showToast(`Đồng bộ kho thành công. Đã cập nhật ${changed} vật tư liên quan của phòng.`, "success");
            setSyncModal(false);
            setSyncVersion(null);
            await Promise.all([loadInventory(), loadEquipments()]);
        } catch (e) {
            showToast(e?.response?.status === 409
                ? (e?.response?.data?.message || "Dữ liệu phòng đã thay đổi, vui lòng xem lại preview.")
                : (e?.response?.data?.message || "Không thể đồng bộ kho vật tư."), "error");
        } finally {
            setSyncingStock(false);
        }
    };

    const fmtCurrency = (n) => n == null ? "—" : new Intl.NumberFormat("vi-VN").format(n);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(inventory.length / PAGE_SIZE));
    const paginatedInv = inventory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const STATUS_BS = {
        Available: { label: "Sẵn sàng đón khách", dot: "#10b981", badge: "#d1fae5", badgeText: "#065f46" },
        Occupied: { label: "Đang có khách", dot: "#3b82f6", badge: "#dbeafe", badgeText: "#1d4ed8" },
        Disabled: { label: "Ngưng kinh doanh", dot: "#94a3b8", badge: "#f1f5f9", badgeText: "#475569" },
    };

    const STATUS_CS = {
        Clean: { label: "Đã dọn dẹp", dot: "#10b981", badge: "#d1fae5", badgeText: "#065f46" },
        Dirty: { label: "Phòng bẩn (Dirty)", dot: "#f59e0b", badge: "#fef3c7", badgeText: "#92400e" },
        PendingLoss: { label: "Chờ xử lý thất thoát", dot: "#e11d48", badge: "#fce7f3", badgeText: "#9d174d" },
    };

    const statusKey = room?.status || room?.businessStatus;
    const bsCfg =
        (statusKey === "Cleaning"
            ? { label: "Đang dọn phòng", dot: "#2563eb", badge: "#dbeafe", badgeText: "#1d4ed8" }
            : statusKey === "Maintenance"
                ? { label: "Đang bảo trì", dot: "#8b5cf6", badge: "#ede9fe", badgeText: "#6d28d9" }
                : STATUS_BS[statusKey]) || STATUS_BS.Available;
    const csCfg = STATUS_CS[room?.cleaningStatus] || STATUS_CS.Clean;

    return (
        <>
            <style>{`
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes modalIn { from{transform:scale(.95);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes fadeRow { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .fade-row { animation: fadeRow .2s ease forwards; }
        .pg-btn { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#6b7280; background:transparent; border:none; cursor:pointer; transition:background .15s; }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
        .action-btn { padding:7px 8px; border:none; background:none; cursor:pointer; border-radius:8px; transition:all .15s; display:flex; align-items:center; }
        .action-btn:hover { background:#f3f4f6; }
        .tab-btn { padding:0 4px 16px; font-size:14px; font-weight:600; background:none; border:none; cursor:pointer; transition:all .15s; position:relative; }
        tr.inv-row:hover td { background:rgba(249,248,243,.6); }
      `}</style>

            {/* Toast Container */}
            <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none" }}>
                {toasts.map(t => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
            </div>

            {/* Modals */}
            <InventoryModal
                open={invModal}
                onClose={() => { setInvModal(false); setEditItem(null); }}
                onSave={() => { setInvModal(false); setEditItem(null); showToast(editItem ? "Cập nhật vật tư thành công." : "Thêm vật tư thành công."); loadInventory(); }}
                editItem={editItem}
                roomId={Number(id)}
                equipments={equipments}
            />
            <CloneModal
                open={cloneModal}
                onClose={() => setCloneModal(false)}
                onSave={() => { setCloneModal(false); showToast("Clone vật tư thành công."); loadInventory(); }}
                currentRoomId={Number(id)}
                Skel={Skel}
            />
            <SyncStockPreviewModal
                open={syncModal}
                onClose={() => { setSyncModal(false); setSyncVersion(null); }}
                onConfirm={handleSyncStock}
                syncing={syncingStock}
                changes={syncChanges}
                fmtNumber={(n) => new Intl.NumberFormat("vi-VN").format(n ?? 0)}
            />

            {/* Page Content */}
            <div style={{ maxWidth: 1300, margin: "0 auto" }}>

                <RoomDetailHeader
                    loadingRoom={loadingRoom}
                    room={room}
                    activeTab={activeTab}
                    loadingInv={loadingInv}
                    savingStatus={savingStatus}
                    onBack={() => navigate(-1)}
                    onPrint={() => window.print()}
                    onRefreshInventory={loadInventory}
                    onSaveStatus={handleSaveStatus}
                    Skel={Skel}
                />

                <RoomDetailTabs
                    activeTab={activeTab}
                    canManageInventory={canManageInventory}
                    inventoryCount={inventory.length}
                    onChangeTab={setActiveTab}
                />

                {activeTab === "basic" && (
                    <RoomBasicTab
                        loadingRoom={loadingRoom}
                        room={room}
                        businessStatus={businessStatus}
                        cleaningStatus={cleaningStatus}
                        bsCfg={bsCfg}
                        csCfg={csCfg}
                        onBusinessStatusChange={setBusinessStatus}
                        onCleaningStatusChange={setCleaningStatus}
                        Skel={Skel}
                    />
                )}

                {activeTab === "inventory" && (
                    <RoomInventoryTab
                        inventory={inventory}
                        paginatedInv={paginatedInv}
                        loadingInv={loadingInv}
                        deletingId={deletingId}
                        bulkDeleteMode={bulkDeleteMode}
                        selectedItemIds={selectedItemIds}
                        bulkDeleting={bulkDeleting}
                        page={page}
                        totalPages={totalPages}
                        pageSize={PAGE_SIZE}
                        fmtCurrency={fmtCurrency}
                        syncingStock={syncingStock}
                        syncPreviewLoading={syncPreviewLoading}
                        onAdd={() => { setEditItem(null); setInvModal(true); }}
                        onOpenSyncPreview={openSyncPreview}
                        onClone={() => setCloneModal(true)}
                        onEdit={(item) => { setEditItem(item); setInvModal(true); }}
                        onDelete={handleDelete}
                        onToggleBulkDeleteMode={toggleBulkDeleteMode}
                        onToggleSelectItem={handleToggleSelectItem}
                        onSelectAllOnPage={handleSelectAllOnPage}
                        onClearSelections={handleClearSelections}
                        onDeleteSelected={handleDeleteSelected}
                        onPageChange={setPage}
                        Skel={Skel}
                    />
                )}
            </div>
        </>
    );
}



