import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;

interface GoogleAuthSuccess {
  message: string;
  access: string;
  refresh: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    email_verified: boolean;
    onboarding_completed: boolean;
  };
}

// Returned instead of a success when the Google identity has no OnSwift account yet and no
// role was supplied — the caller should ask for a role and re-POST with it.
interface GoogleAuthNewUser {
  new_user: true;
  email: string;
  full_name: string;
}

export type GoogleAuthResponse = GoogleAuthSuccess | GoogleAuthNewUser;

export const googleAuth = async (credential: string, role?: string): Promise<GoogleAuthResponse> => {
  const response = await axios.post(
    `${API_URL}/api/v1/auth/google/`,
    {
      token: credential,
      role,
    }
  );

  return response.data;
};