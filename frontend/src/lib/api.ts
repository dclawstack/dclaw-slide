export interface Deck {
  id: string;
  title: string;
  template: string;
  slides: { title: string; content: string }[];
  duration_minutes: number;
  status: string;
  created_at: string;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
