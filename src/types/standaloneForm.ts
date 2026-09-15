/** Standalone form types — plain, reusable forms independent of any project or client. */

import type { FormBlock, BlockResponse } from "./onboarding";

export type { FormBlock, BlockResponse };

export interface StandaloneForm {
  id: string;
  creator: string;
  title: string;
  blocks: FormBlock[];
  slug: string;
  url: string;
  is_open: boolean;
  response_count: number;
  created_at: string;
  updated_at: string;
}

/** Lightweight list representation (no blocks payload). */
export interface StandaloneFormListItem {
  id: string;
  title: string;
  slug: string;
  is_open: boolean;
  response_count: number;
  created_at: string;
  updated_at: string;
}

/** Public form data returned for the anonymous fill page. */
export interface StandaloneFormPublicData {
  slug: string;
  title: string;
  blocks: FormBlock[];
  creator_name: string;
  is_open: boolean;
}

export interface StandaloneFormResponse {
  id: string;
  form: string;
  responses: BlockResponse[];
  submitted_at: string;
}

/** Lightweight list representation for the responses table. */
export interface StandaloneFormResponseListItem {
  id: string;
  answered_count: number;
  submitted_at: string;
}
