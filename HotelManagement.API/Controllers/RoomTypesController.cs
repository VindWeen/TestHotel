using Microsoft.AspNetCore.Mvc;
using System.Data.SqlClient;
using System.Data;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HotelManagement.DTOs;
using Microsoft.Data.SqlClient;

namespace HotelManagement.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RoomTypesController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly Cloudinary _cloudinary;

        // Constructor
        public RoomTypesController(IConfiguration configuration)
        {
            _configuration = configuration;

            var account = new Account(
                _configuration["Cloudinary:CloudName"],
                _configuration["Cloudinary:ApiKey"],
                _configuration["Cloudinary:ApiSecret"]
            );

            _cloudinary = new Cloudinary(account);
        }

        private SqlConnection GetConnection()
        {
            return new SqlConnection(_configuration.GetConnectionString("DefaultConnection"));
        }

        // =========================================
        // GET: api/RoomTypes [Public]
        // =========================================
        [HttpGet]
        public async Task<IActionResult> GetRoomTypes()
        {
            using var conn = GetConnection();
            await conn.OpenAsync();
            // Lấy tất cả loại phòng + ảnh primary + amenities trong 1 query để giảm số round-trip DB
            var query = @"
                SELECT rt.id, rt.name, rt.base_price,
                       img.image_url,
                       a.id AS amenity_id, a.name AS amenity_name, a.icon_url
                FROM Room_Types rt
                LEFT JOIN Room_Images img ON rt.id = img.room_type_id AND img.is_primary = 1
                LEFT JOIN RoomType_Amenities rta ON rt.id = rta.room_type_id
                LEFT JOIN Amenities a ON rta.amenity_id = a.id AND a.is_active = 1
                WHERE rt.is_active = 1";

            using var cmd = new SqlCommand(query, conn);
            var reader = await cmd.ExecuteReaderAsync();

            var dict = new Dictionary<int, dynamic>();
            while (await reader.ReadAsync())
            {
                int id = (int)reader["id"];
                // nếu chưa có trong dict thì tạo mới
                if (!dict.ContainsKey(id))
                {
                    dict[id] = new
                    {
                        id,
                        name = reader["name"],
                        price = reader["base_price"],
                        primaryImage = reader["image_url"],
                        amenities = new List<object>()
                    };
                }
                // thêm amenity nếu có
                if (reader["amenity_id"] != DBNull.Value)
                {
                    dict[id].amenities.Add(new
                    {
                        id = reader["amenity_id"],
                        name = reader["amenity_name"],
                        iconUrl = reader["icon_url"]
                    });
                }
            }

            return Ok(dict.Values);
        }

        // =========================================
        // GET: api/RoomTypes/{id} [Public]
        // =========================================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetRoomTypeDetail(int id)
        {
            using var conn = GetConnection();
            await conn.OpenAsync();

            var roomQuery = @"
                SELECT * FROM Room_Types
                WHERE id = @id AND is_active = 1";

            using var cmd = new SqlCommand(roomQuery, conn);
            
            cmd.Parameters.AddWithValue("@id", id);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return NotFound();

            var room = new
            {
                id,
                name = reader["name"],
                price = reader["base_price"],
                description = reader["description"]
            };

            reader.Close();

            // Thêm images vào bảng Room_Images để có thêm thông tin is_primary, sort_order
            var images = new List<object>();
            var imgQuery = @"
                SELECT id, image_url, is_primary, sort_order
                FROM Room_Images
                WHERE room_type_id = @id
                ORDER BY sort_order";

            using var imgCmd = new SqlCommand(imgQuery, conn);
            imgCmd.Parameters.AddWithValue("@id", id);

            var imgReader = await imgCmd.ExecuteReaderAsync();
            while (await imgReader.ReadAsync())
            {
                images.Add(new
                {
                    id = imgReader["id"],
                    url = imgReader["image_url"],
                    isPrimary = imgReader["is_primary"],
                    sortOrder = imgReader["sort_order"]
                });
            }

            imgReader.Close();

            // amenities
            var amenities = new List<object>();
            var amenityQuery = @"
                SELECT a.id, a.name, a.icon_url
                FROM RoomType_Amenities rta
                JOIN Amenities a ON rta.amenity_id = a.id
                WHERE rta.room_type_id = @id AND a.is_active = 1";

            using var aCmd = new SqlCommand(amenityQuery, conn);
            aCmd.Parameters.AddWithValue("@id", id);

            var aReader = await aCmd.ExecuteReaderAsync();
            while (await aReader.ReadAsync())
            {
                amenities.Add(new
                {
                    id = aReader["id"],
                    name = aReader["name"],
                    iconUrl = aReader["icon_url"]
                });
            }

            return Ok(new
            {
                room,
                images,
                amenities
            });
        }

        // =========================================
        // DELETE: api/RoomTypes/{id} [MANAGE_ROOMS]
        // =========================================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRoomType(int id)
        {
            using var conn = GetConnection();
            await conn.OpenAsync();

            // check booking active
            var checkQuery = @"
                SELECT COUNT(*) FROM Bookings
                WHERE [id] = @id AND status = 'ACTIVE'";

            using var checkCmd = new SqlCommand(checkQuery, conn);
            checkCmd.Parameters.AddWithValue("@id", id);

            int count = (int)await checkCmd.ExecuteScalarAsync();

            if (count > 0)
                return BadRequest("Không thể xóa loại phòng đang có booking active");

            var deleteQuery = @"
                UPDATE Room_Types
                SET is_active = 0
                WHERE id = @id";

            using var delCmd = new SqlCommand(deleteQuery, conn);
            delCmd.Parameters.AddWithValue("@id", id);

            await delCmd.ExecuteNonQueryAsync();

            return Ok("Xóa thành công");
        }
        // =========================================
        // POST: api/RoomTypes [MANAGE_ROOMS]
        // =========================================
        [HttpPost]
        public async Task<IActionResult> CreateRoomType([FromBody] CreateRoomTypeRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Name is required");

            using var conn = GetConnection();
            await conn.OpenAsync();

            // Insert + lấy ID vừa tạo
            var query = @"
        INSERT INTO Room_Types (name, price_per_night, description, is_active)
        OUTPUT INSERTED.id
        VALUES (@name, @price, @desc, 1)";

            using var cmd = new SqlCommand(query, conn);
            cmd.Parameters.AddWithValue("@name", request.Name);
            cmd.Parameters.AddWithValue("@price", request.Price);
            cmd.Parameters.AddWithValue("@desc", (object?)request.Description ?? DBNull.Value);

            int newId = (int)await cmd.ExecuteScalarAsync();

            return Ok(new
            {
                message = "Thành công",
                id = newId
            });
        }

        // =========================================
        // POST: api/RoomTypes/{id}/images
        // =========================================
        [HttpPost("{id}/images")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadImage(
            int id,
            [FromForm] UploadImageRequest request)
        {
            var file = request.File;

            if (file == null || file.Length == 0)
                return BadRequest("Không có file được tải lên");

            var uploadParams = new ImageUploadParams()
            {
                File = new FileDescription(file.FileName, file.OpenReadStream())
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            using var conn = GetConnection();
            await conn.OpenAsync();

            var query = @"
        INSERT INTO Room_Images (room_type_id, image_url, cloudinary_public_id, sort_order, is_primary)
        VALUES (@roomId, @url, @publicId, @sort, 0)";

            using var cmd = new SqlCommand(query, conn);
            cmd.Parameters.AddWithValue("@roomId", id);
            cmd.Parameters.AddWithValue("@url", result.SecureUrl.ToString());
            cmd.Parameters.AddWithValue("@publicId", result.PublicId);
            cmd.Parameters.AddWithValue("@sort", request.SortOrder);

            await cmd.ExecuteNonQueryAsync();

            return Ok(result.SecureUrl);
        }
        // =========================================
        // POST: api/RoomTypes/{id}/images/multiple
        // =========================================
        [HttpPost("{id}/images/multiple")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadMultipleImages(
            int id,
            [FromForm] UploadMultipleImagesRequest request)
        {
            if (request.Files == null || request.Files.Count == 0)
                return BadRequest("No files uploaded");

            using var conn = GetConnection();
            await conn.OpenAsync();

            using var tran = conn.BeginTransaction();

            try
            {
                int sortOrder = request.StartSortOrder;
                var uploadedUrls = new List<string>();

                // check đã có ảnh primary chưa
                var checkPrimaryQuery = @"
            SELECT COUNT(*) FROM Room_Images
            WHERE room_type_id = @roomId AND is_primary = 1";

                using var checkCmd = new SqlCommand(checkPrimaryQuery, conn, tran);
                checkCmd.Parameters.AddWithValue("@roomId", id);

                int hasPrimary = (int)await checkCmd.ExecuteScalarAsync();

                bool setFirstAsPrimary = hasPrimary == 0;

                foreach (var file in request.Files)
                {
                    if (file.Length == 0) continue;

                    // upload Cloudinary
                    var uploadParams = new ImageUploadParams()
                    {
                        File = new FileDescription(file.FileName, file.OpenReadStream())
                    };

                    var result = await _cloudinary.UploadAsync(uploadParams);

                    bool isPrimary = false;

                    // nếu chưa có primary → set ảnh đầu tiên
                    if (setFirstAsPrimary)
                    {
                        isPrimary = true;
                        setFirstAsPrimary = false;
                    }

                    var query = @"
                INSERT INTO Room_Images 
                (room_type_id, image_url, cloudinary_public_id, sort_order, is_primary)
                VALUES (@roomId, @url, @publicId, @sort, @isPrimary)";

                    using var cmd = new SqlCommand(query, conn, tran);
                    cmd.Parameters.AddWithValue("@roomId", id);
                    cmd.Parameters.AddWithValue("@url", result.SecureUrl.ToString());
                    cmd.Parameters.AddWithValue("@publicId", result.PublicId);
                    cmd.Parameters.AddWithValue("@sort", sortOrder++);
                    cmd.Parameters.AddWithValue("@isPrimary", isPrimary);

                    await cmd.ExecuteNonQueryAsync();

                    uploadedUrls.Add(result.SecureUrl.ToString());
                }

                tran.Commit();

                return Ok(new
                {
                    message = "Thành công",
                    images = uploadedUrls
                });
            }
            catch (Exception ex)
            {
                tran.Rollback();
                return StatusCode(500, ex.Message);
            }
        }
        // =========================================
        // PUT: api/RoomTypes/{id}
        // =========================================
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRoomType(int id, [FromBody] UpdateRoomTypeRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Name is required");

            using var conn = GetConnection();
            await conn.OpenAsync();

            // check tồn tại
            var checkQuery = "SELECT COUNT(*) FROM Room_Types WHERE id = @id AND is_active = 1";
            using var checkCmd = new SqlCommand(checkQuery, conn);
            checkCmd.Parameters.AddWithValue("@id", id);

            int exists = (int)await checkCmd.ExecuteScalarAsync();
            if (exists == 0)
                return NotFound("RoomType not found");

            // UPDATE
            var query = @"
        UPDATE Room_Types
        SET name = @name,
            base_price = @price,
            description = @desc
        WHERE id = @id";

            using var cmd = new SqlCommand(query, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@name", request.Name);
            cmd.Parameters.AddWithValue("@price", request.Price);
            cmd.Parameters.AddWithValue("@desc", (object?)request.Description ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();

            return Ok("Thành công");
        }

        // =========================================
        // DELETE: api/RoomTypes/images/{imageId}
        // =========================================
        [HttpDelete("images/{imageId}")]
        public async Task<IActionResult> DeleteImage(int imageId)
        {
            using var conn = GetConnection();
            await conn.OpenAsync();

            var getQuery = @"SELECT cloudinary_public_id FROM Room_Images WHERE id = @id";
            using var getCmd = new SqlCommand(getQuery, conn);
            getCmd.Parameters.AddWithValue("@id", imageId);

            var publicId = (string?)await getCmd.ExecuteScalarAsync();

            if (publicId == null)
                return NotFound();

            // delete cloudinary
            await _cloudinary.DestroyAsync(new DeletionParams(publicId));

            // soft delete DB
            var delQuery = @"DELETE FROM Room_Images WHERE id = @id";
            using var delCmd = new SqlCommand(delQuery, conn);
            delCmd.Parameters.AddWithValue("@id", imageId);

            await delCmd.ExecuteNonQueryAsync();

            return Ok("Đã xóa ảnh");
        }
        // =========================================
        // PATCH: /api/RoomTypes/{id}/amenities
        // =========================================
        [HttpPatch("{id}/amenities")]
        public async Task<IActionResult> UpdateAmenities(int id, [FromBody] List<int> amenityIds)
        {
            if (amenityIds == null)
                return BadRequest("Amenity list is required");

            using var conn = GetConnection();
            await conn.OpenAsync();

            using var tran = conn.BeginTransaction();

            try
            {
                // check room tồn tại
                var checkRoomQuery = @"
            SELECT COUNT(*) 
            FROM Room_Types 
            WHERE id = @id AND is_active = 1";

                using var checkRoomCmd = new SqlCommand(checkRoomQuery, conn, tran);
                checkRoomCmd.Parameters.AddWithValue("@id", id);

                int roomExists = (int)await checkRoomCmd.ExecuteScalarAsync();
                if (roomExists == 0)
                {
                    tran.Rollback();
                    return NotFound("RoomType not found");
                }

                // XÓA hết amenities cũ
                var deleteQuery = @"
            DELETE FROM RoomType_Amenities
            WHERE room_type_id = @id";

                using var delCmd = new SqlCommand(deleteQuery, conn, tran);
                delCmd.Parameters.AddWithValue("@id", id);
                await delCmd.ExecuteNonQueryAsync();

                // INSERT lại
                foreach (var amenityId in amenityIds)
                {
                    var insertQuery = @"
                INSERT INTO RoomType_Amenities (room_type_id, amenity_id)
                VALUES (@roomId, @amenityId)";

                    using var insCmd = new SqlCommand(insertQuery, conn, tran);
                    insCmd.Parameters.AddWithValue("@roomId", id);
                    insCmd.Parameters.AddWithValue("@amenityId", amenityId);

                    await insCmd.ExecuteNonQueryAsync();
                }

                tran.Commit();

                return Ok("Thành công");
            }
            catch (Exception ex)
            {
                tran.Rollback();
                return StatusCode(500, ex.Message);
            }
        }

        // =========================================
        // PATCH: set primary image
        // =========================================
        [HttpPatch("{roomTypeId}/images/{imageId}/set-primary")]
        public async Task<IActionResult> SetPrimary(int roomTypeId, int imageId)
        {
            using var conn = GetConnection();
            await conn.OpenAsync();

            using var tran = conn.BeginTransaction();

            try
            {
                var resetQuery = @"
                    UPDATE Room_Images
                    SET is_primary = 0
                    WHERE room_type_id = @roomId";

                using var resetCmd = new SqlCommand(resetQuery, conn, tran);
                resetCmd.Parameters.AddWithValue("@roomId", roomTypeId);
                await resetCmd.ExecuteNonQueryAsync();

                var setQuery = @"
                    UPDATE Room_Images
                    SET is_primary = 1
                    WHERE id = @imageId";

                using var setCmd = new SqlCommand(setQuery, conn, tran);
                setCmd.Parameters.AddWithValue("@imageId", imageId);
                await setCmd.ExecuteNonQueryAsync();

                tran.Commit();
                return Ok("Ảnh chính đã được cập nhật");
            }
            catch
            {
                tran.Rollback();
                return StatusCode(500, "Chuyển đổi thất bại");
            }
        }
    }
}