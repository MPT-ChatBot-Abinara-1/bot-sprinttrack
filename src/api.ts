import { config } from './config.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Ubah "6281234567890@c.us" menjadi "6281234567890". */
export function phoneFromJid(jid: string): string {
  return jid.split('@')[0];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-bot-key': config.botApiKey,
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(0, 'Server SprintTrack tidak dapat dihubungi, coba lagi nanti.');
  }
  const body = (await res.json().catch(() => ({}))) as { message?: string; data?: T };
  if (!res.ok) {
    throw new ApiError(res.status, body.message ?? 'Terjadi kesalahan pada server.');
  }
  return body.data as T;
}

export interface TaskSummary {
  code: number;
  title: string;
  status: string;
  priority?: string;
  deadline?: string | null;
  division?: string;
  assignee?: { name: string } | null;
  userStory?: {
    title: string;
    sprint?: { name: string } | null;
  } | null;
  previousStatus?: string;
  message?: string;
}

export const api = {
  myTasks: (phone: string) =>
    request<TaskSummary[]>(`/bot/tasks/mine?phone=${encodeURIComponent(phone)}`),
  updateStatus: (code: string, phone: string, status: string) =>
    request<TaskSummary>(`/bot/tasks/${encodeURIComponent(code)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ phone, status }),
    }),
  addLog: (code: string, phone: string, message: string) =>
    request<TaskSummary>(`/bot/tasks/${encodeURIComponent(code)}/logs`, {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    }),
};
