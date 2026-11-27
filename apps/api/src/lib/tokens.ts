import { sign, verify } from "hono/jwt";

export const SESSION_COOKIE = "np_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h - one hackathon day, no refresh dance needed
const WS_TICKET_TTL_SECONDS = 60;

interface SessionClaims {
  sub: string;
  tv: number;
  typ: "session";
}
interface WsTicketClaims {
  sub: string;
  topic: string;
  typ: "ws";
}

const nowSec = () => Math.floor(Date.now() / 1000);

export function assertSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be set and at least 32 characters");
  return secret;
}

export async function signSession(userId: number, tokenVersion: number, secret: string) {
  const iat = nowSec();
  return sign({ sub: String(userId), tv: tokenVersion, typ: "session", iat, exp: iat + SESSION_TTL_SECONDS }, secret, "HS256");
}

export async function verifySession(token: string, secret: string): Promise<{ userId: number; tokenVersion: number } | null> {
  try {
    const p = (await verify(token, secret, "HS256")) as unknown as SessionClaims;
    if (p.typ !== "session") return null;
    return { userId: Number(p.sub), tokenVersion: Number(p.tv) };
  } catch {
    return null;
  }
}

/** Short-lived, single-topic ticket: the browser trades its cookie session for this, then opens the socket. */
export async function signWsTicket(userId: number, topic: string, secret: string) {
  const iat = nowSec();
  const ticket = await sign({ sub: String(userId), topic, typ: "ws", iat, exp: iat + WS_TICKET_TTL_SECONDS }, secret, "HS256");
  return { ticket, expiresIn: WS_TICKET_TTL_SECONDS };
}

export async function verifyWsTicket(ticket: string, secret: string): Promise<{ userId: number; topic: string } | null> {
  try {
    const p = (await verify(ticket, secret, "HS256")) as unknown as WsTicketClaims;
    if (p.typ !== "ws") return null;
    return { userId: Number(p.sub), topic: p.topic };
  } catch {
    return null;
  }
}
