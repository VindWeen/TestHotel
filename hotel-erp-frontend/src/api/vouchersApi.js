// src/api/vouchersApi.js
import axiosClient from './axios';
import { buildQueryString } from '../utils';

/**
 * GET /api/Vouchers  [MANAGE_BOOKINGS]
 * Params: { isActive, page, pageSize }
 * Response: { total, page, pageSize, data }
 */
export const getVouchers = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Vouchers?${query}`);
};

/**
 * GET /api/Vouchers/{id}  [MANAGE_BOOKINGS]
 * Response: voucher object
 */
export const getVoucherById = (id) =>
    axiosClient.get(`/Vouchers/${id}`);

/**
 * POST /api/Vouchers  [MANAGE_BOOKINGS]
 * Body: {
 *   code, discountType: "PERCENT"|"FIXED_AMOUNT",
 *   discountValue, maxDiscountAmount, minBookingValue,
 *   applicableRoomTypeId, validFrom, validTo,
 *   usageLimit, maxUsesPerUser
 * }
 * Response: voucher object
 */
export const createVoucher = (data) =>
    axiosClient.post('/Vouchers', data);

/**
 * PUT /api/Vouchers/{id}  [MANAGE_BOOKINGS]
 * Body (all optional): {
 *   discountType, discountValue, maxDiscountAmount, minBookingValue,
 *   applicableRoomTypeId, validFrom, validTo,
 *   usageLimit, maxUsesPerUser, isActive
 * }
 * Response: voucher object
 */
export const updateVoucher = (id, data) =>
    axiosClient.put(`/Vouchers/${id}`, data);

/**
 * DELETE /api/Vouchers/{id}  [MANAGE_BOOKINGS]
 * Soft delete — sets isActive = false
 * Response: { message }
 */
export const deleteVoucher = (id) =>
    axiosClient.delete(`/Vouchers/${id}`);

/**
 * POST /api/Vouchers/validate  [Authorize]
 * Body: { code, bookingAmount }
 * Response: {
 *   valid, voucherId, code, discountType, discountValue,
 *   discountAmount, finalAmount, usageRemaining
 * }
 */
export const validateVoucher = (code, bookingAmount) =>
    axiosClient.post('/Vouchers/validate', { code, bookingAmount });
