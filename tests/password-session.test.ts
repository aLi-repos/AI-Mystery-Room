/**
 * Verification: password hashing (§9.2) and session JWT mechanics (§9.1).
 * No database involved — real bcryptjs + real next-auth encode/decode.
 */
import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  hashPassword,
  isStrongPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  issueSessionToken,
  readSessionClaims,
  sessionUserFromClaims,
} from "@/lib/auth/session";

const PASSWORD = "Blackwood-1895!";

describe("Password hashing (§9.2) — real bcrypt", () => {
  it("produces a bcrypt hash that does NOT contain the password", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toContain(PASSWORD);
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it("uses cost ≥ 12", async () => {
    const hash = await hashPassword(PASSWORD);
    const cost = Number(hash.split("$")[2]);
    expect(cost).toBeGreaterThanOrEqual(12);
  });

  it("verifies the correct password and rejects wrong ones", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("two hashes of the same password differ (salted)", async () => {
    const [a, b] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);
    expect(a).not.toBe(b);
    expect(await verifyPassword(PASSWORD, a)).toBe(true);
    expect(await verifyPassword(PASSWORD, b)).toBe(true);
  });

  it("hashes are compatible with raw bcrypt at cost 12 (interoperability)", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, hash)).toBe(true);
  });

  it("rejects malformed hashes without throwing", async () => {
    expect(await verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
    expect(await verifyPassword(PASSWORD, "")).toBe(false);
  });

  it("strength gate: ≥8 chars, letters + digit/symbol, ≥4 distinct chars", () => {
    expect(isStrongPassword(PASSWORD)).toBe(true);
    expect(isStrongPassword("short1!")).toBe(false); // 7 chars
    expect(isStrongPassword("alllettersonly")).toBe(false); // no digit/symbol
    expect(isStrongPassword("1234567890123")).toBe(false); // no letters
    expect(isStrongPassword("aaaaaaaaaaaa1!")).toBe(false); // repeated
  });
});

describe("Session JWT issue/verify (§9.1) — real next-auth encode/decode", () => {
  it("issues a token that decodes to the same claims", async () => {
    const token = await issueSessionToken({
      id: "user-123",
      displayName: "Detective",
      email: "d@example.com",
      isGuest: false,
    });
    const claims = await readSessionClaims(token);
    expect(claims).not.toBeNull();
    const user = sessionUserFromClaims(claims);
    expect(user).toEqual({
      id: "user-123",
      displayName: "Detective",
      email: "d@example.com",
      isGuest: false,
    });
  });

  it("rejects a forged (tampered) token", async () => {
    const token = await issueSessionToken({
      id: "user-123",
      displayName: "Detective",
      email: null,
      isGuest: false,
    });
    const forged = token.slice(0, -4) + "AAAA";
    expect(await readSessionClaims(forged)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "another-secret-entirely-xyz";
    const foreign = await issueSessionToken({
      id: "user-123",
      displayName: "Detective",
      email: null,
      isGuest: false,
    });
    process.env.AUTH_SECRET = original;
    expect(await readSessionClaims(foreign)).toBeNull();
  });

  it("rejects garbage input and empty values", async () => {
    expect(await readSessionClaims(undefined)).toBeNull();
    expect(await readSessionClaims(null)).toBeNull();
    expect(await readSessionClaims("garbage.token.value")).toBeNull();
    expect(await readSessionClaims("")).toBeNull();
  });

  it("guest claims round-trip with isGuest=true (guest foundation)", async () => {
    const token = await issueSessionToken({
      id: "guest-9",
      displayName: "Guest",
      email: null,
      isGuest: true,
    });
    const user = sessionUserFromClaims(await readSessionClaims(token));
    expect(user?.isGuest).toBe(true);
    expect(user?.email).toBeNull();
  });
});
