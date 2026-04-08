import axiosClient from "./axios";
import { buildQueryString } from "../utils";

export const getShifts = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Shifts${query ? `?${query}` : ""}`);
};

export const getCurrentShifts = () => axiosClient.get("/Shifts/current");
export const createShift = (data) => axiosClient.post("/Shifts", data);
export const startShift = (id) => axiosClient.patch(`/Shifts/${id}/start`);
export const completeShift = (id) => axiosClient.patch(`/Shifts/${id}/complete`);
export const handoverShift = (id, data) => axiosClient.patch(`/Shifts/${id}/handover`, data);
export const confirmShift = (id) => axiosClient.patch(`/Shifts/${id}/confirm`);
