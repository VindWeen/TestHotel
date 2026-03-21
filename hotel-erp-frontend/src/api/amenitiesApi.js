// src/api/amenitiesApi.js
import axiosClient from './axios';

/**
 * GET /api/Amenities  [Public]
 * Admin (MANAGE_ROOMS) sees all including inactive
 * Response: [{ id, name, iconUrl, isActive }]
 */
export const getAmenities = () =>
    axiosClient.get('/Amenities');

/**
 * GET /api/Amenities/{id}  [Public]
 * Response: { id, name, iconUrl }
 */
export const getAmenityById = (id) =>
    axiosClient.get(`/Amenities/${id}`);

/**
 * POST /api/Amenities  [MANAGE_ROOMS]
 * Body: { name, iconUrl }
 * Response: { id, name, iconUrl, notification }
 */
export const createAmenity = (data) =>
    axiosClient.post('/Amenities', data);

/**
 * PUT /api/Amenities/{id}  [MANAGE_ROOMS]
 * Body: { name, iconUrl }
 * Response: { id, name, iconUrl, notification }
 */
export const updateAmenity = (id, data) =>
    axiosClient.put(`/Amenities/${id}`, data);

/**
 * DELETE /api/Amenities/{id}  [MANAGE_ROOMS]
 * Soft delete
 * Response: { notification }
 */
export const deleteAmenity = (id) =>
    axiosClient.delete(`/Amenities/${id}`);

/**
 * PATCH /api/Amenities/{id}/toggle-active  [MANAGE_ROOMS]
 * Response: { notification, id, name, isActive }
 */
export const toggleAmenityActive = (id) =>
    axiosClient.patch(`/Amenities/${id}/toggle-active`);
