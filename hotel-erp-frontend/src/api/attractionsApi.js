// src/api/attractionsApi.js
import axiosClient from './axios';

/**
 * GET /api/Attractions  [Public]
 * Params: { category: "Di tích"|"Ẩm thực"|"Giải trí"|"Thiên nhiên" }
 * Sorted by distanceKm ascending
 * Response: { data: [{ id, name, category, address, latitude, longitude, distanceKm, imageUrl }], total }
 */
export const getAttractions = (category = null) => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return axiosClient.get(`/Attractions${params}`);
};

/**
 * GET /api/Attractions/{id}  [Public]
 * Response: full attraction with description, mapEmbedLink, GPS coords
 */
export const getAttractionById = (id) =>
    axiosClient.get(`/Attractions/${id}`);

/**
 * POST /api/Attractions  [MANAGE_CONTENT]
 * Body: {
 *   name, category, address,
 *   latitude, longitude, distanceKm,
 *   description, imageUrl, mapEmbedLink
 * }
 * category must be one of: "Di tích" | "Ẩm thực" | "Giải trí" | "Thiên nhiên"
 * Response: { message, id, name, category, distanceKm }
 */
export const createAttraction = (data) =>
    axiosClient.post('/Attractions', data);

/**
 * PUT /api/Attractions/{id}  [MANAGE_CONTENT]
 * Body (all optional): {
 *   name, category, address,
 *   latitude, longitude, distanceKm,
 *   description, imageUrl, mapEmbedLink
 * }
 * Response: { message, id, name, category, distanceKm }
 */
export const updateAttraction = (id, data) =>
    axiosClient.put(`/Attractions/${id}`, data);

/**
 * DELETE /api/Attractions/{id}  [MANAGE_CONTENT]
 * Soft delete
 * Response: { message }
 */
export const deleteAttraction = (id) =>
    axiosClient.delete(`/Attractions/${id}`);

/**
 * PATCH /api/Attractions/{id}/toggle-active  [MANAGE_CONTENT]
 * Response: { message, id, name, isActive }
 */
export const toggleAttractionActive = (id) =>
    axiosClient.patch(`/Attractions/${id}/toggle-active`);
