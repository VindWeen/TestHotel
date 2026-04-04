import { useState, useEffect, useCallback, useMemo } from "react";
import axiosClient from "../../api/axios";
import { getRooms, updateCleaningStatus, updateBusinessStatus } from "../../api/roomsApi";
import { getInventoryByRoom } from "../../api/roomInventoriesApi";

function Toast({ id, msg, type = "success", dur = 4000, onDismiss }) {
  const styles = {
    success: { bg: "#1e3a2f", border: "#2d5a45", text: "#a7f3d0", prog: "#34d399", icon: "check_circle" },
    error: { bg: "#3a1e1e", border: "#5a2d2d", text: "#fca5a5", prog: "#f87171", icon: "error" },
    warning: { bg: "#3a2e1a", border: "#5a4820", text: "#fcd34d", prog: "#fbbf24", icon: "warning" },
    info: { bg: "#1e2f3a", border: "#2d4a5a", text: "#93c5fd", prog: "#60a5fa", icon: "info" },
  };
  const s = styles[type] || styles.success;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), dur);
    return () => clearTimeout(t);
  }, [id, dur, onDismiss]);

  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.35)", pointerEvents: "auto", marginBottom: 10, minWidth: 280 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 13px 9px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 19, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
        <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: 0, flex: 1 }}>{msg}</p>
        <button onClick={() => onDismiss(id)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, color: "inherit", padding: 2 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
      <div style={{ margin: "0 12px 9px", height: 3, borderRadius: 9999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", background: s.prog, animation: `toastProgress ${dur}ms linear forwards` }} />
      </div>
    </div>
  );
}

function ModalShell({ children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      {children}
    </div>
  );
}

export default function HousekeepingPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [floorFilter, setFloorFilter] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [inventoryRoom, setInventoryRoom] = useState(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [inventories, setInventories] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [missingItems, setMissingItems] = useState({});

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
  }, []);

  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const loadDirtyRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = { cleaningStatus: "Dirty" };
      if (floorFilter) params.floor = Number(floorFilter);
      const res = await getRooms(params);
      let data = res.data?.data || [];
      data = data.filter((r) => r.cleaningStatus === "Dirty" || r.businessStatus === "Disabled");
      setRooms(data);
    } catch {
      showToast("Khong the tai danh sach phong can don.", "error");
    } finally {
      setLoading(false);
    }
  }, [floorFilter, showToast]);

  useEffect(() => {
    loadDirtyRooms();
  }, [loadDirtyRooms]);

  const floors = useMemo(
    () => [...new Set(rooms.map((room) => room.floor).filter((floor) => floor != null))].sort((a, b) => a - b),
    [rooms]
  );

  const loadInventoriesForRoom = async (roomId) => {
    setLoadingInv(true);
    try {
      const res = await getInventoryByRoom(roomId);
      const grouped = res.data?.data || [];
      const items = grouped.flatMap((g) => g.items || []);
      setInventories(items);

      const initialMissing = {};
      items.forEach((inv) => {
        initialMissing[inv.id] = { isMissing: false, quantity: 1, note: "", files: [] };
      });
      setMissingItems(initialMissing);
    } catch {
      showToast("Loi khi tai du lieu vat tu phong.", "error");
    } finally {
      setLoadingInv(false);
    }
  };

  const handleOpenRoom = (room) => {
    setSelectedRoom(room);
  };

  const handleProceedToInventory = async () => {
    if (!selectedRoom) return;
    await loadInventoriesForRoom(selectedRoom.id);
    setInventoryRoom(selectedRoom);
    setSelectedRoom(null);
  };

  const toggleMissingItem = (invId) => {
    setMissingItems((prev) => ({
      ...prev,
      [invId]: { ...prev[invId], isMissing: !prev[invId].isMissing },
    }));
  };

  const updateMissingQuantity = (invId, qty) => {
    setMissingItems((prev) => ({
      ...prev,
      [invId]: { ...prev[invId], quantity: qty },
    }));
  };

  const updateMissingNote = (invId, note) => {
    setMissingItems((prev) => ({
      ...prev,
      [invId]: { ...prev[invId], note },
    }));
  };

  const updateMissingFiles = (invId, fileList) => {
    setMissingItems((prev) => ({
      ...prev,
      [invId]: { ...prev[invId], files: Array.from(fileList || []) },
    }));
  };

  const handleFinishCleaning = async () => {
    if (!inventoryRoom) return;

    setIsFinishing(true);
    try {
      const { id: roomId, roomNumber } = inventoryRoom;
      const usedOrLost = inventories.filter((inv) => missingItems[inv.id]?.isMissing);

      for (const inv of usedOrLost) {
        const qtyMissing = parseInt(missingItems[inv.id].quantity, 10) || 1;
        const note = missingItems[inv.id].note || "Vat tu khach su dung / hao hut luc don phong";
        const formData = new FormData();
        formData.append("RoomInventoryId", inv.id);
        formData.append("Quantity", qtyMissing);
        formData.append("PenaltyAmount", 0);
        formData.append("Description", note);
        formData.append("Status", "Pending");

        if (missingItems[inv.id].files?.length > 0) {
          missingItems[inv.id].files.forEach((f) => formData.append("Images", f));
        }

        try {
          await axiosClient.post("/LossAndDamages", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (err) {
          console.error("LossAndDamages create failed", err);
        }
      }

      await updateCleaningStatus(roomId, "Clean");
      await updateBusinessStatus(roomId, "Available");

      await axiosClient.post("/ActivityLogs/custom-notify", {
        actionCode: "HOUSEKEEPING_DONE",
        message: `Nhan vien Buong phong da don xong phong ${roomNumber}. Da ghi nhan ${usedOrLost.length} muc hao hut cho buoc xac nhan tiep theo.`,
        targetRoleIds: [1, 2, 3],
        entityType: "Room",
        entityId: roomId,
      }).catch(() => null);

      showToast(`Da hoan tat don phong ${roomNumber}. Cac muc hao hut dang cho xac nhan de dong bo kho.`, "success");
      setInventoryRoom(null);
      setInventories([]);
      setMissingItems({});
      loadDirtyRooms();
    } catch {
      showToast("Loi khi ket thuc don phong.", "error");
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeRow { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes modalScaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        .hk-card:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,.08) !important; z-index: 10; }
        .check-container { display:flex; align-items:center; position:relative; padding-left:28px; cursor:pointer; font-size:14px; user-select:none; margin:0; }
        .check-container input { position:absolute; opacity:0; cursor:pointer; height:0; width:0; }
        .checkmark { position:absolute; top:2px; left:0; height:20px; width:20px; background-color:#f1f0ea; border:1px solid #d1d5db; border-radius:4px; transition:all .2s; }
        .check-container:hover input ~ .checkmark { background-color:#e5e7eb; }
        .check-container input:checked ~ .checkmark { background-color:#e11d48; border-color:#e11d48; }
        .checkmark:after { content:""; position:absolute; display:none; }
        .check-container input:checked ~ .checkmark:after { display:block; }
        .check-container .checkmark:after { left:6px; top:2px; width:5px; height:10px; border:solid white; border-width:0 2px 2px 0; transform:rotate(45deg); }
      `}</style>

      <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, pointerEvents: "none", minWidth: 280 }}>
        {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", animation: "fadeRow .3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.025em", margin: "0 0 4px", fontFamily: "Manrope, sans-serif" }}>
              Nghiep vu Don Phong
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              Housekeeping xu ly rieng 2 buoc: xac nhan don phong va kiem ke vat tu truoc khi kho duoc dong bo.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d6d3d1", fontSize: 13, minWidth: 150, background: "white" }}
            >
              <option value="">Tat ca tang</option>
              {floors.map((floor) => (
                <option key={floor} value={floor}>Tang {floor}</option>
              ))}
            </select>
            <button
              onClick={loadDirtyRooms}
              style={{ padding: "9px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "white", color: "#4f645b", border: "1.5px solid #4f645b", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "Manrope, sans-serif" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
              Lam moi
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Dang tai du lieu phong...</div>
        ) : rooms.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center", background: "white", borderRadius: 18, border: "1px dashed #cbd5e1" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: "#9ca3af", marginBottom: 16 }}>celebration</span>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#4b5563", margin: "0 0 4px" }}>Khong con phong nao can don</p>
            <p style={{ fontSize: 13, color: "#6b7280" }}>Housekeeping dang o trang thai on.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {rooms.map((room) => (
              <div
                key={room.id}
                className="hk-card"
                onClick={() => handleOpenRoom(room)}
                style={{ background: "white", border: "1px solid #f1f0ea", borderRadius: 16, padding: "20px 24px", cursor: "pointer", transition: "all .2s ease", boxShadow: "0 4px 12px rgba(0,0,0,.03)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#b91c1c", fontFamily: "Manrope, sans-serif" }}>{room.roomNumber}</span>
                  <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: ".05em", display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cleaning_services</span>
                    CAN DON
                  </span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tang {room.floor} • {room.roomTypeName || "Hang phong chung"}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  Click de mo popup don phong. Popup kiem ke vat tu se mo rieng o buoc sau.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRoom && (
        <ModalShell>
          <div style={{ background: "white", borderRadius: 24, width: "100%", maxWidth: 560, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", animation: "modalScaleIn .2s ease-out", overflow: "hidden" }}>
            <div style={{ padding: "20px 32px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafaf9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#4f645b", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>cleaning_services</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, fontFamily: "Manrope, sans-serif" }}>Popup don phong</h3>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0", fontWeight: 600 }}>
                    Phong {selectedRoom.roomNumber} - Tang {selectedRoom.floor}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedRoom(null)} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.04)", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div style={{ padding: 32, textAlign: "center" }}>
              <div style={{ background: "#f9f8f3", width: 100, height: 100, borderRadius: "50%", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#4f645b" }}>door_open</span>
              </div>
              <h4 style={{ fontSize: 20, color: "#1c1917", margin: "0 0 12px", fontWeight: 800 }}>Ban da don xong phong nay?</h4>
              <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 32, padding: "0 20px" }}>
                Xac nhan buoc nay khi phong da duoc don sach. Sau do he thong mo popup kiem ke vat tu/minibar rieng de housekeeping ghi nhan hao hut va cho le tan xac nhan tiep.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                <button onClick={() => setSelectedRoom(null)} style={{ padding: "12px 24px", borderRadius: 12, background: "white", border: "1.5px solid #cbd5e1", color: "#475569", fontWeight: 700, cursor: "pointer" }}>
                  Dong
                </button>
                <button onClick={handleProceedToInventory} style={{ background: "linear-gradient(135deg, #4f645b 0%, #3a4943 100%)", color: "white", padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(79,100,91,.25)", fontFamily: "Manrope, sans-serif" }}>
                  Chuyen sang popup vat tu
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {inventoryRoom && (
        <ModalShell>
          <div style={{ background: "white", borderRadius: 24, width: "100%", maxWidth: 980, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", animation: "modalScaleIn .2s ease-out", overflow: "hidden" }}>
            <div style={{ padding: "20px 32px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff1f2" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#e11d48", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>inventory</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, fontFamily: "Manrope, sans-serif" }}>Popup quan ly vat tu</h3>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0", fontWeight: 600 }}>
                    Phong {inventoryRoom.roomNumber} - Tang {inventoryRoom.floor}
                  </p>
                </div>
              </div>
              <button onClick={() => setInventoryRoom(null)} disabled={isFinishing} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.04)", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            <div style={{ padding: 32, maxHeight: "75vh", overflowY: "auto" }}>
              <div style={{ background: "#eff6ff", padding: "16px 20px", borderRadius: 12, marginBottom: 24, borderLeft: "4px solid #2563eb" }}>
                <p style={{ margin: 0, fontSize: 14, color: "#1d4ed8", fontWeight: 600, lineHeight: 1.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 8, verticalAlign: "bottom" }}>info</span>
                  Cac muc duoc tick se tao bien ban o trang thai <strong>Pending</strong>. Kho chua bi tru ngay; chi sau khi xac nhan that thoat o buoc tiep theo moi dong bo sang Equipment.
                </p>
              </div>

              {loadingInv ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Dang lay danh muc vat tu trong phong...</div>
              ) : inventories.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#cbd5e1", marginBottom: 12 }}>inbox</span>
                  <p style={{ color: "#64748b", margin: 0, fontSize: 15, fontWeight: 600 }}>Phong nay chua co danh muc vat tu/minibar.</p>
                </div>
              ) : (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#f8fafc" }}>
                      <tr>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748b", width: 60 }}>STT</th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748b" }}>Ten vat tu phong</th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748b", width: 100 }}>Loai</th>
                        <th style={{ padding: "14px 20px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#64748b", width: 320 }}>Ghi nhan hao hut / su dung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventories.map((inv, idx) => {
                        const isMissing = missingItems[inv.id]?.isMissing;
                        return (
                          <tr key={inv.id} style={{ borderTop: "1px solid #e2e8f0", background: isMissing ? "#fff1f2" : "white", transition: "background .2s" }}>
                            <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 800, color: "#94a3b8" }}>{idx + 1}</td>
                            <td style={{ padding: "16px 20px", fontSize: 15, fontWeight: 700, color: isMissing ? "#b91c1c" : "#1e293b", fontFamily: "Manrope, sans-serif" }}>{inv.equipmentName}</td>
                            <td style={{ padding: "16px 20px", fontSize: 14, color: "#64748b" }}>
                              <span style={{ padding: "4px 8px", borderRadius: 6, background: inv.itemType === "Minibar" ? "#e0f2fe" : "#f1f5f9", color: inv.itemType === "Minibar" ? "#0284c7" : "#475569", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                                {inv.itemType || "Asset"}
                              </span>
                            </td>
                            <td style={{ padding: "16px 20px", verticalAlign: "top" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <label className="check-container">
                                  Tick chon (Bao hao hut)
                                  <input type="checkbox" checked={isMissing} onChange={() => toggleMissingItem(inv.id)} />
                                  <span className="checkmark" style={{ top: -2 }}></span>
                                </label>

                                {isMissing && (
                                  <div style={{ display: "flex", gap: 8, animation: "modalScaleIn .2s ease", position: "relative" }}>
                                    <div style={{ position: "absolute", width: 2, height: 36, background: "#fca5a5", left: -14, top: 2, borderRadius: 2 }} />
                                    <input
                                      type="number"
                                      min="1"
                                      max={inv.quantity || 99}
                                      value={missingItems[inv.id]?.quantity || 1}
                                      onChange={(e) => updateMissingQuantity(inv.id, e.target.value)}
                                      style={{ width: 65, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #fca5a5", outline: "none", fontSize: 13, background: "white", fontWeight: 700, color: "#1c1917" }}
                                    />
                                    <input
                                      type="text"
                                      value={missingItems[inv.id]?.note || ""}
                                      onChange={(e) => updateMissingNote(inv.id, e.target.value)}
                                      placeholder="Nhap ghi chu chi tiet..."
                                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #fca5a5", outline: "none", fontSize: 13, background: "white" }}
                                    />
                                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "#fef2f2", border: "1.5px solid #fca5a5", color: "#ef4444", cursor: "pointer", position: "relative", flexShrink: 0 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>photo_camera</span>
                                      <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={(e) => updateMissingFiles(inv.id, e.target.files)} />
                                      {missingItems[inv.id]?.files?.length > 0 && (
                                        <span style={{ position: "absolute", top: -6, right: -6, background: "#e11d48", color: "white", fontSize: 10, fontWeight: 800, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                          {missingItems[inv.id].files.length}
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, gap: 12 }}>
                <button onClick={() => { setSelectedRoom(inventoryRoom); setInventoryRoom(null); }} style={{ padding: "12px 24px", borderRadius: 12, background: "white", border: "1.5px solid #cbd5e1", color: "#475569", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "Manrope, sans-serif" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                  Quay lai popup don phong
                </button>
                <button
                  onClick={handleFinishCleaning}
                  disabled={isFinishing}
                  style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "white", padding: "14px 28px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 8px 20px rgba(5,150,105,.3)", opacity: isFinishing ? 0.7 : 1, fontFamily: "Manrope, sans-serif" }}
                >
                  {isFinishing ? "Dang luu bien ban dang cho xac nhan..." : "Luu & hoan tat don phong"}
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
