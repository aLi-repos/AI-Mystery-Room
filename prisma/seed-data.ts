/**
 * The single MVP mystery (decision D4) — authored via the approved hybrid
 * method (decision D9): AI-assisted draft → human review & refinement →
 * seed script. This file is the reviewable source of truth; the seed script
 * writes it to the database idempotently.
 *
 * Content rules enforced by `validateMysteryData()` (§2C seed-time checks):
 *  - exactly five stages (D10), contiguous numbering, stage_count == rows,
 *  - at least three distinct puzzle types (AC13),
 *  - exactly three static hints (levels 1–3) and one answer key per stage,
 *  - no duplicate answers across stages,
 *  - answer-leakage scan (§9.6): no canonical answer in a stage's own
 *    narrative/prompt/clues, and no canonical answer (or long alias) in ANY
 *    hint text,
 *  - each answer's derivation is documented and mechanically spot-checked
 *    where possible (numeric codes must be constructible from clue digits).
 */

export type SeedPuzzleType =
  | "multiple_choice"
  | "text_input"
  | "numeric_code"
  | "cipher";

export type SeedClue = {
  clueNumber: number;
  content: string;
};

export type SeedHint = {
  level: 1 | 2 | 3;
  content: string;
};

export type SeedStage = {
  stageNumber: number;
  title: string;
  narrative: string;
  puzzleType: SeedPuzzleType;
  puzzlePrompt: string;
  puzzleOptions: string[] | null;
  explanation: string;
  /** Editorial proof that the answer follows from the stage's clues (§2C). */
  derivation: string;
  clues: SeedClue[];
  answer: {
    canonicalAnswer: string;
    acceptedAnswers: string[];
  };
  hints: SeedHint[];
};

export type SeedMystery = {
  title: string;
  tagline: string;
  setting: string;
  theme: string;
  stageCount: number;
  estimatedMinutes: number;
  supportedDifficulties: string[];
  source: "static";
  status: "published";
  stages: SeedStage[];
};

