// src/api/roomInventoriesApi.js
import axiosClient from './axios';

/**
 * GET /api/RoomInventories/room/{roomId}  [MANAGE_INVENTORY]
 * Response: { roomId, data: [{ itemType, count, items: [{ id, roomId, equipmentId, equipmentName, quantity, priceIfLost, note, isActive }] }], total }
 */
export const getInventoryByRoom = (roomId) =>
    axiosClient.get(`/RoomInventories/room/${roomId}`);

/**
 * GET /api/RoomInventories/{id}  [MANAGE_INVENTORY]
 * Response: { id, roomId, equipmentId, equipmentName, itemType, quantity, priceIfLost, note, isActive }
 */
export const getInventoryById = (id) =>
    axiosClient.get(`/RoomInventories/${id}`);

/**
 * POST /api/RoomInventories  [MANAGE_INVENTORY]
 * Body: { roomId, equipmentId, itemType: "Asset"|"Minibar", quantity, priceIfLost, note }
 * Response: { message, id }
 */
export const createInventory = (data) =>
    axiosClient.post('/RoomInventories', data);

/**
 * PUT /api/RoomInventories/{id}  [MANAGE_INVENTORY]
 * Body: { equipmentId, itemType, quantity, priceIfLost, note }
 * Response: { message }
 */
export const updateInventory = (id, data) =>
    axiosClient.put(`/RoomInventories/${id}`, data);

/**
 * DELETE /api/RoomInventories/{id}  [MANAGE_INVENTORY]
 * Soft delete — blocked if referenced by Loss_And_Damages
 * Response: { message }
 */
export const deleteInventory = (id) =>
    axiosClient.delete(`/RoomInventories/${id}`);

/**
 * POST /api/RoomInventories/clone  [MANAGE_INVENTORY]
 * Copies all active items from sourceRoomId to all targetRoomIds
 * Body: { sourceRoomId, targetRoomIds: [] }
 * Response: { message, sourceRoomId, itemsPerRoom, clonedToRooms, invalidRoomIds }
 */
export const cloneInventory = (sourceRoomId, targetRoomIds) =>
    axiosClient.post('/RoomInventories/clone', { sourceRoomId, targetRoomIds });

/**
 * PATCH /api/RoomInventories/{id}/toggle-active  [MANAGE_INVENTORY]
 * Response: { message, id, equipmentId, equipmentName, isActive }
 */
export const toggleInventoryActive = (id) =>
    axiosClient.patch(`/RoomInventories/${id}/toggle-active`);
