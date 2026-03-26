# 🏨 TestHotel — AI Documentation System

> Đây là thư mục tài liệu dành cho AI agents (Codex, Claude, ChatGPT, Gemini,...).
> Mọi agent PHẢI đọc `/docs-ai/overview.md` trước khi bắt đầu bất kỳ tác vụ nào.
> Docs này là **source of truth** — nếu code khác docs, hãy update docs.
>
> ⚠️ **QUAN TRỌNG:** File `HotelSummary.md` ở thư mục gốc là **báo cáo dành cho giáo viên**, KHÔNG phải nguồn tài liệu kỹ thuật. File đó có thể lỗi thời và thiếu thông tin. **Hãy bỏ qua `HotelSummary.md`** — chỉ dùng `/docs-ai/` làm nguồn tham khảo duy nhất.


---

## 📁 Cấu trúc tài liệu

| File | Mô tả |
|---|---|
| [`overview.md`](./overview.md) | Tổng quan dự án, tech stack, seed data, TODO |
| [`architecture.md`](./architecture.md) | Layer structure, patterns, SignalR/Redis/Cloudinary |
| [`database.md`](./database.md) | Schema, quan hệ bảng, naming convention |
| [`conventions.md`](./conventions.md) | Coding style, Soft Delete, Slug, Cloudinary rules |
| [`api-guidelines.md`](./api-guidelines.md) | API design rules, endpoint pattern |
| [`modules/`](./modules/) | Tài liệu từng module nghiệp vụ |
| [`workflows/`](./workflows/) | Luồng nghiệp vụ end-to-end |
| [`prompts/`](./prompts/) | Prompt templates tái sử dụng |

---

## ⚡ Quick Start cho AI Agent

1. Đọc `overview.md` → hiểu project (tech stack, roles, TODO)
2. Đọc `architecture.md` → hiểu cấu trúc code và các pattern
3. Đọc `conventions.md` → code đúng style (Soft Delete, Slug, Cloudinary)
4. Đọc module liên quan trong `modules/` → hiểu business logic
5. Code → nếu thay đổi cấu trúc, update docs tương ứng

Modules hiện có:
- [`booking.md`](./modules/booking.md)
- [`users-and-roles.md`](./modules/users-and-roles.md)
- [`rooms.md`](./modules/rooms.md)
- [`notifications.md`](./modules/notifications.md)
- [`content.md`](./modules/content.md)
- [`vouchers.md`](./modules/vouchers.md)
- [`room-inventory.md`](./modules/room-inventory.md)
- [`user-profile.md`](./modules/user-profile.md)

---

## 🔄 Quy tắc cập nhật tài liệu

| Thay đổi | Cần update |
|---|---|
| Thêm Entity mới | `database.md`, `modules/[module].md` |
| Thêm API endpoint | `api-guidelines.md`, `modules/[module].md` |
| Thêm module | `modules/[module].md`, `overview.md` |
| Thay đổi business rule | `modules/[module].md`, `workflows/` liên quan |
| Xóa feature | Mark `[DEPRECATED]` hoặc xóa khỏi docs |
