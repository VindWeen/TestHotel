// src/pages/admin/staff/UserListPage.jsx
import { useState } from "react";

const DEMO_USERS = [
  {
    id: 1,
    fullName: "Hùng Lê Mạnh",
    email: "hunglm@vaa.edu.vn",
    phone: "0123672890",
    roleName: "Manager",
    status: true,
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBuammojAR49_9oLkY4_JZbHbvyAqZ-PXHuft5YjMhyn_dL-LPnZC3-DJQZIp5L6EGNK8M7ZkHMqbhyGa9DkN-M-A_KhC9PZKvy39gRiQzjatRJmESBUptPvOqVZ_fk1dze5JkaFNpbwxIaHUPsw8JeFb2CHIRUxuuxXvreQ6G4q-6YP4WNoVf_8U4rH4Z0b64Oqr3tN74gS-VmhhbmpBrZKs5jSBAhTxB3oVn_JTxosyV-nqTYeYNqtuwvipl7B_9eaAXWRnjTYBI",
  },
  {
    id: 2,
    fullName: "Nguyễn Văn A",
    email: "nguyenvana@gmail.com",
    phone: "0900000000",
    roleName: "Receptionist",
    status: true,
    avatarUrl: "",
  },
  {
    id: 3,
    fullName: "Hoàng Kế Toán",
    email: "accountant@hotel.com",
    phone: "0900000005",
    roleName: "Accountant",
    status: false,
    avatarUrl: "",
  },
];

const ROLE_BADGE = {
  'Admin': 'bg-purple-50 text-purple-600',
  'Manager': 'bg-emerald-50 text-emerald-600',
  'Receptionist': 'bg-blue-50 text-blue-600',
  'Accountant': 'bg-stone-100 text-stone-600',
  'Housekeeping': 'bg-yellow-50 text-yellow-700',
  'Security': 'bg-orange-50 text-orange-600',
  'Chef': 'bg-red-50 text-red-600',
  'Waiter': 'bg-pink-50 text-pink-600',
  'IT Support': 'bg-cyan-50 text-cyan-600',
  'Guest': 'bg-gray-100 text-gray-500',
};

