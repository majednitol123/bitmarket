import axios, { Method } from "axios";
import { getAccessToken, setAccessToken } from "./tokenStorage";

export { getAccessToken, setAccessToken };

// Create an Axios instance
const apiClient = axios.create({
  baseURL: "http://www.patientbio.online",
  timeout: 1000000, // Request timeout
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log("Response122:", response.data);
    return response;
  },
  (error) => {
    console.log("API Error:", error.response?.data || error.message);
    return Promise.reject(error.response?.data || error.message);
  }
);

const getAuthHeaders = async (requireToken: boolean): Promise<Record<string, string>> => {
  if (!requireToken) return {};
  const token = await getAccessToken();
  console.log("Token: from getAuthHeaders", token);
  if (!token || token.trim() === "") {
    throw new Error("Authorization token is required but not provided.");
  }
  return { Authorization: `Bearer ${token}` };
};

interface CustomRequestParams {
  method: Method | string;
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  requireToken?: boolean;
}

// API Repository
const apiRepository = {
  /**
   * GET request
   * @param endpoint - The API endpoint
   * @param params - Query parameters
   * @param requireToken - Whether an auth token is required
   */
  async get(endpoint: string, params: Record<string, any> = {}, requireToken: boolean = true) {
    return apiClient.get(endpoint, {
      params,
      headers: await getAuthHeaders(requireToken),
    });
  },

  /**
   * POST request
   * @param endpoint - The API endpoint
   * @param data - Request payload
   * @param requireToken - Whether an auth token is required
   */
  async post(endpoint: string, data: any = {}, requireToken: boolean = true) {
    return apiClient.post(endpoint, data, {
      headers: await getAuthHeaders(requireToken),
    });
  },

  /**
   * PUT request
   * @param endpoint - The API endpoint
   * @param data - Request payload
   * @param requireToken - Whether an auth token is required
   */
  async put(endpoint: string, data: any = {}, requireToken: boolean = true) {
    return apiClient.put(endpoint, data, {
      headers: await getAuthHeaders(requireToken),
    });
  },

  /**
   * DELETE request
   * @param endpoint - The API endpoint
   * @param params - Query parameters
   * @param requireToken - Whether an auth token is required
   */
  async delete(endpoint: string, params: Record<string, any> = {}, requireToken: boolean = true) {
    return apiClient.delete(endpoint, {
      params,
      headers: await getAuthHeaders(requireToken),
    });
  },

  /**
   * Custom request
   * @param config - Axios request config
   */
  async customRequest({ method, endpoint, data = {}, headers = {}, requireToken = true }: CustomRequestParams) {
    const authHeaders = await getAuthHeaders(requireToken);
    const upperMethod = method.toUpperCase();
    return apiClient({
      method,
      url: endpoint,
      data: ["POST", "PUT", "PATCH"].includes(upperMethod) ? data : undefined,
      params: ["GET", "DELETE"].includes(upperMethod) ? data : undefined,
      headers: { ...headers, ...authHeaders },
    });
  },
};

export default apiRepository;
