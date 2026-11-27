// Shared types for the Pages Functions. Shapes follow docs/CONTRACT.md.

export interface Env {
  GEMINI_API_KEY: string;
  SARVAM_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  PAIRU_CACHE: KVNamespace;
  ASSETS: Fetcher;
}

export interface Source {
  title: string;
  url: string;
}

export interface Discriminator {
  id: string;
  question: string;
  yes: string;
  no: string;
}

export interface Disease {
  id: string;
  crop: string;
  name_en: string;
  names?: Record<string, string>;
  kind: string;
  pathogen?: string;
  symptoms: string[];
  photo_cues: string[];
  look_alikes: string[];
  discriminators: Discriminator[];
  favourable_conditions?: string;
  prevention: string[];
  practices: string[];
  organic_bio: { text: string; source?: number | null }[];
  cibrc_targets: string[];
  sources: Source[];
}

export interface Crop {
  id: string;
  name_en: string;
  names: Record<string, string>;
  diseases: string[];
}

export interface KB {
  _fixture?: boolean;
  crops: Crop[];
  diseases: Disease[];
}

export interface RegisteredUse {
  crop_id: string | null;
  crop_raw: string;
  target_raw: string;
  target_norm: string;
  active_ingredients: string[];
  product_label: string;
  pesticide_type: string;
  dose_ai_g_ha: string;
  dose_formulation_raw: string;
  water_l_ha: string;
  waiting_period_days: number | null;
  waiting_period_raw: string;
  note_raw?: string;
  source: { file?: string; page?: number; url?: string };
}

export interface Banned {
  active: string;
  status: string;
  note?: string;
  aka?: string[];
  printed_name?: string;
  banned_on_crops?: string[];
  restricted_scope?: string;
}

export type Hazard = Record<string, { who_class: string }>;

export interface Candidate {
  id: string;
  confidence: number;
  seen: string[];
  seen_symptoms?: number[];
}

export interface Question extends Discriminator {
  disease: string;
}
