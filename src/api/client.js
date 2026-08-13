import axios from "axios";
import { getAccessToken } from "../lib/supabaseClient.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: {
    // Bypasses the ngrok free-tier browser warning page for API requests
    "ngrok-skip-browser-warning": "true",
  },
});

// Attach the Supabase session token to every request so the Flask backend
// can identify which user (and therefore which workspaces) is asking.
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const listProjects = () => api.get("/projects").then((r) => r.data);
export const createProject = (name, description) =>
  api.post("/projects", { name, description }).then((r) => r.data);
export const getProject = (id) => api.get(`/projects/${id}`).then((r) => r.data);
export const deleteProject = (id) => api.delete(`/projects/${id}`).then((r) => r.data);

export const uploadDocument = (projectId, file, docCategory, onProgress) => {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("file", file);
  form.append("document_type", docCategory);
  return api
    .post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (onProgress) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    })
    .then((r) => r.data);
};
export const getDocumentStatus = (id) => api.get(`/documents/${id}/status`).then((r) => r.data);
export const getDocument = (id) => api.get(`/documents/${id}`).then((r) => r.data);
export const deleteDocument = (id) => api.delete(`/documents/${id}`).then((r) => r.data);

export const askQuestion = (documentId, question) =>
  api.post(`/chat/${documentId}/ask`, { question }).then((r) => r.data);
export const explainSection = (documentId, sectionTitle, sectionText) =>
  api
    .post(`/chat/${documentId}/explain-section`, {
      section_title: sectionTitle,
      section_text: sectionText,
    })
    .then((r) => r.data);
export const getChatHistory = (documentId) =>
  api.get(`/chat/${documentId}/history`).then((r) => r.data);

export const generateSummary = (documentId) =>
  api.post(`/summary/${documentId}/generate`).then((r) => r.data);
export const getSummary = (documentId) => api.get(`/summary/${documentId}`).then((r) => r.data);

export const compareDocuments = (projectId, documentIds) =>
  api.post("/compare", { project_id: projectId, document_ids: documentIds }).then((r) => r.data);

export const translateContent = (content, targetLanguage) =>
  api.post("/translate", { content, target_language: targetLanguage }).then((r) => r.data.content);

export default api;