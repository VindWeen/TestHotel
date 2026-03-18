using Microsoft.AspNetCore.Mvc;
using System.Data;
using System.Data.SqlClient;
using HotelManagement.DTOs;
using Microsoft.Data.SqlClient;

namespace HotelManagement.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AmenitiesController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AmenitiesController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private SqlConnection GetConnection()
        {
            return new SqlConnection(_configuration.GetConnectionString("DefaultConnection"));
        }

        // =============================
        // GET: api/Amenities [Public]
        // =============================
        [HttpGet]
        public async Task<IActionResult> GetAmenities()
        {
            try
            {
                using (var conn = GetConnection())
                {
                    await conn.OpenAsync();

                    var query = @"
                        SELECT id, name, icon_url
                        FROM Amenities
                        WHERE is_active = 1";

                    using (var cmd = new SqlCommand(query, conn))
                    {
                        var reader = await cmd.ExecuteReaderAsync();

                        var list = new List<object>();

                        while (await reader.ReadAsync())
                        {
                            list.Add(new
                            {
                                id = reader["id"],
                                name = reader["name"],
                                iconUrl = reader["icon_url"]
                            });
                        }

                        return Ok(list);
                    }
                }
            }
            catch
            {
                return StatusCode(500, "Lỗi server");
            }
        }
        // ============================
        // GET: api/Amenities/{id} [Public]
        // =============================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAmenity(int id)
        {
            try
            {
                using (var conn = GetConnection())
                {
                    await conn.OpenAsync();

                    var query = @"
                        SELECT id, name, icon_url
                        FROM Amenities
                        WHERE id = @id AND is_active = 1";

                    using (var cmd = new SqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@id", id);

                        var reader = await cmd.ExecuteReaderAsync();

                        if (await reader.ReadAsync())
                        {
                            return Ok(new
                            {
                                id = reader["id"],
                                name = reader["name"],
                                iconUrl = reader["icon_url"]
                            });
                        }

                        return NotFound("Không tìm thấy thiết bị");
                    }
                }
            }
            catch
            {
                return StatusCode(500, "Lỗi server");
            }
        }

        // =============================
        // POST: api/Amenities [MANAGE_ROOMS]
        // =============================
        [HttpPost]
        public async Task<IActionResult> CreateAmenity([FromBody] AmenityRequest request)
        {
            if (string.IsNullOrEmpty(request.Name))
                return BadRequest("Name is required");

            try
            {
                using (var conn = GetConnection())
                {
                    await conn.OpenAsync();

                    var query = @"
                        INSERT INTO Amenities (name, icon_url, is_active)
                        OUTPUT INSERTED.id, INSERTED.name, INSERTED.icon_url
                        VALUES (@name, @iconUrl, 1)";

                    using (var cmd = new SqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@name", request.Name);
                        cmd.Parameters.AddWithValue("@iconUrl", (object?)request.IconUrl ?? DBNull.Value);

                        var reader = await cmd.ExecuteReaderAsync();

                        if (await reader.ReadAsync())
                        {
                            return StatusCode(201, new
                            {
                                id = reader["id"],
                                name = reader["name"],
                                iconUrl = reader["icon_url"]
                            });
                        }

                        return StatusCode(500, "Lỗi tạo thiết bị");
                    }
                }
            }
            catch
            {
                return StatusCode(500, "Lỗi server");
            }
        }

        // =============================
        // PUT: api/Amenities/{id} [MANAGE_ROOMS]
        // =============================
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAmenity(int id, [FromBody] AmenityRequest request)
        {
            try
            {
                using (var conn = GetConnection())
                {
                    await conn.OpenAsync();

                    var query = @"
                        UPDATE Amenities
                        SET name = @name,
                            icon_url = @iconUrl
                        OUTPUT INSERTED.id, INSERTED.name, INSERTED.icon_url
                        WHERE id = @id AND is_active = 1";

                    using (var cmd = new SqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        cmd.Parameters.AddWithValue("@name", request.Name);
                        cmd.Parameters.AddWithValue("@iconUrl", (object?)request.IconUrl ?? DBNull.Value);

                        var reader = await cmd.ExecuteReaderAsync();

                        if (await reader.ReadAsync())
                        {
                            return Ok(new
                            {
                                id = reader["id"],
                                name = reader["name"],
                                iconUrl = reader["icon_url"]
                            });
                        }

                        return NotFound("Không tìm thấy thiết bị");
                    }
                }
            }
            catch
            {
                return StatusCode(500, "Lỗi server");
            }
        }

        // =============================
        // DELETE: api/Amenities/{id} [MANAGE_ROOMS]
        // =============================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAmenity(int id)
        {
            try
            {
                using (var conn = GetConnection())
                {
                    await conn.OpenAsync();

                    var query = @"
                        UPDATE Amenities
                        SET is_active = 0
                        WHERE id = @id AND is_active = 1";

                    using (var cmd = new SqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@id", id);

                        var rows = await cmd.ExecuteNonQueryAsync();

                        if (rows == 0)
                            return NotFound("Không tìm thấy thiết bị");

                        return Ok(new { message = "Thiết bị đã được xóa" });
                    }
                }
            }
            catch
            {
                return StatusCode(500, "Lỗi server");
            }
        }
    }
}