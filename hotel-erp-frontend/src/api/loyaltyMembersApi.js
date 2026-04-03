import axiosClient from "./axios";
import { buildQueryString } from "../utils";

export const getLoyaltyMembers = (params = {}) => {
  const query = buildQueryString(params);
  return axiosClient.get(`/LoyaltyMembers${query ? `?${query}` : ""}`);
};

export const getLoyaltyMemberById = (id) =>
  axiosClient.get(`/LoyaltyMembers/${id}`);

export const getLoyaltyMemberTransactions = (id) =>
  axiosClient.get(`/LoyaltyMembers/${id}/transactions`);
