import { v4 as uuidv4 } from 'uuid';
import { store, User } from './store';

interface Session {
  userId: string;
  token: string;
  expiresAt: number;
}

const sessions: Map<string, Session> = new Map();
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export async function register(email: string, password: string, name: string): Promise<Omit<User, 'password'>> {
  const user = await store.createUser(email, simpleHash(password), name);
  return user;
}

export async function login(email: string, password: string): Promise<{ user: Omit<User, 'password'>; token: string } | null> {
  const user = await store.findUserByEmail(email);
  
  if (!user || user.password !== simpleHash(password)) {
    return null;
  }
  
  const token = uuidv4();
  const expiresAt = Date.now() + SESSION_DURATION;
  
  sessions.set(token, {
    userId: user.id,
    token,
    expiresAt,
  });
  
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword as Omit<User, 'password'>, token };
}

export function logout(token: string): void {
  sessions.delete(token);
}

export function validateSession(token: string): { userId: string } | null {
  const session = sessions.get(token);
  
  if (!session) {
    return null;
  }
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  
  return { userId: session.userId };
}

export function getUserIdFromToken(token: string): string | null {
  const session = sessions.get(token);
  return session?.userId || null;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000);