export default function UserListPage() {
  const [users, setUsers] = useState(DEMO_USERS);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const handleToggleStatus = (id) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: !u.status } : u))
    );
  };

  const openDetail = (u) => {
    setSelectedUser(u);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="bg-surface text-on-surface antialiased font-body min-h-screen">
      <style>{`
        /* Toggle switch */
        .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
        .toggle-switch input { opacity:0; width:0; height:0; }
        .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#cbd5e1; transition:.4s; border-radius:24px; }
        .slider:before { position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px; background-color:white; transition:.4s; border-radius:50%; }
        input:checked + .slider { background-color:#4f645b; }
        input:checked + .slider:before { transform:translateX(20px); }
        input:disabled + .slider { opacity:0.5; cursor:not-allowed; }

        /* Spinner */
        @keyframes spin { to{transform:rotate(360deg)} }
        .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.35); border-top-color:white; border-radius:50%; animation:spin .65s linear infinite; vertical-align:middle; margin-right:6px; }
        .spinner-dark { border-color:rgba(79,100,91,.2); border-top-color:#4f645b; }

        /* Fade rows */
        @keyframes fadeRow { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .fade-row { animation:fadeRow .22s ease forwards; }

        /* Modal backdrop */
        .modal-backdrop { backdrop-filter:blur(4px); }

        /* Pagination buttons */
        .pg-btn {
          width:2rem; height:2rem; border-radius:.5rem;
          display:flex; align-items:center; justify-content:center;
          font-size:.875rem; font-weight:500;
          color:#6b7280; background:transparent; border:none; cursor:pointer;
          transition:background .15s, color .15s;
        }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; font-weight:700; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
        .pg-btn.icon { color:#9ca3af; }
      `}</style>
      
      {/* ═════════ MODALS ═════════ */}
      {/* Add User Modal */}
      <div className={`fixed inset-0 bg-black/50 ${isAddUserModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50 modal-backdrop`}>
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Thêm người dùng mới</h3>
            <button onClick={() => setIsAddUserModalOpen(false)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <form noValidate onSubmit={(e) => e.preventDefault()}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Họ và tên *</label>
              <input type="text" placeholder="Nguyễn Văn A" className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input type="email" placeholder="email@hotel.com" className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">SĐT</label>
              <input type="tel" placeholder="09xxxxxxxx" className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Mật khẩu *</label>
              <input type="password" placeholder="Tối thiểu 6 ký tự" className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Vai trò</label>
              <select className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none bg-white">
                <option value="">-- Chọn vai trò --</option>
                <option value="1">Admin</option>
                <option value="2">Manager</option>
                <option value="3">Receptionist</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Giới tính</label>
              <select className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none bg-white">
                <option value="">-- Chọn --</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="px-5 py-2 border rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors">Hủy</button>
              <button type="submit" className="px-5 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-all flex items-center">Thêm</button>
            </div>
          </form>
        </div>
      </div>

      {/* Detail Modal */}
      <div className={`fixed inset-0 bg-black/50 ${isDetailModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50 modal-backdrop`}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" style={{maxHeight:'90vh', display:'flex', flexDirection:'column'}}>
          <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-stone-100 flex-shrink-0">
            <h3 className="text-xl font-bold">Chi tiết người dùng</h3>
            <button onClick={() => setIsDetailModalOpen(false)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="px-8 py-5 overflow-y-auto flex-1">
            {selectedUser && (
              <>
                <div className="flex items-center gap-4 mb-5 pb-4 border-b border-stone-100">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                      {selectedUser.fullName[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-bold">{selectedUser.fullName}</p>
                    <p className="text-sm text-stone-500">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedUser.status ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-500'}`}>
                        {selectedUser.status ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${ROLE_BADGE[selectedUser.roleName] || 'bg-stone-100 text-stone-500'}`}>
                        {selectedUser.roleName}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ['Vai trò', selectedUser.roleName],
                    ['Điện thoại', selectedUser.phone],
                    ['Đăng nhập lần cuối', '—'],
                    ['Ngày tạo', '—'],
                  ].map(([k, v], i) => (
                    <div key={i} className="bg-stone-50 rounded-xl p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">{k}</p>
                      <p className="text-sm font-semibold text-stone-700 truncate">{v}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═════════ LAYOUT ═════════ */}
      {/* SideNavBar */}
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-stone-100 bg-white flex flex-col py-8 px-4 z-40">
        <div className="mb-10 px-4">
          <h1 className="text-xl font-bold tracking-widest text-emerald-900 uppercase">The Ethereal</h1>
          <p className="text-[10px] tracking-[0.2em] text-stone-500 uppercase mt-1">Hotel ERP</p>
        </div>
        <nav className="flex-1 space-y-1">
          <a className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50" href="#">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-sm font-medium">Dashboard</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50" href="#">
            <span className="material-symbols-outlined">meeting_room</span>
            <span className="text-sm font-medium">Quản lý Phòng</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50" href="#">
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="text-sm font-medium">Vật tư & Minibar</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50" href="#">
            <span className="material-symbols-outlined">confirmation_number</span>
            <span className="text-sm font-medium">Booking & Voucher</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-emerald-900 bg-emerald-50/50 font-bold" href="#">
            <span className="material-symbols-outlined" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>group</span>
            <span className="text-sm font-medium">Danh sách Nhân sự</span>
          </a>
        </nav>
        <div className="mt-auto px-4 space-y-2">
          {/* Current user */}
          <div className="px-2 py-2 rounded-xl bg-stone-50 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">A</div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-800 truncate">Admin</p>
              <p className="text-[10px] text-stone-500 truncate">System Admin</p>
            </div>
          </div>
          <button onClick={() => setIsAddUserModalOpen(true)} className="w-full py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            Thêm người dùng
          </button>
          <button className="w-full py-2.5 border border-stone-200 text-stone-500 rounded-xl font-medium text-sm hover:bg-stone-50 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">logout</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* TopNavBar */}
      <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 z-30 bg-white/80 backdrop-blur-md border-b border-stone-100 flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">search</span>
            <input className="w-full bg-stone-100 border-none rounded-full py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-primary/40 outline-none" placeholder="Tìm kiếm tài nguyên..." type="text" />
          </div>
          <nav className="flex gap-6">
            <a className="text-stone-500 font-medium text-sm hover:text-emerald-700 transition-all" href="#">Hotels</a>
            <a className="text-emerald-800 border-b-2 border-emerald-800 pb-1 font-semibold text-sm" href="#">Analytics</a>
            <a className="text-stone-500 font-medium text-sm hover:text-emerald-700 transition-all" href="#">Reports</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
          <div className="h-8 w-px bg-stone-200 mx-2"></div>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="text-right">
              <p className="text-xs font-bold text-on-surface">Alex Rivera</p>
              <p className="text-[10px] text-stone-500">General Manager</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">A</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ml-64 pt-24 p-8 min-h-screen bg-[#f8f9fa]">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">Quản lý Nhân sự & Người dùng</h2>
              <p className="text-sm text-stone-500 mt-1">
                Tổng: <span className="font-semibold text-on-surface">{users.length}</span> người dùng
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2 rounded-xl text-sm font-medium bg-white text-on-surface border border-stone-200 hover:bg-stone-50 transition-colors flex items-center gap-2 shadow-sm">
                <span className="material-symbols-outlined text-sm">file_download</span>
                Xuất báo cáo
              </button>
              <button 
                onClick={() => setIsAddUserModalOpen(true)}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-primary text-on-primary hover:opacity-90 transition-all flex items-center gap-2 shadow-md">
                <span className="material-symbols-outlined text-sm">person_add</span>
                Thêm người dùng
              </button>
            </div>
          </div>

          {/* Filters Section */}
          <section className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-stone-100 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-[11px] font-semibold text-stone-500 mb-2">Họ tên, Email, SĐT</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-lg">search</span>
                <input className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/40 focus:bg-white outline-none" placeholder="Gõ từ khóa..." type="text" />
              </div>
            </div>
            <div className="w-56">
              <label className="block text-[11px] font-semibold text-stone-500 mb-2">Lọc theo Vai trò</label>
              <select className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary/40 outline-none">
                <option value="">Chọn vai trò</option>
                <option>Admin</option>
                <option>Manager</option>
                <option>Receptionist</option>
              </select>
            </div>
            <div className="w-56">
              <label className="block text-[11px] font-semibold text-stone-500 mb-2">Lọc theo Trạng thái</label>
              <select className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary/40 outline-none">
                <option value="">Chọn trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="locked">Đã khóa</option>
              </select>
            </div>
            <button className="bg-stone-100 text-stone-600 p-2.5 rounded-xl border border-stone-200 hover:bg-stone-200 transition-colors" title="Xóa bộ lọc">
              <span className="material-symbols-outlined">tune</span>
            </button>
          </section>

          {/* Data Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-100">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-stone-500">Họ và tên</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-stone-500">Email</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-stone-500">Số điện thoại</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-stone-500">Vai trò</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-stone-500">Trạng thái</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-stone-500 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {users.map((u, i) => {
                    const roleClass = ROLE_BADGE[u.roleName] || 'bg-stone-100 text-stone-500';
                    return (
                      <tr key={u.id} className="hover:bg-stone-50/50 transition-colors fade-row" style={{animationDelay: `${Math.min(i * 25, 200)}ms`}}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                {u.fullName ? u.fullName[0].toUpperCase() : '?'}
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-stone-800 text-sm">{u.fullName}</span>
                              <p className="text-xs text-stone-400">#{u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-stone-600">{u.email}</td>
                        <td className="px-6 py-4 text-sm text-stone-600">{u.phone}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 ${roleClass} text-[10px] font-bold rounded-full uppercase`}>{u.roleName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${u.status ? 'text-emerald-600' : 'text-stone-400'}`}>
                              {u.status ? 'Hoạt động' : 'Đã khóa'}
                            </span>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={u.status} onChange={() => handleToggleStatus(u.id)} />
                              <span className="slider"></span>
                            </label>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openDetail(u)} className="p-2 text-stone-400 hover:text-primary transition-colors hover:bg-stone-100 rounded-lg" title="Xem chi tiết">
                              <span className="material-symbols-outlined text-xl">visibility</span>
                            </button>
                            <button className="p-2 text-stone-400 hover:text-primary transition-colors hover:bg-stone-100 rounded-lg" title="Chỉnh sửa">
                              <span className="material-symbols-outlined text-xl">edit_square</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-500">Hiển thị</span>
                <select className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-primary/40 outline-none">
                  <option value="10">10/trang</option>
                  <option value="20">20/trang</option>
                </select>
                <span className="text-xs text-stone-400">1–3 / {users.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <button className="pg-btn icon" disabled><span className="material-symbols-outlined" style={{fontSize:'18px'}}>chevron_left</span></button>
                <button className="pg-btn active">1</button>
                <button className="pg-btn icon" disabled><span className="material-symbols-outlined" style={{fontSize:'18px'}}>chevron_right</span></button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
