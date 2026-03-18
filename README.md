# 🏨 HotelManagement

## ⚙️ Yêu cầu môi trường

### .NET 10

Kiểm tra phiên bản .NET đang có bằng lệnh:

```bash
dotnet --version
```

Nếu chưa có hoặc phiên bản thấp hơn 10, tải SDK tại:
**[Download .NET 10.0 (Linux, macOS, and Windows) | .NET](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)**
> Chọn bản **SDK x64** hoặc **x86** tùy theo máy.

---

## 🚀 Hướng dẫn chạy project

### 1. Tạo branch cho bản thân

Nếu chưa có branch riêng, tạo và chuyển sang branch mới:

```bash
git checkout -b ten-cua-ban
```

### 2. Tạo database

Chạy file `HotelManagement.sql` trên SQL Server để tạo database, các bảng và dữ liệu mẫu.

> **Tài khoản Admin mặc định có trong dữ liệu mẫu:**
> - 📧 Email: `admin@hotel.com`
> - 🔑 Password: `Admin@123`

### 3. Chạy API

```bash
dotnet run --project HotelManagement.API
```

API sẽ chạy tại:
- http://localhost:5279
