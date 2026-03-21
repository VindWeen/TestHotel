// src/api/roomTypesApi.js
import axiosClient from './axios';

/**
 * GET /api/RoomTypes  [Public]
 * Response: array of room types with primaryImage and amenities
 */
export const getRoomTypes = () =>
    axiosClient.get('/RoomTypes');

/**
 * GET /api/RoomTypes/{id}  [Public]
 * Response: room type with all images (sorted) and amenities
 */
export const getRoomTypeById = (id) =>
    axiosClient.get(`/RoomTypes/${id}`);

/**
 * DELETE /api/RoomTypes/{id}  [MANAGE_ROOMS]
 * Soft delete — blocked if active bookings exist
 * Response: { message }
 */
export const deleteRoomType = (id) =>
    axiosClient.delete(`/RoomTypes/${id}`);

/**
 * POST /api/RoomTypes/{id}/images  [MANAGE_ROOMS]
 * Body: FormData with file (image)
 * Automatically sets as primary if first image
 * Response: { message, id, imageUrl, isPrimary, sortOrder }
 */
export const uploadRoomTypeImage = (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(`/RoomTypes/${id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * DELETE /api/RoomTypes/images/{imageId}  [MANAGE_ROOMS]
 * Soft delete in DB + destroy on Cloudinary
 * Response: { message }
 */
export const deleteRoomTypeImage = (imageId) =>
    axiosClient.delete(`/RoomTypes/images/${imageId}`);

/**
 * PATCH /api/RoomTypes/{roomTypeId}/images/{imageId}/set-primary  [MANAGE_ROOMS]
 * Sets the specified image as primary, unsets all others
 * Response: { message }
 */
export const setPrimaryImage = (roomTypeId, imageId) =>
    axiosClient.patch(`/RoomTypes/${roomTypeId}/images/${imageId}/set-primary`);

/**
 * PATCH /api/RoomTypes/{id}/toggle-active  [MANAGE_ROOMS]
 * Toggle isActive — blocked if active bookings exist when deactivating
 * Response: { message, id, name, isActive }
 */
export const toggleRoomTypeActive = (id) =>
    axiosClient.patch(`/RoomTypes/${id}/toggle-active`);
