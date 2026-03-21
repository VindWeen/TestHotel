// src/api/reviewsApi.js
import axiosClient from './axios';
import { buildQueryString } from '../utils';

/**
 * GET /api/Reviews  [Public]
 * Params: { roomTypeId, status: "pending"|"approved"|"rejected", page, pageSize }
 * Default (no status): only approved reviews
 * Response: { total, page, pageSize, avgRating, data }
 */
export const getReviews = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Reviews?${query}`);
};

/**
 * POST /api/Reviews  [Authorize]
 * Body: FormData with fields:
 *   bookingId, roomTypeId, rating (1-5), comment, image (optional file)
 * Content-Type: multipart/form-data
 * Response: { message, id, rating, comment, imageUrl, isApproved }
 */
export const createReview = (data) => {
    const formData = new FormData();
    formData.append('bookingId', data.bookingId);
    formData.append('roomTypeId', data.roomTypeId);
    formData.append('rating', data.rating);
    if (data.comment) formData.append('comment', data.comment);
    if (data.image) formData.append('image', data.image);
    return axiosClient.post('/Reviews', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * POST /api/Reviews/upload-image  [Authorize]
 * Body: FormData with file (image, max 5MB)
 * Response: { url, publicId }
 */
export const uploadReviewImage = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/Reviews/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * PATCH /api/Reviews/{id}/approve  [MANAGE_CONTENT]
 * Body: { isApproved: true|false, rejectionReason (required if false) }
 * Response: { message, id, isApproved, rejectionReason }
 */
export const approveReview = (id, isApproved, rejectionReason = null) =>
    axiosClient.patch(`/Reviews/${id}/approve`, { isApproved, rejectionReason });
