import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Manager PIN: a scrypt hash in app_secrets once Gústi changes it in Settings;
// until then the MANAGER_PIN env var (default 1234) is used.
const KEY = "manager_pin";

const hasDb = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function storedHash(): Promise<string | null> {
  if (!hasDb()) return null;
  const { data } = await db().from("app_secrets").select("value").eq("key", KEY).maybeSingle();
  return (data?.value as string | undefined) || null;
}

const eq = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export async function verifyPin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  const stored = await storedHash();
  if (stored) {
    const [salt, hash] = stored.split(":");
    return eq(scryptSync(pin, Buffer.from(salt, "hex"), 32), Buffer.from(hash, "hex"));
  }
  const env = process.env.MANAGER_PIN || "1234";
  return eq(Buffer.from(pin), Buffer.from(env));
}

export const canChangePin = hasDb;

export async function setPin(pin: string) {
  const salt = randomBytes(16);
  const value = salt.toString("hex") + ":" + scryptSync(pin, salt, 32).toString("hex");
  const { error } = await db().from("app_secrets").upsert({ key: KEY, value, updated_at: Date.now() });
  if (error) throw error;
}

// Proof that a device passed the PIN; changes whenever the PIN changes.
export async function managerToken() {
  const key = process.env.VAPID_PRIVATE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "skjol";
  const basis = (await storedHash()) || process.env.MANAGER_PIN || "1234";
  return createHmac("sha256", key).update("manager:" + basis).digest("base64url");
}

export async function checkManagerToken(t: unknown) {
  return typeof t === "string" && eq(Buffer.from(t), Buffer.from(await managerToken()));
}
