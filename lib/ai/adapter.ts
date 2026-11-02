import { z } from "zod";

export interface HintRequest {
  stageId: string;
  stageTitle: string;
  narrative: string;
  clues: string[];
  puzzlePrompt: string;
  level: 1 | 2 | 3;
  previousHints: string[];
}

export interface HintOutput {
  level: number;
  content: string;
  reasoning?: string;
}

const hintSchema = z.object({
  level: z.number(),
  content: z.string().max(60),
  reasoning: z.string().optional(),
});

export async function generateHint(req: HintRequest): Promise<HintOutput | null> {
  const key = process.env.AI_API_KEY;
  if (!key || process.env.AI_PROVIDER !== "gemini") {
    return null; // Degraded: rely on static fallback
  }
  try {
    const prompt = `You are a mystery-game assistant. Provide a progressive hint for level ${req.level}. Never reveal the answer. Stage: ${req.stageTitle}. Narrative: ${req.narrative}. Clues: ${req.clues.join(" | ")}. Puzzle: ${req.puzzlePrompt}. Previous hints: ${req.previousHints.join(" | ") || "none"}. Keep level ${req.level} concise.`;
    const res = await fetch(`${process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta"}/models/${process.env.AI_MODEL || "gemini-3.5-flash"}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: { type: "object", properties: { level: { type: "integer" }, content: { type: "string" }, reasoning: { type: "string" } }, required: ["content"] } } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = hintSchema.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
    return null;
  } catch {
    return null;
  }
}
