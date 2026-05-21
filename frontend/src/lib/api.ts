const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(text || `API error ${response.status}`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  accent: string;
  background: string;
  font_heading: string;
  font_body: string;
  cover_emoji: string;
}

export interface PresentationSummary {
  id: string;
  title: string;
  template: string;
  theme_id: string;
  status: string;
  slide_count: number;
  created_at: string;
  updated_at: string;
}

export interface Slide {
  id: string;
  presentation_id: string;
  position: number;
  layout: string;
  title: string;
  body: string;
  speaker_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Presentation {
  id: string;
  workspace_id: string;
  title: string;
  template: string;
  theme_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  slides: Slide[];
}

export interface HealthInfo {
  status: string;
  app: string;
  version: string;
  db: string;
}

export const api = {
  health: () => request<HealthInfo>("/health/"),
  themes: () => request<Theme[]>("/api/v1/themes"),
  listPresentations: () => request<PresentationSummary[]>("/api/v1/presentations"),
  createPresentation: (input: { title: string; template?: string; theme_id?: string }) =>
    request<Presentation>("/api/v1/presentations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getPresentation: (id: string) => request<Presentation>(`/api/v1/presentations/${id}`),
  updatePresentation: (
    id: string,
    patch: Partial<Pick<Presentation, "title" | "template" | "theme_id" | "status">>,
  ) =>
    request<Presentation>(`/api/v1/presentations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deletePresentation: (id: string) =>
    request<void>(`/api/v1/presentations/${id}`, { method: "DELETE" }),
  applyOutline: (id: string, outline: string, replace_existing = true) =>
    request<Presentation>(`/api/v1/presentations/${id}/outline`, {
      method: "POST",
      body: JSON.stringify({ outline, replace_existing }),
    }),
  updateSlide: (presentationId: string, slideId: string, patch: Partial<Slide>) =>
    request<Slide>(`/api/v1/presentations/${presentationId}/slides/${slideId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteSlide: (presentationId: string, slideId: string) =>
    request<void>(
      `/api/v1/presentations/${presentationId}/slides/${slideId}`,
      { method: "DELETE" },
    ),
  reorderSlides: (presentationId: string, slide_ids: string[]) =>
    request<Slide[]>(
      `/api/v1/presentations/${presentationId}/slides/reorder`,
      { method: "POST", body: JSON.stringify({ slide_ids }) },
    ),
};