export class SeedValidationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Mystery seed validation failed:\n- ${problems.join("\n- ")}`);
    this.name = "SeedValidationError";
    this.problems = problems;
  }
}

// ---------------------------------------------------------------------------
// The mystery
// ---------------------------------------------------------------------------

export const MVP_MYSTERY: SeedMystery = {
  title: "The Vanishing at Blackwood Hall",
  tagline:
    "A stopped clock, a torn cipher, and a truth buried beneath the bell tower.",
  setting:
    "Blackwood Hall, an English manor house — the night of the winter solstice",
  theme: "Locked-room mystery",
  stageCount: 5,
  estimatedMinutes: 30,
  supportedDifficulties: ["easy", "medium", "hard"],
  source: "static",
  status: "published",
  stages: [
    {
      stageNumber: 1,
      title: "The Stopped Hall Clock",
      narrative:
        "Blackwood Hall smells of cold ash. You step into the entrance hall twenty minutes before midnight: curator Evelyn Marsh lies unconscious in the sealed observatory, and the great hall clock has stopped mid-tick. Three visitors sat in the hall this evening — each tells a different story about when they last heard it chime.",
      puzzleType: "multiple_choice",
      puzzlePrompt: "Whose account matches the stopped clock?",
      puzzleOptions: [
        "Miss Halloway (11:40)",
        "Dr. Ferris (11:52)",
        "Bram the cook (11:47)",
        "Mr. Reed (12:00)",
      ],
      explanation:
        "The clock froze at 11:47 — the moment the observatory's gas line was cut. Only Bram's account lands on that minute. Yet Bram had no key to the observatory: he saw the crime, he did not commit it. Follow what he saw.",
      derivation:
        "Clue 1 fixes the stopped time at 11:47; clue 2 lists each witness's claimed time; only Bram's claim equals 11:47, so option 3 is the single consistent account.",
      clues: [
        {
          clueNumber: 1,
          content:
            "The hall clock's hands are frozen at 11:47, its pendulum still.",
        },
        {
          clueNumber: 2,
          content:
            "Miss Halloway says she retired 'just before quarter to twelve'. Dr. Ferris swears the clock struck 11:52 as he crossed the hall. Bram the cook remembers it chiming 11:47 while he stirred the soup. Mr. Reed claims he heard a chime at midnight.",
        },
        {
          clueNumber: 3,
          content:
            "Evelyn's notebook lies open on the hall table: 'The clock does not lie. One of them is off by minutes — or by design.'",
        },
      ],
      answer: {
        canonicalAnswer: "bram the cook (11:47)",
        acceptedAnswers: ["bram the cook (11:47)", "bram", "3", "option 3"],
      },
      hints: [
        {
          level: 1,
          content:
            "Start with the one object in the hall that cannot embellish: the clock itself.",
        },
        {
          level: 2,
          content:
            "Line up each witness's claimed time against the minute frozen on the clock's face.",
        },
        {
          level: 3,
          content:
            "Exactly one account quotes the precise minute on the dial — that witness was in the hall when it stopped.",
        },
      ],
    },
    {
      stageNumber: 2,
      title: "The Torn Cipher",
      narrative:
        "Bram's statement holds — but his apron pocket holds something else: a corner torn from the guest book, inked in Evelyn's hand. A line of capitals, no signature, and a smear of soot. Whatever she wrote, she wrote it in a hurry, and she meant it to be read later.",
      puzzleType: "cipher",
      puzzlePrompt: "Decode the torn line. What did Evelyn write?",
      puzzleOptions: null,
      explanation:
        "Three steps back from EHOOWRZHU spells BELLTOWER — Evelyn's shift cipher, her 'little alphabet'. The bell tower is where she hid whatever she found in the observatory.",
      derivation:
        "Clues 2 and 3 state the shift rule (three steps forward to encode, so decode by shifting three back); applying it letter-by-letter to the ciphertext in clue 1 yields the nine-letter word BELLTOWER.",
      clues: [
        {
          clueNumber: 1,
          content: "The torn page reads exactly one line: EHOOWRZHU.",
        },
        {
          clueNumber: 2,
          content:
            "Pressed into the wax on the back of the page: 'Three steps forward — always forward — hides my little alphabet.'",
        },
        {
          clueNumber: 3,
          content:
            "Evelyn's diary, found in her satchel: 'I shift everything I fear by three. A becomes D. Remember that, if you are reading this.'",
        },
      ],
      answer: {
        canonicalAnswer: "belltower",
        acceptedAnswers: ["belltower", "bell tower", "bell-tower"],
      },
      hints: [
        {
          level: 1,
          content:
            "The alphabet here is not hidden — it is shifted. Read the rule Evelyn left in the wax.",
        },
        {
          level: 2,
          content:
            "Move every letter three places BACK from the ciphertext: E becomes B, H becomes E.",
        },
        {
          level: 3,
          content:
            "Decoded in order, the nine letters name a single place inside this house — read them as one word.",
        },
      ],
    },
    {
      stageNumber: 3,
      title: "The Belfry Dial",
      narrative:
        "The bell tower stair winds up through cold dust. On the landing sits Evelyn's strongbox, its face bearing a four-digit dial and a worn plaque: 'Rung in order.' Beside it, pinned to the wall, is tonight's bell ledger.",
      puzzleType: "numeric_code",
      puzzlePrompt:
        "Enter the four-digit dial code: each bell's ring-count, arranged in the order the bells rang tonight.",
      puzzleOptions: null,
      explanation:
        "The dial clicks open on 2-4-9-7: the tally of the third bell, then the first, then the fourth, then the second — the order they rang tonight. Inside: a brass key tagged with a single initial, and Evelyn's last letter — 'The truth is in the conservatory glass.'",
      derivation:
        "Clue 1 gives the four tallies (1st:4, 2nd:7, 3rd:2, 4th:9) and clue 2 gives the ringing order (third, first, fourth, second); reading tallies in that order produces 2,4,9,7 — every digit is present in the stage's clues, and no clue contains the sequence itself.",
      clues: [
        {
          clueNumber: 1,
          content:
            "The ledger lists each bell with tonight's tally: 1st bell — 4 rings; 2nd bell — 7 rings; 3rd bell — 2 rings; 4th bell — 9 rings.",
        },
        {
          clueNumber: 2,
          content:
            "A second column, in Evelyn's hand, marks the order the bells rang tonight: third, first, fourth, second.",
        },
        {
          clueNumber: 3,
          content:
            "The plaque's engraving is worn but legible: 'The dial wants what was rung, in the order it was rung.'",
        },
      ],
      answer: {
        canonicalAnswer: "2497",
        acceptedAnswers: ["2497"],
      },
      hints: [
        {
          level: 1,
          content:
            "The dial has four slots and the ledger has four bells — the order matters as much as the numbers.",
        },
        {
          level: 2,
          content:
            "Take each bell's tally, then read those tallies in the order Evelyn marked: third, first, fourth, second.",
        },
        {
          level: 3,
          content:
            "Start with the third bell's tally and follow Evelyn's marked order — the dial takes exactly those four digits, left to right.",
        },
      ],
    },
    {
      stageNumber: 4,
      title: "The Conservatory Riddle",
      narrative:
        "The brass key opens the conservatory. Moonlight lies across the glass roof, and on the potting bench a card is pinned beneath a folded, brittle sheet — Evelyn's hand again, addressed to whoever followed her this far.",
      puzzleType: "text_input",
      puzzlePrompt: "What am I? Answer with one word.",
      puzzleOptions: null,
      explanation:
        "A map — Evelyn's folded plan of the estate, with an X at the boathouse. She left a riddle only a patient reader would finish, because patience was the trait she needed in whoever came next.",
      derivation:
        "Clue 1 is a classical riddle whose properties (holds cities and roads, carries forests and rivers, drawn but never walk, folded) define a map; clue 2 confirms the object — a folded plan of the estate — is physically present on the bench; clue 3 requires the one-word name of that object.",
      clues: [
        {
          clueNumber: 1,
          content:
            "The card reads: 'I hold every city and every road, yet I have no houses. I carry forests and rivers, yet nothing living. I am drawn but never walk, folded but always with you. What am I?'",
        },
        {
          clueNumber: 2,
          content:
            "The folded sheet is a plan of the estate — its paper soft from handling, one corner marked with a dark X at the boathouse.",
        },
        {
          clueNumber: 3,
          content: "Under the card, in smaller ink: 'Answer with the thing itself, one word.'",
        },
      ],
      answer: {
        canonicalAnswer: "map",
        acceptedAnswers: ["map", "a map", "the map", "plan"],
      },
      hints: [
        {
          level: 1,
          content:
            "Evelyn's riddle describes something flat that shows the whole world without holding any of it.",
        },
        {
          level: 2,
          content:
            "You already have one in your hands — the folded estate sheet lying beside the card.",
        },
        {
          level: 3,
          content:
            "The answer is the common one-word name of that folded sheet — not what it is for, but what it is.",
        },
      ],
    },
    {
      stageNumber: 5,
      title: "The Boathouse Verdict",
      narrative:
        "The X on the estate plan leads to the boathouse. Under loose boards you find a soaked oilskin coat, its monogram half-worn: D. F. — and clipped inside, a page of the observatory's gas-line inspections, all signed off… except tonight's. Three people could have reached the observatory that night. Only one of them is lying.",
      puzzleType: "multiple_choice",
      puzzlePrompt: "Who sabotaged the observatory's gas line?",
      puzzleOptions: [
        "Miss Halloway",
        "Dr. Ferris",
        "Bram the cook",
        "Mr. Reed",
      ],
      explanation:
        "The chime died at 11:47, so nobody could have heard it strike 11:52 — the doctor's alibi was built on a sound that no longer existed. His monogrammed oilskin, hidden under the boathouse boards and reeking of gas, completes it: he cut the gas line, made Evelyn's collapse look like an accident, and moved her ledger here. Bram saw the hall; the doctor wanted the observatory's secrets — and Evelyn's — buried with her.",
      derivation:
        "Clue 1 states the chime stopped at 11:47; clue 2 records a claim of hearing the chime at 11:52, which is impossible — so the speaker lied; clue 3 ties that same person (the monogram matching the doctor introduced in stage 1) to the hidden coat at the boathouse. Option 2 is the only account contradicted by the physical evidence.",
      clues: [
        {
          clueNumber: 1,
          content:
            "The hall clock's chime mechanism died with it at 11:47 — no chime sounded in this house after that minute.",
        },
        {
          clueNumber: 2,
          content:
            "The doctor told the constable he 'heard the chime strike 11:52 while I was in the library' — a sound no one else claimed to hear.",
        },
        {
          clueNumber: 3,
          content:
            "The oilskin's monogram: D. F. The coat smells of gas and lake water, and it was hidden, not hung.",
        },
      ],
      answer: {
        canonicalAnswer: "dr. ferris",
        acceptedAnswers: ["dr. ferris", "dr ferris", "ferris", "2", "option 2"],
      },
      hints: [
        {
          level: 1,
          content:
            "Someone's timeline cannot be true — start with the claim about a sound that had already stopped.",
        },
        {
          level: 2,
          content:
            "The chime died at 11:47. Find the witness who swears they heard it later, then check what was found under the boathouse boards.",
        },
        {
          level: 3,
          content:
            "The doctor's alibi depends on a chime that could not have rung — and his monogrammed coat says he left the library for the lake.",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed-time validation (§2C / §9.6)
// ---------------------------------------------------------------------------

const ALLOWED_PUZZLE_TYPES: SeedPuzzleType[] = [
  "multiple_choice",
  "text_input",
  "numeric_code",
  "cipher",
];

function lower(value: string): string {
  return value.toLowerCase();
}

function stageText(stage: SeedStage): string {
  return [stage.narrative, stage.puzzlePrompt, ...stage.clues.map((c) => c.content)]
    .join("\n")
    .toLowerCase();
}

/**
 * Returns a list of problems; an empty array means the mystery is safe to
 * seed. Called by the seed script BEFORE any write and by the test suite.
 */
export function validateMysteryData(mystery: SeedMystery): string[] {
  const problems: string[] = [];

  // — mystery-level rules ---------------------------------------------------
  if (mystery.stageCount !== mystery.stages.length) {
    problems.push(
      `stage_count (${mystery.stageCount}) != number of stage rows (${mystery.stages.length})`,
    );
  }
  if (mystery.stageCount !== 5) {
    problems.push(`MVP mystery must have exactly 5 stages (D10), got ${mystery.stageCount}`);
  }
  if (mystery.source !== "static") {
    problems.push('MVP mystery source must be "static" (D5 defers ai)');
  }
  if (mystery.status !== "published") {
    problems.push('MVP mystery must be seeded as "published" (D4)');
  }
  const expectedDifficulties = ["easy", "medium", "hard"];
  if (
    mystery.supportedDifficulties.length !== expectedDifficulties.length ||
    !expectedDifficulties.every((d) => mystery.supportedDifficulties.includes(d))
  ) {
    problems.push("supportedDifficulties must be exactly easy/medium/hard (D11)");
  }

  const stageNumbers = mystery.stages.map((s) => s.stageNumber);
  stageNumbers.forEach((n, i) => {
    if (n !== i + 1) {
      problems.push(`stage numbers must be contiguous from 1 (found ${n} at position ${i + 1})`);
    }
  });

  const puzzleTypes = new Set(mystery.stages.map((s) => s.puzzleType));
  for (const type of puzzleTypes) {
    if (!ALLOWED_PUZZLE_TYPES.includes(type)) {
      problems.push(`unknown puzzle type: ${type}`);
    }
  }
  if (puzzleTypes.size < 3) {
    problems.push(`at least three distinct puzzle types required (AC13), got ${puzzleTypes.size}`);
  }

  // — answer rules ----------------------------------------------------------
  const seenAnswers = new Set<string>();
  for (const stage of mystery.stages) {
    const where = `stage ${stage.stageNumber}`;
    const canonical = lower(stage.answer.canonicalAnswer);

    if (!stage.answer.canonicalAnswer || stage.answer.canonicalAnswer.length > 200) {
      problems.push(`${where}: canonical answer must be 1–200 chars`);
    }
    if (stage.answer.canonicalAnswer !== canonical) {
      problems.push(`${where}: canonical answer must be stored lowercased (§6.2)`);
    }
    if (seenAnswers.has(canonical)) {
      problems.push(`${where}: duplicate answer "${canonical}" (§2C — no duplicate answers)`);
    }
    seenAnswers.add(canonical);

    if (!stage.answer.acceptedAnswers.map(lower).includes(canonical)) {
      problems.push(`${where}: accepted_answers must include canonical_answer (§6.2)`);
    }
    const accepted = stage.answer.acceptedAnswers;
    if (new Set(accepted).size !== accepted.length) {
      problems.push(`${where}: accepted_answers contains duplicates`);
    }
    if (accepted.some((a) => a !== lower(a))) {
      problems.push(`${where}: accepted_answers must be normalized/lowercase (§6.2)`);
    }

    if (stage.clues.length < 1) {
      problems.push(`${where}: at least one clue is required (§6.2)`);
    }
    stage.clues.forEach((clue, i) => {
      if (clue.clueNumber !== i + 1) {
        problems.push(`${where}: clue numbers must be contiguous from 1`);
      }
    });

    if (stage.puzzleType === "multiple_choice") {
      if (!Array.isArray(stage.puzzleOptions) || stage.puzzleOptions.length !== 4) {
        problems.push(`${where}: multiple_choice requires a 4-item puzzle_options array (§6.2)`);
      }
    } else if (stage.puzzleOptions !== null) {
      problems.push(`${where}: only multiple_choice stages may carry puzzle_options`);
    }

    if (!stage.derivation || stage.derivation.trim().length < 40) {
      problems.push(`${where}: missing/insufficient answer derivation (§2C)`);
    }

    // numeric codes must be constructible from digits present in the stage text
    if (stage.puzzleType === "numeric_code") {
      const text = stageText(stage);
      for (const digit of new Set(canonical.replace(/\D/g, ""))) {
        if (!text.includes(digit)) {
          problems.push(`${where}: digit "${digit}" of the answer never appears in clues`);
        }
      }
      if (text.includes(canonical)) {
        problems.push(`${where}: canonical answer appears verbatim in the puzzle text`);
      }
    }

    // leakage guard (§9.6): canonical answer must not appear in the text the
    // player reads BEFORE solving (narrative/prompt/clues; options excluded
    // because multiple-choice lists the candidates by design; explanation is
    // post-solve only).
    if (stageText(stage).includes(canonical)) {
      problems.push(`${where}: canonical answer leaks into narrative/prompt/clues (§9.6)`);
    }

    // hints: exactly 3 levels, no leakage of ANY answer (§9.6)
    const levels = stage.hints.map((h) => h.level).sort();
    if (stage.hints.length !== 3 || levels[0] !== 1 || levels[1] !== 2 || levels[2] !== 3) {
      problems.push(`${where}: must seed exactly 3 static hints at levels 1, 2, 3 (§2D)`);
    }
    if (stage.hints.some((h) => h.content.trim().length < 20)) {
      problems.push(`${where}: every static hint must be substantive (≥ 20 chars)`);
    }
  }

  // cross-stage hint leakage: no hint anywhere may contain any canonical
  // answer or any alias of 5+ characters (§9.6 / AC14).
  const leakTargets = new Set<string>();
  for (const stage of mystery.stages) {
    leakTargets.add(lower(stage.answer.canonicalAnswer));
    for (const alias of stage.answer.acceptedAnswers) {
      if (alias.length >= 5) leakTargets.add(lower(alias));
    }
  }
  for (const stage of mystery.stages) {
    for (const hint of stage.hints) {
      const haystack = lower(hint.content);
      for (const target of leakTargets) {
        if (haystack.includes(target)) {
          problems.push(
            `stage ${stage.stageNumber} hint level ${hint.level}: leaks answer "${target}" (§9.6)`,
          );
        }
      }
    }
  }

  return problems;
}
