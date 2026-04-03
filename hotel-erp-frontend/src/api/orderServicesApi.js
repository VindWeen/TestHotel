import axiosClient from "./axios";
import { buildQueryString } from "../utils";

export const getOrderServices = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/OrderServices${query ? `?${query}` : ""}`);
};

export const getOrderServiceById = (id, params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/OrderServices/${id}${query ? `?${query}` : ""}`);
};

export const getOrderServicesByBookingDetail = (bookingDetailId, params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(
    `/OrderServices/by-booking-detail/${bookingDetailId}${query ? `?${query}` : ""}`,
  );
};

export const createOrderService = (data) =>
  axiosClient.post("/OrderServices", data);

export const updateOrderService = (id, data) =>
  axiosClient.put(`/OrderServices/${id}`, data);

export const updateOrderServiceStatus = (id, status) =>
  axiosClient.patch(`/OrderServices/${id}/status`, { status });

export const deleteOrderService = (id) =>
  axiosClient.delete(`/OrderServices/${id}`);

export const toggleOrderService = (id) =>
  axiosClient.patch(`/OrderServices/${id}/toggle-active`);
