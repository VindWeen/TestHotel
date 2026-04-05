// src/api/roomsApi.js
import axiosClient from './axios';
import { buildQueryString } from '../utils';

/**
 * GET /api/Rooms  [MANAGE_ROOMS]
 * Params: { floor, viewType, businessStatus, cleaningStatus, roomTypeId }
 * Response: { data, total }
 */
export const getRooms = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Rooms?${query}`);
};

/**
 * GET /api/Rooms/{id}  [MANAGE_ROOMS]
 * Response: room detail with inventory list
 */
export const getRoomById = (id) =>
    axiosClient.get(`/Rooms/${id}`);

/**
 * POST /api/Rooms  [MANAGE_ROOMS]
 * Body: { roomNumber, floor, roomTypeId, viewType }
 * Response: { message, id }
 */
export const createRoom = (data) =>
    axiosClient.post('/Rooms', data);

/**
 * PUT /api/Rooms/{id}  [MANAGE_ROOMS]
 * Body: { floor, viewType, notes }
 * Response: { message }
 */
export const updateRoom = (id, data) =>
    axiosClient.put(`/Rooms/${id}`, data);

/**
 * PATCH /api/Rooms/{id}/business_status  [MANAGE_ROOMS]
 * Body: { businessStatus: "Available" | "Occupied" | "Disabled" }
 * Response: { message }
 */
export const updateBusinessStatus = (id, businessStatus) =>
    axiosClient.patch(`/Rooms/${id}/business_status`, { businessStatus });

/**
 * PATCH /api/Rooms/{id}/cleaning-status  [MANAGE_ROOMS]
 * Body: { cleaningStatus: "Clean" | "Dirty" | "PendingLoss" }
 * Response: { message }
 */
export const updateCleaningStatus = (id, cleaningStatus) =>
    axiosClient.patch(`/Rooms/${id}/cleaning-status`, { cleaningStatus });

/**
 * POST /api/Rooms/bulk-create  [MANAGE_ROOMS]
 * Body: [{ roomNumber, floor, roomTypeId, viewType }]
 * Response: { message, created, createdRooms: [{ id, roomNumber }], skipped, invalid }
 */
export const bulkCreateRooms = (items) =>
    axiosClient.post('/Rooms/bulk-create', items);
