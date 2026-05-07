/** Onboarding form block types */

export type BlockType =
  | "welcome"
  | "short_answer"
  | "long_answer"
  | "multiple_choice"
  | "file_upload"
  | "checkbox";

export interface FormBlock {
  type: BlockType;
  label?: string;
  content?: string; // For welcome block rich text
  required?: boolean;
  options?: string[]; // For multiple_choice
  placeholder?: string;
}

export interface OnboardingTemplate {
  id: string;
  creator: string;
  title: string;
  blocks: FormBlock[];
  instance_count?: number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingInstance {
  id: string;
  template: string;
  template_title: string;
  slug: string;
  url: string;
  client: string | null;
  client_name: string | null;
  client_email: string | null;
  project: string | null;
  status: "SENT" | "OPENED" | "COMPLETED";
  is_expired: boolean;
  expires_at: string | null;
  completed_at: string | null;
  responses: BlockResponse[] | null;
  created_at: string;
}

export interface BlockResponse {
  block_index: number;
  value: string | string[] | boolean | null;
  file_url?: string;
}

/** Public form data returned for client-facing onboarding page */
export interface OnboardingPublicData {
  slug: string;
  title: string;
  blocks: FormBlock[];
  creator_name: string;
  creator_company: string | null;
  is_expired: boolean;
  status: string;
}

export interface ClientSignupData {
  full_name: string;
  email: string;
  password: string;
  responses: BlockResponse[];
}
