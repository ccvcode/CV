import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "../core/config";

const COOKIE = "median_admin";
const MAX_AGE = 7 * 24 * 3600;

function sign(value: string): string {
  return crypto.createHmac("sha256", config.sessionSecret + config.adminPassword).update(value).digest("base64url");
}

export function adminEnabled(): boolean {
  return config.adminPassword.length >= 8;
}

export function checkPassword(pw: string): boolean {
  if (!adminEnabled()) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(pw).digest());
  const b = Buffer.from(crypto.createHash("sha256").update(config.adminPassword).digest());
  return crypto.timingSafeEqual(a, b);
}

export async function createSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.siteUrl.startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminEnabled()) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  const expected = sign(exp);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Folosit la începutul fiecărei pagini și acțiuni din /admin. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
