import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;

export const googleAuth = async (credential: string, role?: string) => {
  const response = await axios.post(
    `${API_URL}/api/auth/google/`,
    {
      token: credential,
      role,
    }
  );

  return response.data;
};