export interface SessionInfo {
  name: string;
  attached: boolean;
  created: number;
  windows: number;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function sortSessionsByName(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchSessions(fetchImpl: FetchLike = fetch): Promise<SessionInfo[]> {
  const response = await fetchImpl("/api/sessions");

  if (!response.ok) {
    return [];
  }

  return sortSessionsByName((await response.json()) as SessionInfo[]);
}

export async function deleteSessionApi(
  name: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });

  return response.ok;
}
