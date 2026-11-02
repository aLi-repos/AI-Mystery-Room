/**
 * Verification: §7.1 auth endpoints + §9 security rules.
 *
 * MOCKED DB (in-memory fake Prisma client) — the user store is fake, but
 * everything security-critical is REAL:
 *  - bcrypt hashing at cost 12 (real bcryptjs),
 *  - session JWT encode/decode via next-auth's real `encode`/`decode`
 *    signed with AUTH_SECRET,
 *  - Zod validation, error envelopes, cookie flags, rate limiting.
 * Real-DB-only behaviour (unique index races, CHECK constraints) is covered
 * by the migration file + schema tests, not here.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./helpers/fakePrisma";

// ---------------------------------------------------------------------------
// Mock the Prisma module BEFORE importing route handlers
// ---------------------------------------------------------------------------
let db: FakeDb;
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => db,
  isDatabaseConfigured: () => true,
}));

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as guest } from "@/app/api/auth/guest/route";
import { POST as upgradeGuest } from "@/app/api/auth/upgrade-guest/route";
import { GET as listMysteries } from "@/app/api/mysteries/route";
import { GET as mysteryDetail } from "@/app/api/mysteries/[id]/route";
import { hashPassword } from "@/lib/auth/password";
import { issueSessionToken } from "@/lib/auth/session";
import { resetRateLimits } from "@/lib/auth/rateLimit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGIN = "http://localhost:3000";

function jsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, { headers: { origin: ORIGIN, ...headers } });
}

function sessionCookie(response: Response): string | undefined {
  const cookies = response.headers.getSetCookie();
  const raw = cookies.find((cookie) => cookie.startsWith("next-auth.session-token="));
  return raw?.split(";")[0]?.split("=").slice(1).join("=");
}

async function registerUser(
  email = "detective@example.com",
  password = "Holmes-1895!",
  displayName = "Detective",
): Promise<{ token: string | undefined; id: string }> {
  const response = await register(
    jsonRequest("/api/auth/register", { email, password, displayName }),
  );
  const body = (await response.json()) as { user: { id: string } };
  return { token: sessionCookie(response), id: body.user.id };
}

async function createGuest(): Promise<{ token: string | undefined; id: string }> {
  const response = await guest(jsonRequest("/api/auth/guest", {}));
  const body = (await response.json()) as { user: { id: string } };
  return { token: sessionCookie(response), id: body.user.id };
}

const VALID_PASSWORD = "Holmes-1895!";

beforeEach(() => {
  db = createFakeDb();
  resetRateLimits();
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("POST /api/auth/register (mocked DB, real bcrypt/JWT)", () => {
  it("201 + user payload + HTTP-only session cookie", async () => {
    const response = await register(
      jsonRequest("/api/auth/register", {
        email: "Detective@Example.com",
        password: VALID_PASSWORD,
        displayName: "Detective",
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      user: { id: string; email: string; displayName: string };
    };
    expect(body.user.email).toBe("detective@example.com"); // normalized lowercase
    expect(body.user.displayName).toBe("Detective");
    expect(body.user).not.toHaveProperty("password");
    expect(body.user).not.toHaveProperty("passwordHash");

    const cookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("next-auth.session-token="));
    expect(cookie).toBeTruthy();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Path=/");

    // The stored row carries a bcrypt hash — never the plaintext.
    const row = await db.user.findFirst({ where: { email: "detective@example.com" } });
    expect(row?.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(String(row?.passwordHash)).not.toContain(VALID_PASSWORD);
  });

  it("stores the bcrypt hash at cost ≥ 12 (§9.2)", async () => {
    await registerUser();
    const row = await db.user.findFirst();
    const hash = String(row?.passwordHash);
    expect(hash).toMatch(/^\$2[aby]\$1[2-9]\$/); // cost 12+ embedded in hash
  });

  it("409 EMAIL_TAKEN for a duplicate e-mail (case-insensitive)", async () => {
    await registerUser("detective@example.com");
    const response = await register(
      jsonRequest("/api/auth/register", {
        email: "DETECTIVE@example.com",
        password: VALID_PASSWORD,
        displayName: "Impostor",
      }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("EMAIL_TAKEN");
  });

  it("400 VALIDATION for weak password, bad e-mail, short display name", async () => {
    const cases = [
      { email: "a@b.co", password: "short", displayName: "X" },
      { email: "not-an-email", password: VALID_PASSWORD, displayName: "X" },
      { email: "a@b.co", password: VALID_PASSWORD, displayName: "" },
    ];
    for (const payload of cases) {
      const response = await register(jsonRequest("/api/auth/register", payload));
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION");
    }
  });

  it("403 on cross-origin request (CSRF defence, §9.1)", async () => {
    const response = await register(
      jsonRequest(
        "/api/auth/register",
        { email: "a@b.co", password: VALID_PASSWORD, displayName: "X" },
        { origin: "https://evil.example.net" },
      ),
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe("POST /api/auth/login (mocked DB)", () => {
  it("200 + session cookie for valid credentials; hash is verified, not compared as text", async () => {
    const { id } = await registerUser();

    const response = await login(
      jsonRequest("/api/auth/login", {
        email: "detective@example.com",
        password: VALID_PASSWORD,
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).toBe(id);
    expect(sessionCookie(response)).toBeTruthy();
  });

  it("401 INVALID_CREDENTIALS for wrong password (generic message)", async () => {
    await registerUser();
    const response = await login(
      jsonRequest("/api/auth/login", {
        email: "detective@example.com",
        password: "Wrong-Password-1!",
      }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
    expect(body.error.message).toBe("Invalid email or password");
  });

  it("401 for unknown e-mail — identical to wrong password (no oracle)", async () => {
    const unknown = await login(
      jsonRequest("/api/auth/login", {
        email: "nobody@example.com",
        password: VALID_PASSWORD,
      }),
    );
    await registerUser();
    const wrongPassword = await login(
      jsonRequest("/api/auth/login", {
        email: "detective@example.com",
        password: "Wrong-Password-1!",
      }),
    );

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    const a = (await unknown.json()) as { error: { code: string } };
    const b = (await wrongPassword.json()) as { error: { code: string } };
    expect(a.error.code).toBe(b.error.code);
  });

  it("guest accounts cannot log in with a password", async () => {
    await createGuest();
    const response = await login(
      jsonRequest("/api/auth/login", {
        email: "guest@example.com",
        password: VALID_PASSWORD,
      }),
    );
    expect(response.status).toBe(401);
  });

  it("429 TOO_MANY_REQUESTS with Retry-After after 10 attempts / 15 min / IP (§9.5)", async () => {
    let last: Response | undefined;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      last = await login(
        jsonRequest("/api/auth/login", {
          email: "detective@example.com",
          password: `wrong-${attempt}-pad!`,
        }),
      );
    }
    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = (await last?.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

// ---------------------------------------------------------------------------
// Logout + session verification (/me)
// ---------------------------------------------------------------------------

describe("POST /api/auth/logout + GET /api/auth/me (mocked DB)", () => {
  it("logout returns 204 and clears the session cookie", async () => {
    const { token } = await registerUser();
    const response = await logout(
      jsonRequest("/api/auth/logout", {}, { cookie: `next-auth.session-token=${token}` }),
    );
    expect(response.status).toBe(204);
    const cleared = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("next-auth.session-token="));
    expect(cleared).toContain("Max-Age=0");
  });

  it("me returns 200 with the user for a valid session", async () => {
    const { token, id } = await registerUser();
    const response = await me(
      getRequest("/api/auth/me", { cookie: `next-auth.session-token=${token}` }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { id: string; email: string; isGuest: boolean };
    };
    expect(body.user.id).toBe(id);
    expect(body.user.email).toBe("detective@example.com");
    expect(body.user.isGuest).toBe(false);
  });

  it("me returns 401 without a session cookie", async () => {
    const response = await me(getRequest("/api/auth/me"));
    expect(response.status).toBe(401);
  });

  it("me returns 401 for a forged/tampered token", async () => {
    const { token } = await registerUser();
    const tampered = `${token!.slice(0, -4)}AAAA`;
    const response = await me(
      getRequest("/api/auth/me", { cookie: `next-auth.session-token=${tampered}` }),
    );
    expect(response.status).toBe(401);
  });

  it("me returns 401 after logout (cookie cleared client-side)", async () => {
    await registerUser();
    const response = await me(getRequest("/api/auth/me")); // no cookie sent
    expect(response.status).toBe(401);
  });

  it("me returns 401 for a token signed with a different secret", async () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "an-entirely-different-secret-value";
    const foreignToken = await issueSessionToken({
      id: "someone-else",
      displayName: "Impostor",
      email: null,
      isGuest: false,
    });
    process.env.AUTH_SECRET = original;

    const response = await me(
      getRequest("/api/auth/me", { cookie: `next-auth.session-token=${foreignToken}` }),
    );
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Guest mode
// ---------------------------------------------------------------------------

describe("POST /api/auth/guest + upgrade (mocked DB)", () => {
  it("201 creates an is_guest user with NO e-mail and NO password", async () => {
    const response = await guest(jsonRequest("/api/auth/guest", {}));
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      user: { email: string | null; isGuest: boolean };
    };
    expect(body.user.isGuest).toBe(true);
    expect(body.user.email).toBeNull();

    const row = await db.user.findFirst({ where: { isGuest: true } });
    expect(row?.passwordHash).toBeNull();
    expect(row?.email).toBeNull();
    expect(row?.guestExpiresAt).toBeInstanceOf(Date);
  });

  it("accepts an optional display name", async () => {
    const response = await guest(
      jsonRequest("/api/auth/guest", { displayName: "Night Owl" }),
    );
    const body = (await response.json()) as { user: { displayName: string } };
    expect(body.user.displayName).toBe("Night Owl");
  });

  it("guest isolation: guest session sees only itself via /me", async () => {
    const { id: registeredId } = await registerUser();
    const guestUser = await createGuest();
    const response = await me(
      getRequest("/api/auth/me", {
        cookie: `next-auth.session-token=${guestUser.token}`,
      }),
    );
    const body = (await response.json()) as { user: { id: string; isGuest: boolean } };
    expect(body.user.id).toBe(guestUser.id);
    expect(body.user.id).not.toBe(registeredId);
    expect(body.user.isGuest).toBe(true);
  });

  it("upgrade-guest requires a session (401)", async () => {
    const response = await upgradeGuest(
      jsonRequest("/api/auth/upgrade-guest", {
        email: "kept@example.com",
        password: VALID_PASSWORD,
      }),
    );
    expect(response.status).toBe(401);
  });

  it("upgrade-guest upgrades the SESSION'S OWN account and persists progress", async () => {
    const guestUser = await createGuest();
    // Simulate stored guest progress (P3 will do this for real).
    const mysteryId = "11111111-1111-4111-8111-111111111111";
    db.mystery.create({
      data: { id: mysteryId, title: "T", tagline: "", setting: "", theme: "" },
    });
    db.gameSession.create({
      data: {
        userId: guestUser.id,
        mysteryId,
        status: "completed",
        totalScore: 900,
      },
    });

    const response = await upgradeGuest(
      jsonRequest(
        "/api/auth/upgrade-guest",
        { email: "kept@example.com", password: VALID_PASSWORD },
        { cookie: `next-auth.session-token=${guestUser.token}` },
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { id: string; email: string; isGuest: boolean };
    };
    expect(body.user.id).toBe(guestUser.id); // SAME row — progress kept
    expect(body.user.email).toBe("kept@example.com");
    expect(body.user.isGuest).toBe(false);

    // Session cookie re-issued as a registered user.
    expect(sessionCookie(response)).toBeTruthy();

    // Guest progress survived the upgrade (isolation + continuity).
    const sessions = await db.gameSession.count({ where: { userId: guestUser.id } });
    expect(sessions).toBe(1);

    // Password is now a real hash.
    const row = await db.user.findUnique({ where: { id: guestUser.id } });
    expect(String(row?.passwordHash)).toMatch(/^\$2[aby]\$/);
    expect(row?.guestExpiresAt).toBeNull();
  });

  it("upgrade-guest: 409 NOT_GUEST when a registered account tries", async () => {
    const { token } = await registerUser();
    const response = await upgradeGuest(
      jsonRequest(
        "/api/auth/upgrade-guest",
        { email: "another@example.com", password: VALID_PASSWORD },
        { cookie: `next-auth.session-token=${token}` },
      ),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_GUEST");
  });

  it("upgrade-guest: 409 EMAIL_TAKEN when the e-mail belongs to another account", async () => {
    await registerUser("taken@example.com");
    const guestUser = await createGuest();
    const response = await upgradeGuest(
      jsonRequest(
        "/api/auth/upgrade-guest",
        { email: "taken@example.com", password: VALID_PASSWORD },
        { cookie: `next-auth.session-token=${guestUser.token}` },
      ),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("EMAIL_TAKEN");
  });

  it("an upgraded guest can log in with the new credentials; other accounts cannot", async () => {
    const guestUser = await createGuest();
    await upgradeGuest(
      jsonRequest(
        "/api/auth/upgrade-guest",
        { email: "kept@example.com", password: VALID_PASSWORD },
        { cookie: `next-auth.session-token=${guestUser.token}` },
      ),
    );

    const loginAsUpgraded = await login(
      jsonRequest("/api/auth/login", {
        email: "kept@example.com",
        password: VALID_PASSWORD,
      }),
    );
    expect(loginAsUpgraded.status).toBe(200);

    const impostor = await login(
      jsonRequest("/api/auth/login", {
        email: "kept@example.com",
        password: "Some-Other-Pass1!",
      }),
    );
    expect(impostor.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Library endpoints (§7.3) — session required, ownership isolation
// ---------------------------------------------------------------------------

describe("GET /api/mysteries + /:id (mocked DB)", () => {
  it("401 without a session", async () => {
    expect((await listMysteries(getRequest("/api/mysteries"))).status).toBe(401);
    expect(
      (await mysteryDetail(getRequest("/api/mysteries/x"), {
        params: Promise.resolve({ id: "x" }),
      })).status,
    ).toBe(401);
  });

  it("returns only the caller's own bestScoreByMe (ownership isolation, §9.4)", async () => {
    const me1 = await registerUser("one@example.com");
    const other = await registerUser("two@example.com", "Other-Pass-1!", "Two");
    const mysteryId = "22222222-2222-4222-8222-222222222222";
    db.mystery.create({
      data: {
        id: mysteryId,
        title: "Test Mystery",
        tagline: "t",
        setting: "s",
        theme: "th",
        status: "published",
        stageCount: 5,
        estimatedMinutes: 30,
        supportedDifficulties: ["easy", "medium", "hard"],
      },
    });
    db.gameSession.create({
      data: { userId: other.id, mysteryId, status: "completed", totalScore: 1000 },
    });
    db.gameSession.create({
      data: { userId: me1.id, mysteryId, status: "completed", totalScore: 650 },
    });

    const response = await listMysteries(
      getRequest("/api/mysteries", {
        cookie: `next-auth.session-token=${me1.token}`,
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ id: string; stageCount: number; bestScoreByMe: number | null }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].stageCount).toBe(5);
    // Sees OWN best score (650), never the other player's (1000).
    expect(body.items[0].bestScoreByMe).toBe(650);
  });

  it("detail endpoint exposes difficulty profiles and never stage/answer content (§9.6)", async () => {
    const user = await registerUser();
    const mysteryId = "33333333-3333-4333-8333-333333333333";
    db.mystery.create({
      data: {
        id: mysteryId,
        title: "Test Mystery",
        tagline: "t",
        setting: "s",
        theme: "th",
        status: "published",
        stageCount: 5,
        estimatedMinutes: 30,
        supportedDifficulties: ["easy", "medium", "hard"],
      },
    });

    const response = await mysteryDetail(
      getRequest(`/api/mysteries/${mysteryId}`, {
        cookie: `next-auth.session-token=${user.token}`,
      }),
      { params: Promise.resolve({ id: mysteryId }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown> & {
      difficultyProfiles: Record<string, { timeLimitSeconds: number }>;
    };
    expect(body.difficultyProfiles.easy.timeLimitSeconds).toBe(20 * 60);
    expect(body.difficultyProfiles.hard.timeLimitSeconds).toBe(45 * 60);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("canonicalAnswer");
    expect(serialized).not.toContain("acceptedAnswers");
    expect(serialized).not.toContain("puzzlePrompt");
  });

  it("400 for a malformed id, 404 for an unknown id", async () => {
    const user = await registerUser();
    const auth = { cookie: `next-auth.session-token=${user.token}` };
    const bad = await mysteryDetail(getRequest("/api/mysteries/nope", auth), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(bad.status).toBe(400);

    const missing = await mysteryDetail(
      getRequest(
        "/api/mysteries/44444444-4444-4444-8444-444444444444",
        auth,
      ),
      { params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }) },
    );
    expect(missing.status).toBe(404);
  });
});
