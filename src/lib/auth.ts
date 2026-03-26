/** Server-side auth utilities */
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { Role } from "./role-shared";

// Re-export core utilities
export { verifyToken, createToken, COOKIE_NAME, TOKEN_MAX_AGE } from "./auth-core";
export type { TokenPayload } from "./auth-core";
import { verifyToken, COOKIE_NAME } from "./auth-core";
import type { TokenPayload } from "./auth-core";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Get current user from cookie - server components only */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Verify user still exists and is active, get fresh role
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, isActive: true, role: true },
  });

  if (!user || !user.isActive) return null;

  return { ...payload, role: user.role as Role };
}

/** Get user from request cookie - API routes */
export async function getUserFromRequest(request: Request): Promise<TokenPayload | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}
