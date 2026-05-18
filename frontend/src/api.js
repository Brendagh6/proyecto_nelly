import axios from "axios";

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://127.0.0.1:5000",
  timeout: 20000,
});

