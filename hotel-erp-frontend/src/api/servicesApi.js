import axiosClient from "./axios";
import { buildQueryString } from "../utils";

export const getServiceCategories = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Services/categories${query ? `?${query}` : ""}`);
};

export const getServiceCategoryById = (id, params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Services/categories/${id}${query ? `?${query}` : ""}`);
};

export const createServiceCategory = (data) =>
  axiosClient.post("/Services/categories", data);

export const updateServiceCategory = (id, data) =>
  axiosClient.put(`/Services/categories/${id}`, data);

export const deleteServiceCategory = (id) =>
  axiosClient.delete(`/Services/categories/${id}`);

export const toggleServiceCategory = (id) =>
  axiosClient.patch(`/Services/categories/${id}/toggle-active`);

export const getServices = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Services${query ? `?${query}` : ""}`);
};

export const getServiceById = (id, params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Services/${id}${query ? `?${query}` : ""}`);
};

export const createService = (data) => axiosClient.post("/Services", data);

export const updateService = (id, data) =>
  axiosClient.put(`/Services/${id}`, data);

export const deleteService = (id) => axiosClient.delete(`/Services/${id}`);

export const toggleService = (id) =>
  axiosClient.patch(`/Services/${id}/toggle-active`);
