import axiosClient from "./axios";
import { buildQueryString } from "../utils";

export const getMaintenanceTickets = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/MaintenanceTickets${query ? `?${query}` : ""}`);
};

export const getMaintenanceTicketById = (id) => axiosClient.get(`/MaintenanceTickets/${id}`);
export const createMaintenanceTicket = (data) => axiosClient.post("/MaintenanceTickets", data);
export const updateMaintenanceTicket = (id, data) => axiosClient.put(`/MaintenanceTickets/${id}`, data);
export const updateMaintenanceTicketStatus = (id, data) => axiosClient.patch(`/MaintenanceTickets/${id}/status`, data);
