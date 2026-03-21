// src/api/userProfileApi.js
import axiosClient from './axios';

/**
 * GET /api/UserProfile/my-profile  [Authorize]
 * Response: full user profile with role, membership info
 */
export const getMyProfile = () =>
    axiosClient.get('/UserProfile/my-profile');

/**
 * PUT /api/UserProfile/update-profile  [Authorize]
 * Body: { fullName, phone, address, dateOfBirth, gender }
 * Response: { notification }
 */
export const updateProfile = (data) =>
    axiosClient.put('/UserProfile/update-profile', data);

/**
 * PUT /api/UserProfile/change-password  [Authorize]
 * Body: { oldPassword, newPassword }
 * Response: { notification }
 */
export const changePassword = (oldPassword, newPassword) =>
    axiosClient.put('/UserProfile/change-password', { oldPassword, newPassword });

/**
 * POST /api/UserProfile/upload-avatar  [Authorize]
 * Body: FormData with file (image/jpeg, image/png, image/webp, image/gif, max 5MB)
 * Response: { message, avatarUrl }
 */
export const uploadAvatar = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/UserProfile/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};
