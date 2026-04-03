import axiosClient from "./axios";
import { buildQueryString } from "../utils";

export const getMemberships = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Memberships${query ? `?${query}` : ""}`);
};

export const getMembershipById = (id, params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Memberships/${id}${query ? `?${query}` : ""}`);
};

export const createMembership = (data) =>
  axiosClient.post("/Memberships", data);

export const updateMembership = (id, data) =>
  axiosClient.put(`/Memberships/${id}`, data);

export const deleteMembership = (id) =>
  axiosClient.delete(`/Memberships/${id}`);

export const toggleMembership = (id) =>
  axiosClient.patch(`/Memberships/${id}/toggle-active`);
