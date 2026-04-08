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
export const checkIn = (id, data = null) =>
    axiosClient.patch(`/Bookings/${id}/check-in`, data);

/**
 * PATCH /api/Bookings/{id}/check-out  [MANAGE_BOOKINGS]
 * Moves booking from Checked_in → Checked_out_pending_settlement
 * Sets room: BusinessStatus = Available, CleaningStatus = Dirty
 * Response: booking object
 */
export const checkOut = (id) =>
    axiosClient.patch(`/Bookings/${id}/check-out`);

export const getReceptionDashboard = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Bookings/receptionist/dashboard${query ? `?${query}` : ""}`);
};

export const getReceptionAvailability = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Bookings/receptionist/availability${query ? `?${query}` : ""}`);
};

export const getReceptionMemberSuggestions = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Bookings/receptionist/member-suggestions${query ? `?${query}` : ""}`);
};

export const addRoomToBooking = (id, data) =>
    axiosClient.post(`/Bookings/${id}/details`, data);

export const checkInRoom = (id, data) =>
    axiosClient.patch(`/Bookings/${id}/check-in-room`, data);

export const checkInBulk = (id, data = {}) =>
    axiosClient.patch(`/Bookings/${id}/check-in-bulk`, data);

export const extendStay = (id, data) =>
    axiosClient.patch(`/Bookings/${id}/extend-stay`, data);

export const earlyCheckOut = (id, data) =>
    axiosClient.patch(`/Bookings/${id}/early-checkout`, data);

