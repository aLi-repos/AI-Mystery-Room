/**
 * Verification: investigation MVP — evidence validation (pure) + API
 * ownership/auth (MOCKED DB via in-memory fake Prisma).
 *
 * Security-critical rules tested for real:
 *  - upload size/format/category gates,
 *  - cross-user access returns 404 (no data leak),
 *  - unauthenticated requests are rejected,
 *  - evidence refs are validated against real uploads (anti-fabrication).
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./helpers/fakePrisma";

let db: FakeDb;
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => db,
  isDatabaseConfigured: () => true,
}));

import { GET as listInvestigations, POST as createInvestigation } from "@/app/api/investigations/route";
import {
  GET as getInvestigation,
  DELETE as deleteInvestigation,
} from "@/app/api/investigations/[id]/route";
import { POST as uploadEvidence } from "@/app/api/investigations/[id]/evidence/route";
import { DELETE as deleteEvidence } from "@/app/api/investigations/[id]/evidence/[evidenceId]/route";
import { POST as analyze } from "@/app/api/investigations/[id]/analyze/route";
import { issueSessionToken } from "@/lib/auth/session";
import { resetRateLimits } from "@/lib/auth/rateLimit";
import {
  checkUpload,
  clampText,
  inferCategory,
  planProcessing,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  type EvidenceCategory,
} from "@/lib/investigation/evidence";

const ORIGIN = "http://localhost:3000";

function jsonRequest(path: string, body: unknown, cookie?: string): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

async function cookieFor(userId: string): Promise<string> {
  const token = await issueSessionToken({
    id: userId,
    displayName: "Tester",
    email: "t@example.com",
    isGuest: false,
  });
  return `next-auth.session-token=${token}`;
}

// ---------------------------------------------------------------------------
// Pure evidence validation
// ---------------------------------------------------------------------------

describe("evidence validation (pure)", () => {
  it("infers categories from extension and mime", () => {
    expect(inferCategory("clip.mp4", "video/mp4")).toBe("video");
    expect(inferCategory("photo.JPEG", "image/jpeg")).toBe("image");
    expect(inferCategory("report.pdf", "application/pdf")).toBe("pdf");
    expect(inferCategory("notes.txt", "text/plain")).toBe("text");
    expect(inferCategory("rec.wav", "audio/wav")).toBe("audio");
    expect(inferCategory("blob.bin", "application/octet-stream")).toBeNull();
  });

  it("marks video as stored-but-NOT-analysed (no frame extraction)", () => {
    const plan = planProcessing("cctv.mp4", "video/mp4", 1000);
    expect(plan.category).toBe("video");
    expect(plan.mode).toBe("none");
    expect(plan.note).toMatch(/NOT analysed/);
  });

  it("marks unknown formats as not analysed", () => {
    const plan = planProcessing("x.bin", "application/octet-stream", 10);
    expect(plan.category).toBe("other");
    expect(plan.mode).toBe("none");
    expect(plan.note).toMatch(/NOT analysed/);
  });

  it("processes text as text, image/pdf/audio as inline", () => {
    expect(planProcessing("a.txt", "text/plain", 10).mode).toBe("text");
    expect(planProcessing("a.png", "image/png", 10).mode).toBe("inline");
    expect(planProcessing("a.pdf", "application/pdf", 10).mode).toBe("inline");
    expect(planProcessing("a.mp3", "audio/mpeg", 10).mode).toBe("inline");
  });

  it("rejects oversized files, empty files and unselected categories", () => {
    const base = { selected: ["text"] as EvidenceCategory[], currentFileCount: 0 };
    expect(
      checkUpload({ ...base, filename: "a.txt", mimeType: "text/plain", sizeBytes: 0 }).ok,
    ).toBe(false);
    expect(
      checkUpload({
        ...base,
        filename: "a.txt",
        mimeType: "text/plain",
        sizeBytes: MAX_FILE_BYTES + 1,
      }).ok,
    ).toBe(false);
    const rejected = checkUpload({
      ...base,
      filename: "a.png",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe("CATEGORY_NOT_SELECTED");
    expect(
      checkUpload({ ...base, filename: "a.txt", mimeType: "text/plain", sizeBytes: 100 }).ok,
    ).toBe(true);
  });

  it("enforces the per-investigation file cap", () => {
    expect(
      checkUpload({
        filename: "a.txt",
        mimeType: "text/plain",
        sizeBytes: 10,
        selected: ["text"],
        currentFileCount: 20,
      }).ok,
    ).toBe(false);
  });

  it("accepts focus categories and maps them to technical kinds", () => {
    // CCTV focus → video files allowed, text rejected
    const cctv = { selected: ["cctv"], currentFileCount: 0 };
    expect(
      checkUpload({ ...cctv, filename: "cam1.mp4", mimeType: "video/mp4", sizeBytes: 100 }).ok,
    ).toBe(true);
    expect(
      checkUpload({ ...cctv, filename: "a.txt", mimeType: "text/plain", sizeBytes: 100 }).ok,
    ).toBe(false);
    // Fingerprint/DNA have no extraction capability → stored as `other`
    const fp = { selected: ["fingerprint", "dna"], currentFileCount: 0 };
    expect(
      checkUpload({ ...fp, filename: "print.dat", mimeType: "application/octet-stream", sizeBytes: 100 }).ok,
    ).toBe(true);
    expect(
      checkUpload({ ...fp, filename: "a.txt", mimeType: "text/plain", sizeBytes: 100 }).ok,
    ).toBe(false);
    // Mixed legacy + focus selections
    expect(
      checkUpload({
        selected: ["text", "documents"],
        currentFileCount: 0,
        filename: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      }).ok,
    ).toBe(true);
  });

  it("clamps long text with an explicit truncation marker", () => {
    expect(clampText("short")).toBe("short");
    const long = clampText("x".repeat(MAX_TEXT_CHARS + 100));
    expect(long).toContain("[TRUNCATED");
    expect(long.length).toBeLessThan(MAX_TEXT_CHARS + 100);
  });
});

// ---------------------------------------------------------------------------
// API: auth + ownership (MOCKED DB)
// ---------------------------------------------------------------------------

describe("investigation API (MOCKED DB)", () => {
  beforeEach(async () => {
    db = createFakeDb();
    resetRateLimits();
    await db.user.create({
      data: { id: "11111111-1111-1111-1111-111111111111", displayName: "A" },
    });
    await db.user.create({
      data: { id: "22222222-2222-2222-2222-222222222222", displayName: "B" },
    });
  });

  const USER_A = "11111111-1111-1111-1111-111111111111";
  const USER_B = "22222222-2222-2222-2222-222222222222";

  async function createCase(cookie: string) {
    const res = await createInvestigation(
      jsonRequest("/api/investigations", {
        title: "Test case",
        caseDescription: "A warehouse was broken into at midnight.",
        categories: ["text", "image"],
      }, cookie),
    );
    expect(res.status).toBe(201);
    return (await res.json()).id as string;
  }

  it("rejects unauthenticated requests", async () => {
    const res = await listInvestigations(getRequest("/api/investigations"));
    expect(res.status).toBe(401);
  });

  it("creates and lists only the caller's investigations", async () => {
    const cookieA = await cookieFor(USER_A);
    const cookieB = await cookieFor(USER_B);
    const idA = await createCase(cookieA);
    expect(idA).toBeTruthy();

    const listA = await listInvestigations(getRequest("/api/investigations", cookieA));
    const bodyA = await listA.json();
    expect(bodyA.items).toHaveLength(1);

    const listB = await listInvestigations(getRequest("/api/investigations", cookieB));
    expect((await listB.json()).items).toHaveLength(0);
  });

  it("validates creation payload", async () => {
    const cookie = await cookieFor(USER_A);
    const res = await createInvestigation(
      jsonRequest("/api/investigations", { title: "x", caseDescription: "y", categories: [] }, cookie),
    );
    expect(res.status).toBe(400);
  });

  it("hides other users' investigations behind 404", async () => {
    const cookieA = await cookieFor(USER_A);
    const cookieB = await cookieFor(USER_B);
    const idA = await createCase(cookieA);

    const foreign = await getInvestigation(getRequest(`/api/investigations/${idA}`, cookieB), {
      params: Promise.resolve({ id: idA }),
    });
    expect(foreign.status).toBe(404);

    const own = await getInvestigation(getRequest(`/api/investigations/${idA}`, cookieA), {
      params: Promise.resolve({ id: idA }),
    });
    expect(own.status).toBe(200);
  });

  it("deletes only when owner", async () => {
    const cookieA = await cookieFor(USER_A);
    const cookieB = await cookieFor(USER_B);
    const idA = await createCase(cookieA);

    const foreignDelete = await deleteInvestigation(
      new NextRequest(`${ORIGIN}/api/investigations/${idA}`, { method: "DELETE", headers: { origin: ORIGIN, cookie: cookieB } }),
      { params: Promise.resolve({ id: idA }) },
    );
    expect(foreignDelete.status).toBe(404);
    expect(await db.investigation.count()).toBe(1);

    const ownDelete = await deleteInvestigation(
      new NextRequest(`${ORIGIN}/api/investigations/${idA}`, { method: "DELETE", headers: { origin: ORIGIN, cookie: cookieA } }),
      { params: Promise.resolve({ id: idA }) },
    );
    expect(ownDelete.status).toBe(200);
    expect(await db.investigation.count()).toBe(0);
  });

  it("uploads evidence with EV ref and category validation", async () => {
    const cookie = await cookieFor(USER_A);
    const id = await createCase(cookie);

    const file = new File(["hello world"], "notes.txt", { type: "text/plain" });
    const form = new FormData();
    form.append("file", file);
    const res = await uploadEvidence(
      new NextRequest(`${ORIGIN}/api/investigations/${id}/evidence`, {
        method: "POST",
        headers: { origin: ORIGIN, cookie },
        body: form,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.evidence.ref).toBe("EV1");
    expect(body.evidence.category).toBe("text");
    expect(body.evidence.status).toBe("stored");

    // Non-selected category is rejected.
    const png = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    // image IS selected in this case — use video instead (not selected).
    const mp4 = new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });
    const form2 = new FormData();
    form2.append("file", mp4);
    const res2 = await uploadEvidence(
      new NextRequest(`${ORIGIN}/api/investigations/${id}/evidence`, {
        method: "POST",
        headers: { origin: ORIGIN, cookie },
        body: form2,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res2.status).toBe(400);
    expect((await res2.json()).error.code).toBe("CATEGORY_NOT_SELECTED");
    void png;
  });

  it("stores video as unprocessed with an honest note", async () => {
    const cookie = await cookieFor(USER_A);
    // create with video selected
    const res = await createInvestigation(
      jsonRequest("/api/investigations", {
        title: "Video case",
        caseDescription: "CCTV coverage of the car park incident.",
        categories: ["video"],
      }, cookie),
    );
    const id = (await res.json()).id as string;

    const mp4 = new File([new Uint8Array([1, 2, 3, 4])], "cctv.mp4", { type: "video/mp4" });
    const form = new FormData();
    form.append("file", mp4);
    const upload = await uploadEvidence(
      new NextRequest(`${ORIGIN}/api/investigations/${id}/evidence`, {
        method: "POST",
        headers: { origin: ORIGIN, cookie },
        body: form,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(upload.status).toBe(201);
    const body = await upload.json();
    expect(body.evidence.status).toBe("unprocessed");
    expect(body.evidence.processNote).toMatch(/NOT analysed/);
  });

  it("deletes evidence when owner, 404 otherwise", async () => {
    const cookieA = await cookieFor(USER_A);
    const cookieB = await cookieFor(USER_B);
    const id = await createCase(cookieA);

    const file = new File(["data"], "a.txt", { type: "text/plain" });
    const form = new FormData();
    form.append("file", file);
    const upload = await uploadEvidence(
      new NextRequest(`${ORIGIN}/api/investigations/${id}/evidence`, {
        method: "POST",
        headers: { origin: ORIGIN, cookie: cookieA },
        body: form,
      }),
      { params: Promise.resolve({ id }) },
    );
    const evidenceId = (await upload.json()).evidence.id as string;

    const foreign = await deleteEvidence(
      new NextRequest(`${ORIGIN}/api/investigations/${id}/evidence/${evidenceId}`, {
        method: "DELETE",
        headers: { origin: ORIGIN, cookie: cookieB },
      }),
      { params: Promise.resolve({ id, evidenceId }) },
    );
    expect(foreign.status).toBe(404);

    const own = await deleteEvidence(
      new NextRequest(`${ORIGIN}/api/investigations/${id}/evidence/${evidenceId}`, {
        method: "DELETE",
        headers: { origin: ORIGIN, cookie: cookieA },
      }),
      { params: Promise.resolve({ id, evidenceId }) },
    );
    expect(own.status).toBe(200);
    expect(await db.evidence.count()).toBe(0);
  });

  it("analyzes without files and fails cleanly when AI is unavailable", async () => {
    const cookie = await cookieFor(USER_A);
    const id = await createCase(cookie);

    // Files are OPTIONAL: analysis runs from the story alone, but with AI
    // disabled (no AI_API_KEY in test env) it must honestly return 503 —
    // never fabricate findings.
    const empty = await analyze(
      jsonRequest(`/api/investigations/${id}/analyze`, {}, cookie),
      { params: Promise.resolve({ id }) },
    );
    expect(empty.status).toBe(503);
    expect((await empty.json()).error.code).toBe("AI_UNAVAILABLE");
    expect(await db.finding.count()).toBe(0); // nothing fabricated with no files

    // With evidence but AI disabled → 503, no fabricated findings
    const file = new File(["saw a man in black at 14:02"], "witness.txt", { type: "text/plain" });
    const form = new FormData();
    form.append("file", file);
    await uploadEvidence(
      new NextRequest(`${ORIGIN}/api/investigations/${id}/evidence`, {
        method: "POST",
        headers: { origin: ORIGIN, cookie },
        body: form,
      }),
      { params: Promise.resolve({ id }) },
    );

    const res = await analyze(
      jsonRequest(`/api/investigations/${id}/analyze`, {}, cookie),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("AI_UNAVAILABLE");
    expect(await db.finding.count()).toBe(0); // nothing fabricated
  });
});
