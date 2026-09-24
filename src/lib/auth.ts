/**
 * Auth client.
 *
 * Accounts live in Postgres behind the FastAPI backend (/api/v1/auth/*). The browser keeps only an
 * opaque session token, plus a cached copy of the public user so the UI renders signed-in instantly
 * while `restoreSession` re-verifies the token with the server. Everything the UI needs goes through
 * this module.
 */

export interface User { name: string; email: string; createdAt: number }

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
const TOKEN_KEY = 'tc-token';
const USER_KEY = 'tc-user';

export class AuthError extends Error {
  field?: 'name' | 'email' | 'password' | 'confirm';
  constructor(message: string, field?: AuthError['field']) { super(message); this.field = field; }
}

export const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };

function saveSession(token: string, user: User) {
  try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* storage blocked */ }
}
function clearSession() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* storage blocked */ }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (init.auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new AuthError('Cannot reach the server. Make sure the backend is running on http://localhost:8000.');
  }

  if (res.ok) return res.json() as Promise<T>;

  const data = await res.json().catch(() => null);
  const detail = data?.detail;
  // FastAPI validation errors put a list in `detail`; ours put { message, field }.
  const err = detail && typeof detail === 'object' && 'message' in detail
    ? new AuthError(detail.message, detail.field ?? undefined)
    : new AuthError('Something went wrong. Please try again.');
  throw Object.assign(err, { status: res.status });
}

export function currentUser(): User | null {
  try {
    if (!getToken()) return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

/** Confirms the stored token with the server. Signs out on 401; keeps the cached user if the server is unreachable. */
export async function restoreSession(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    const { user } = await call<{ user: User }>('/auth/me', { auth: true });
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* storage blocked */ }
    return user;
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      clearSession();
      return null;
    }
    return currentUser();
  }
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<User> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new AuthError('Enter your full name.', 'name');
  if (!validateEmail(email)) throw new AuthError('Enter a valid email address.', 'email');
  if (input.password.length < 8) throw new AuthError('Use at least 8 characters.', 'password');

  const { user, token } = await call<{ user: User; token: string }>('/auth/signup', { method: 'POST', body: { name, email, password: input.password } });
  saveSession(token, user);
  return user;
}

export async function signIn(input: { email: string; password: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!validateEmail(email)) throw new AuthError('Enter a valid email address.', 'email');
  if (!input.password) throw new AuthError('Enter your password.', 'password');

  const { user, token } = await call<{ user: User; token: string }>('/auth/login', { method: 'POST', body: { email, password: input.password } });
  saveSession(token, user);
  return user;
}

export function signOut() {
  // Fire and forget: the local session is gone either way, the server call just revokes the token.
  void call('/auth/logout', { method: 'POST', auth: true }).catch(() => {});
  clearSession();
}

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
