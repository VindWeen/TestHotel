import axiosClient from "./axios";
import { buildQueryString } from "../utils";

export const getInvoices = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/Invoices?${query}`).then((res) => {
    const payload = res?.data;
    if (
      payload &&
      payload.data &&
      !Array.isArray(payload.data) &&
      Array.isArray(payload.data.data)
    ) {
      return {
        ...res,
        data: {
          ...payload,
          meta: payload.data,
          data: payload.data.data,
        },
      };
    }
    return res;
  });
};

export const getInvoiceDetail = (id) => axiosClient.get(`/Invoices/${id}`);

export const getInvoiceByBookingId = (bookingId) =>
  axiosClient.get(`/Invoices/by-booking/${bookingId}`);

export const createInvoiceFromBooking = (bookingId) =>
  axiosClient.post(`/Invoices/from-booking/${bookingId}`);

export const finalizeInvoice = (id) => axiosClient.post(`/Invoices/${id}/finalize`);

export const addInvoiceAdjustment = (id, data) =>
  axiosClient.post(`/Invoices/${id}/adjustments`, data);

export const removeInvoiceAdjustment = (id, adjustmentId) =>
  axiosClient.delete(`/Invoices/${id}/adjustments/${adjustmentId}`);
