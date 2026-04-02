import axiosClient from "./axios";

export const recordPayment = (payload) => axiosClient.post("/Payments", payload);
