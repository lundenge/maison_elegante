import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const API_URL = `${BACKEND_URL.replace(/\/$/, "")}/api`;

export const getApiErrorMessage = (err, fallback = "Failed") => {
  const data = err?.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    const first = data.detail[0];
    if (first && typeof first === "object") {
      return first.msg || first.message || fallback;
    }
    return String(first || fallback);
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message;
  }

  return fallback;
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
