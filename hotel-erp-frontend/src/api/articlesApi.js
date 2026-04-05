// src/api/articlesApi.js
import axiosClient from './axios';
import { buildQueryString } from '../utils';

/**
 * GET /api/Articles  [Public]
 * Public sees only Published; admin (MANAGE_CONTENT) sees all statuses
 * Params: { categoryId, page, pageSize }
 * Response: { data, pagination: { page, pageSize, total, totalPages } }
 */
export const getArticles = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/Articles?${query}`);
};

/**
 * GET /api/Articles/{slug}  [Public]
 * Response: full article with content, category, author
 */
export const getArticleBySlug = (slug) =>
    axiosClient.get(`/Articles/${slug}`);

/**
 * POST /api/Articles  [MANAGE_CONTENT]
 * Body: { title, categoryId, content, metaTitle, metaDescription }
 * Slug auto-generated; status starts as "Draft"
 * Response: { notification, id, title, slug, status }
 */
export const createArticle = (data) =>
    axiosClient.post('/Articles', data);

/**
 * PUT /api/Articles/{id}  [MANAGE_CONTENT]
 * Body (all optional): { title, categoryId, content, metaTitle, metaDescription, status }
 * status: "Draft" | "Pending_Review" | "Published" (Published requires Admin role)
 * Response: { notification, id, title, slug, status }
 */
export const updateArticle = (id, data) =>
    axiosClient.put(`/Articles/${id}`, data);

/**
 * DELETE /api/Articles/{id}  [MANAGE_CONTENT]
 * Soft delete
 * Response: { notification }
 */
export const deleteArticle = (id) =>
    axiosClient.delete(`/Articles/${id}`);

/**
 * PATCH /api/Articles/{id}/toggle-active  [MANAGE_CONTENT]
 * Response: { notification, id, title, isActive }
 */
export const toggleArticleActive = (id) =>
    axiosClient.patch(`/Articles/${id}/toggle-active`);

/**
 * POST /api/Articles/{id}/thumbnail  [MANAGE_CONTENT]
 * Body: FormData with file (image/jpeg, image/png, image/webp, image/gif)
 * Old thumbnail is auto-deleted from Cloudinary
 * Response: { notification, thumbnailUrl }
 */
export const uploadArticleThumbnail = (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(`/Articles/${id}/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * POST /api/Articles/content-image  [MANAGE_CONTENT]
 * Upload image used inside article content editor
 * Response: { message, url, publicId }
 */
export const uploadArticleContentImage = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/Articles/content-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};
