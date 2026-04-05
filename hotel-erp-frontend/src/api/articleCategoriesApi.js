// src/api/articleCategoriesApi.js
import axiosClient from './axios';

/**
 * GET /api/ArticleCategories  [Public]
 * Only active categories
 * Response: { data: [{ id, name, slug }], total }
 */
export const getArticleCategories = (options = {}) =>
    axiosClient.get('/ArticleCategories', { params: options });

/**
 * GET /api/ArticleCategories/{id}  [Public]
 * Response: { id, name, slug }
 */
export const getArticleCategoryById = (id) =>
    axiosClient.get(`/ArticleCategories/${id}`);

/**
 * POST /api/ArticleCategories  [MANAGE_CONTENT]
 * Body: { name }
 * Slug auto-generated from name (Vietnamese-aware)
 * Response: { id, name, slug, notification }
 */
export const createArticleCategory = (name) =>
    axiosClient.post('/ArticleCategories', { name });

/**
 * PUT /api/ArticleCategories/{id}  [MANAGE_CONTENT]
 * Body: { name }
 * Response: { id, name, slug, notification }
 */
export const updateArticleCategory = (id, name) =>
    axiosClient.put(`/ArticleCategories/${id}`, { name });

/**
 * DELETE /api/ArticleCategories/{id}  [MANAGE_CONTENT]
 * Soft delete
 * Response: { notification, affectedArticles }
 */
export const deleteArticleCategory = (id) =>
    axiosClient.delete(`/ArticleCategories/${id}`);

/**
 * PATCH /api/ArticleCategories/{id}/toggle-active  [MANAGE_CONTENT]
 * Response: { notification, id, name, isActive }
 */
export const toggleArticleCategoryActive = (id) =>
    axiosClient.patch(`/ArticleCategories/${id}/toggle-active`);
