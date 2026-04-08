import axiosClient from "./axios";

export const getDashboardOverview = () => axiosClient.get("/Dashboard/overview");
