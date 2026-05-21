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

export interface BrandKit {
  id: string;
  workspace_id: string;
  name: string;
  primary_color: string;
  accent_color: string;
  neutral_color: string;
  font_heading: string;
  font_body: string;
  logo_url: string;
  voice_dos: string;
  voice_donts: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateDeckResponse {
  presentation: Presentation;
  provider: string;
  references_used: number;
}

export interface SpeakerNotesResponse {
  slide: Slide;
  notes: string;
  likely_questions: string[];
  provider: string;
}

export type ExportFormat = "html" | "pptx" | "pdf";

export interface SlideStat {
  slide_id: string;
  position: number;
  title: string;
  views: number;
  total_dwell_ms: number;
  average_dwell_ms: number;
  dropoffs: number;
}

export interface AnalyticsSummary {
  presentation_id: string;
  total_sessions: number;
  total_events: number;
  completion_rate: number;
  slides: SlideStat[];
}

export type AnalyticsEventType =
  | "slide_view"
  | "dwell"
  | "advance"
  | "back"
  | "dropoff"
  | "finish";

export interface ShareLink {
  id: string;
  presentation_id: string;
  token: string;
  allow_edit: boolean;
  expires_at: string | null;
  has_password: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface BrandReferenceSummary {
  id: string;
  title: string;
  source_kind: string;
  body_chars: number;
  created_at: string;
}

export interface PublicShare {
  presentation: Presentation;
  allow_edit: boolean;
  expires_at: string | null;
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
  getBrandKit: () => request<BrandKit>("/api/v1/brand-kit"),
  updateBrandKit: (patch: Partial<Omit<BrandKit, "id" | "workspace_id" | "created_at" | "updated_at">>) =>
    request<BrandKit>("/api/v1/brand-kit", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  generateDeck: (input: {
    prompt: string;
    target_slides?: number;
    deck_type?: "pitch" | "report" | "training";
    theme_id?: string;
    title?: string;
    presentation_id?: string;
    replace_existing?: boolean;
    use_brand_references?: boolean;
    workspace_id?: string;
  }) =>
    request<GenerateDeckResponse>("/api/v1/ai/generate-deck", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  generateSpeakerNotes: (slideId: string, save = true) =>
    request<SpeakerNotesResponse>(`/api/v1/ai/speaker-notes/${slideId}`, {
      method: "POST",
      body: JSON.stringify({ save }),
    }),
  autoLayout: (presentationId: string) =>
    request<Presentation>(`/api/v1/presentations/${presentationId}/auto-layout`, {
      method: "POST",
    }),
  exportUrl: (presentationId: string, format: ExportFormat) =>
    `${API_BASE}/api/v1/presentations/${presentationId}/export?format=${format}`,
  recordAnalytics: (
    presentationId: string,
    input: {
      session_id: string;
      event_type: AnalyticsEventType;
      slide_id?: string;
      dwell_ms?: number;
    },
  ) =>
    request<unknown>(`/api/v1/presentations/${presentationId}/analytics/event`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  analyticsSummary: (presentationId: string) =>
    request<AnalyticsSummary>(
      `/api/v1/presentations/${presentationId}/analytics/summary`,
    ),

  getShareLink: (presentationId: string) =>
    request<ShareLink | null>(`/api/v1/presentations/${presentationId}/share`),
  createShareLink: (
    presentationId: string,
    input: { password?: string; allow_edit?: boolean; expires_in_days?: number | null },
  ) =>
    request<ShareLink>(`/api/v1/presentations/${presentationId}/share`, {
      method: "POST",
      body: JSON.stringify({
        password: input.password ?? "",
        allow_edit: input.allow_edit ?? false,
        expires_in_days: input.expires_in_days ?? null,
      }),
    }),
  revokeShareLink: (presentationId: string) =>
    request<void>(`/api/v1/presentations/${presentationId}/share`, { method: "DELETE" }),
  publicShare: (token: string, password?: string) =>
    request<PublicShare>(`/api/v1/share/${token}`, {
      headers: password ? { "X-Share-Password": password } : undefined,
    }),

  listBrandReferences: () =>
    request<BrandReferenceSummary[]>("/api/v1/brand-references"),
  createBrandReference: (input: { title: string; body: string; source_kind?: string }) =>
    request<BrandReferenceSummary>("/api/v1/brand-references", {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        source_kind: input.source_kind ?? "manual",
      }),
    }),
  deleteBrandReference: (id: string) =>
    request<void>(`/api/v1/brand-references/${id}`, { method: "DELETE" }),
};

export interface RealtimeEventPresence {
  event: "presence";
  users: string[];
}
export interface RealtimeEventInvalidate {
  event: "invalidate";
  reason: string;
}
export type RealtimeEvent = RealtimeEventPresence | RealtimeEventInvalidate;

export function presentationSocket(
  presentationId: string,
  userId: string,
  onEvent: (event: RealtimeEvent) => void,
): WebSocket | null {
  if (typeof window === "undefined") return null;
  const base = API_BASE.replace(/^http/, "ws");
  const url = `${base}/api/v1/ws/presentations/${presentationId}?user_id=${encodeURIComponent(userId)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data) as RealtimeEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  // Keepalive ping every 25s so proxies don't kill the connection.
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send("ping");
  }, 25_000);
  ws.addEventListener("close", () => clearInterval(ping));
  return ws;
}
