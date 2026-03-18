using Microsoft.AspNetCore.Http;

namespace HotelManagement.DTOs
{
    public class UploadImageRequest
    {
        public IFormFile File { get; set; }
        public int SortOrder { get; set; }
    }
    public class UploadMultipleImagesRequest
    {
        public List<IFormFile> Files { get; set; }
        public int StartSortOrder { get; set; } = 0;
    }
}