# Module: Content (Articles, Attractions, Reviews)

## Chức năng
Quản lý nội dung CMS: bài viết, danh mục bài viết, địa điểm du lịch, và review của khách.

---

## Articles — Bài viết

### Publishing Flow
```
Draft → Pending_Review → Published
                      ↘ [rejected, quay về Draft]
```
- `GET /api/Articles` (public): chỉ thấy status `Published`.
- Admin có quyền `MANAGE_CONTENT`: thấy tất cả status.
- Chỉ Admin mới có thể set status = `Published`.

### Cloudinary Integration
- Mỗi bài viết có `thumbnail_url` và `cloudinary_public_id`.
- Upload ảnh qua: `POST /api/Articles/{id}/thumbnail`
- Khi xóa bài viết → tự động xóa ảnh cũ trên Cloudinary.
- Resize: 1200×630, crop fill.

### Slug Generation
- Tự động sinh từ title tiếng Việt: `"Khách Sạn Đẹp"` → `"khach-san-dep"`.
- Loại bỏ dấu (NFD normalize), lowercase, replace "đ"→"d", clean ký tự đặc biệt.
- Đảm bảo unique: thêm hậu tố `-2`, `-3`... nếu trùng.
- Slug dùng để GET: `GET /api/Articles/{slug}`.

### Soft Delete
- Dùng `toggle-active` (PATCH) thay vì DELETE thật.
- `IsActive = false` → không hiện với public.

### Endpoints
```http
GET    /api/Articles                      # Public (chỉ Published)
GET    /api/Articles/{slug}               # Public, chi tiết bài viết
POST   /api/Articles                      # MANAGE_CONTENT
PUT    /api/Articles/{id}                 # MANAGE_CONTENT
DELETE /api/Articles/{id}                 # MANAGE_CONTENT (soft delete)
PATCH  /api/Articles/{id}/toggle-active   # MANAGE_CONTENT
POST   /api/Articles/{id}/thumbnail       # MANAGE_CONTENT (upload Cloudinary)

GET    /api/ArticleCategories             # Public
POST   /api/ArticleCategories            # MANAGE_CONTENT
PUT    /api/ArticleCategories/{id}        # MANAGE_CONTENT
DELETE /api/ArticleCategories/{id}        # MANAGE_CONTENT
PATCH  /api/ArticleCategories/{id}/toggle-active  # MANAGE_CONTENT
```

### ActivityLog Actions (Articles)
| ActionCode | Severity | Gửi cho |
|---|---|---|
| `CREATE_ARTICLE` | Success | Admin, Manager |
| `DELETE_ARTICLE` | Warning | Admin, Manager |

---

## Attractions — Địa điểm du lịch

- Lưu tọa độ GPS (`latitude`, `longitude`), khoảng cách từ khách sạn (`distance_km`).
- Có Google Maps embed URL.
- Soft delete qua `toggle-active`.

### Endpoint
```http
GET    /api/Attractions                   # Public
GET    /api/Attractions/{id}              # Public
POST   /api/Attractions                   # MANAGE_CONTENT
PUT    /api/Attractions/{id}              # MANAGE_CONTENT
DELETE /api/Attractions/{id}              # MANAGE_CONTENT
PATCH  /api/Attractions/{id}/toggle-active # MANAGE_CONTENT
```

---

## Reviews — Đánh giá khách

### Moderation Flow
```
Gửi review → IsApproved = false (pending)
    → Admin duyệt (APPROVE) → IsApproved = true [public thấy được]
    → Admin từ chối + lý do → IsApproved = false + rejection_reason
```

### Cloudinary Integration
- Mỗi review có thể upload ảnh minh chứng.
- Upload qua: `POST /api/Reviews/upload-image`
- Folder: `hotel/reviews`, Resize 1200×800.

### Endpoints
```http
GET    /api/Reviews                       # Public (chỉ approved, filter ?status= cho admin)
POST   /api/Reviews                       # [Authorize] — khách submit review
POST   /api/Reviews/upload-image          # [Authorize] — upload ảnh review
PATCH  /api/Reviews/{id}/approve          # MANAGE_CONTENT — duyệt/từ chối
```
