import axiosClient from "./axios";

export const getEquipments = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return axiosClient.get(query ? `/Equipments?${query}` : "/Equipments");
};
