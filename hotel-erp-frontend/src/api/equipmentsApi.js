import axiosClient from "./axios";

export const getEquipments = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return axiosClient.get(query ? `/Equipments?${query}` : "/Equipments");
};

export const createEquipment = (data) => {
  return axiosClient.post("/Equipments", data, {
    transformRequest: [(requestData, headers) => {
      // Let browser generate multipart/form-data boundary automatically.
      if (requestData instanceof FormData && headers) {
        delete headers["Content-Type"];
      }
      return requestData;
    }],
  });
};

export const updateEquipment = (id, data) => {
  return axiosClient.put(`/Equipments/${id}`, data, {
    transformRequest: [(requestData, headers) => {
      if (requestData instanceof FormData && headers) {
        delete headers["Content-Type"];
      }
      return requestData;
    }],
  });
};

export const toggleEquipmentActive = (id) => {
  return axiosClient.patch(`/Equipments/${id}/toggle-active`);
};

export const previewSyncEquipmentInUse = () => {
  return axiosClient.get("/Equipments/preview-sync-inuse");
};

export const syncEquipmentInUse = () => {
  return axiosClient.post("/Equipments/sync-inuse");
};
