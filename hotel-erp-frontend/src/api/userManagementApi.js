// getUsers(), createUser(), changeRole(), lockUser()
import axiosClient from './axios';
import { buildQueryString } from '../utils';

export const getUsers = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/UserManagement?${query}`);
};

export const getUserById = (id) =>
    axiosClient.get(`/UserManagement/${id}`);

export const createUser = (data) =>
    axiosClient.post('/UserManagement', data);

export const updateUser = (id, data) =>
    axiosClient.put(`/UserManagement/${id}`, data);

export const lockUser = (id) =>
    axiosClient.delete(`/UserManagement/${id}`);

export const toggleStatus = (id) =>
    axiosClient.patch(`/UserManagement/${id}/toggle-status`);

export const changeRole = (id, newRoleId) =>
    axiosClient.put(`/UserManagement/${id}/change-role`, { newRoleId });