import axiosClient from "./axios";

export const getPermissions = () => axiosClient.get("/Permissions");
