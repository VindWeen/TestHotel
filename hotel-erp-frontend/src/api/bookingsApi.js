// src/api/bookingsApi.js
import axiosClient from './axios';
import { buildQueryString } from '../utils';

/**
 * GET /api/Bookings  [MANAGE_BOOKINGS]
 * Params: { status, fromDate, toDate, userId, page, pageSize }
 * Response: { total, page, pageSize, data }
 */
export const getBookings = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Bookings?${query}`).then((res) => {
        const payload = res?.data;
        if (
            payload &&
            payload.data &&
            !Array.isArray(payload.data) &&
            Array.isArray(payload.data.data)
        ) {
            return {
                ...res,
                data: {
                    ...payload,
                    meta: payload.data,
                    data: payload.data.data,
                },
            };
        }
        return res;
    });
};

/**
 * GET /api/Bookings/{id}  [MANAGE_BOOKINGS]
 * Response: booking detail with bookingDetails array
 */
export const getBookingById = (id) =>
    axiosClient.get(`/Bookings/${id}`);

/**
 * GET /api/Bookings/{id}/detail [MANAGE_BOOKINGS]
 * Response: { message, data, timeline }
 */
export const getBookingDetail = (id) =>
    axiosClient.get(`/Bookings/${id}/detail`);

/**
 * GET /api/Bookings/my-bookings  [Authorize]
 * Response: array of bookings belonging to the current user
 */
export const getMyBookings = () =>
    axiosClient.get('/Bookings/my-bookings');

/**
 * POST /api/Bookings  [AllowAnonymous]
 * Body: {
 *   userId, guestName, guestPhone, guestEmail,
 *   numAdults, numChildren, voucherId, source, note,
 *   details: [{ roomTypeId, checkInDate, checkOutDate }]
 * }
 * Response: booking object
 */
export const createBooking = (data) =>
    axiosClient.post('/Bookings', data);

/**
 * PATCH /api/Bookings/{id}/confirm  [MANAGE_BOOKINGS]
 * Moves booking from Pending → Confirmed
 * Response: booking object
 */
export const confirmBooking = (id) =>
    axiosClient.patch(`/Bookings/${id}/confirm`);

/**
 * PATCH /api/Bookings/{id}/cancel  [Authorize]
 * Params: reason (query string)
 * Response: booking object
 */
export const cancelBooking = (id, reason) =>
    axiosClient.patch(`/Bookings/${id}/cancel`, null, { params: { reason } });

/**
 * PATCH /api/Bookings/{id}/check-in  [MANAGE_BOOKINGS]
 * Auto-assigns an available room of matching RoomType
 * Moves booking from Confirmed → Checked_in
 * Response: booking object
 */
export const checkIn = (id) =>
    axiosClient.patch(`/Bookings/${id}/check-in`);

/**
 * PATCH /api/Bookings/{id}/check-out  [MANAGE_BOOKINGS]
 * Moves booking from Checked_in → Checked_out_pending_settlement
 * Sets room: BusinessStatus = Available, CleaningStatus = Dirty
 * Response: booking object
 */
export const checkOut = (id) =>
    axiosClient.patch(`/Bookings/${id}/check-out`);
