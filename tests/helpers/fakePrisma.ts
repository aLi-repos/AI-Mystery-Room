/**
 * In-memory fake Prisma client for unit tests.
 *
 * ⚠ MOCKED DATABASE — no PostgreSQL is required (or used) by these tests.
 * Only the query shapes actually used by the P2 code paths are implemented;
 * every suite that injects this fake is labelled "mocked DB" in its title.
 *
 * Real-DB behaviour (constraint enforcement, migration application) is NOT
 * covered here — see the P2 report for the mocked-vs-real matrix.
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

/** Projects a row onto a `select` shape (top-level keys only). */
function pick(row: Row, select: Row): Row {
  const out: Row = {};
  for (const key of Object.keys(select)) {
    if (select[key]) out[key] = row[key];
  }
  return out;
}

/** `pick` + Prisma's `_count: { select: {...} }` nested shape. */
function withCount(row: Row, select: Row, tables: Record<string, Row[]>): Row {
  const out = pick(row, select);
  if (select._count) {
    const countSelect = select._count as Row;
    const counts: Row = {};
    for (const rel of Object.keys(countSelect)) {
      if (!countSelect[rel]) continue;
      counts[rel] = tables[rel === "evidence" ? "evidence" : rel === "findings" ? "finding" : rel]
        ?.filter((r) => r.investigationId === row.id).length ?? 0;
    }
    out._count = counts;
  }
  return out;
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    // Composite unique syntax: { mysteryId_stageNumber: {...} }
    if (key.includes("_") && typeof condition === "object" && condition !== null) {
      if (!matches(row, condition as Row)) return false;
      continue;
    }
    if (typeof condition === "object" && condition !== null && !(condition instanceof Date)) {
      const cond = condition as Row;
      if ("not" in cond) {
        if (row[key] === cond.not) return false;
        continue;
      }
      throw new Error(`FakePrisma: unsupported operator for ${key}`);
    }
    if (row[key] !== condition) return false;
  }
  return true;
}

export type FakeDb = ReturnType<typeof createFakeDb>;

export function createFakeDb() {
  const tables: Record<string, Row[]> = {
    user: [],
    mystery: [],
    stage: [],
    clue: [],
    stageAnswer: [],
    hint: [],
    gameSession: [],
    investigation: [],
    evidence: [],
    finding: [],
  };

  function insert(table: string, data: Row): Row {
    const row: Row = {
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    };
    tables[table].push(row);
    return row;
  }

  function findFirst(table: string, args: { where?: Row } = {}): Row | null {
    return tables[table].find((row) => matches(row, args.where)) ?? null;
  }

  const user = {
    findFirst: async (args: { where?: Row } = {}) => findFirst("user", args),
    findUnique: async (args: { where: Row }) =>
      args.where.id !== undefined
        ? tables.user.find((row) => row.id === args.where.id) ?? null
        : findFirst("user", { where: args.where }),
    create: async (args: { data: Row }) => insert("user", args.data),
    update: async (args: { where: Row; data: Row }) => {
      const row = await user.findUnique({ where: args.where });
      if (!row) throw new Error("FakePrisma: record not found for update");
      Object.assign(row, args.data);
      return row;
    },
  };

  const mystery = {
    findMany: async (args: { where?: Row; orderBy?: Row; take?: number } = {}) => {
      let rows = tables.mystery.filter((row) => matches(row, args.where));
      if (args.orderBy?.createdAt === "asc") {
        rows = [...rows].sort(
          (a, b) =>
            (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime(),
        );
      }
      return args.take ? rows.slice(0, args.take) : rows;
    },
    findFirst: async (args: { where?: Row } = {}) => findFirst("mystery", args),
    findUnique: async (args: { where: Row }) => findFirst("mystery", args),
    create: async (args: { data: Row }) => insert("mystery", args.data),
    findUniqueOrThrow: async (args: { where: Row }) => {
      const row = findFirst("mystery", args);
      if (!row) throw new Error("FakePrisma: mystery not found");
      return row;
    },
    upsert: async (args: {
      where: Row;
      update: Row;
      create: Row;
    }): Promise<Row> => {
      const existing = findFirst("mystery", { where: args.where });
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      return insert("mystery", args.create);
    },
  };

  const stage = {
    upsert: async (args: { where: Row; update: Row; create: Row }): Promise<Row> => {
      const existing = findFirst("stage", { where: args.where });
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      return insert("stage", args.create);
    },
    findMany: async (
      args: { where?: Row; orderBy?: Row; include?: Row } = {},
    ): Promise<Row[]> => {
      const rows = tables.stage
        .filter((row) => matches(row, args.where))
        .map((row) => {
          const withIncludes: Row = { ...row };
          if (args.include?.hints) {
            withIncludes.hints = tables.hint.filter(
              (hint) => hint.stageId === row.id,
            );
          }
          if (args.include?.clues) {
            withIncludes.clues = tables.clue.filter(
              (clue) => clue.stageId === row.id,
            );
          }
          if (args.include?.answer) {
            withIncludes.answer =
              tables.stageAnswer.find((answer) => answer.stageId === row.id) ??
              null;
          }
          return withIncludes;
        });
      if (args.orderBy?.stageNumber === "asc") {
        rows.sort(
          (a, b) => (a.stageNumber as number) - (b.stageNumber as number),
        );
      }
      return rows;
    },
  };

  const clue = {
    findMany: async () => tables.clue,
    upsert: async (args: { where: Row; update: Row; create: Row }): Promise<Row> => {
      const existing = findFirst("clue", { where: args.where });
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      return insert("clue", args.create);
    },
  };

  const stageAnswer = {
    findMany: async () => tables.stageAnswer,
    upsert: async (args: { where: Row; update: Row; create: Row }): Promise<Row> => {
      const existing = findFirst("stageAnswer", { where: args.where });
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      return insert("stageAnswer", args.create);
    },
  };

  const hint = {
    findMany: async () => tables.hint,
    upsert: async (args: { where: Row; update: Row; create: Row }): Promise<Row> => {
      const existing = findFirst("hint", { where: args.where });
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      return insert("hint", args.create);
    },
  };

  const gameSession = {
    groupBy: async (args: {
      by: string[];
      where?: Row;
      _max?: Record<string, boolean>;
    }) => {
      const rows = tables.gameSession.filter((row) => matches(row, args.where));
      const grouped = new Map<unknown, Row[]>();
      for (const row of rows) {
        const key = args.by.map((column) => row[column]).join("|");
        const bucket = grouped.get(key) ?? [];
        bucket.push(row);
        grouped.set(key, bucket);
      }
      return [...grouped.entries()].map(([key, bucket]) => {
        const out: Row = {};
        args.by.forEach((column, i) => {
          out[column] = (key as string).split("|")[i];
        });
        const maxima: Row = {};
        for (const aggregate of Object.keys(args._max ?? {})) {
          const scores = bucket
            .map((row) => row[aggregate] as number | null)
            .filter((value): value is number => typeof value === "number");
          maxima[aggregate] = scores.length ? Math.max(...scores) : null;
        }
        // Real Prisma nests aggregates under `_max` / `_sum` / etc.
        out._max = maxima;
        return out;
      });
    },
    create: async (args: { data: Row }) => insert("gameSession", args.data),
    count: async (args: { where?: Row } = {}) =>
      tables.gameSession.filter((row) => matches(row, args.where)).length,
  };

  const investigation = {
    findMany: async (
      args: { where?: Row; orderBy?: Row; take?: number; select?: Row } = {},
    ) => {
      let rows = tables.investigation.filter((row) => matches(row, args.where));
      if (args.orderBy?.createdAt === "desc") {
        rows = [...rows].sort(
          (a, b) =>
            (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
        );
      }
      if (args.take) rows = rows.slice(0, args.take);
      return args.select
        ? rows.map((r) => withCount(r, args.select!, tables))
        : rows;
    },
    findFirst: async (args: { where?: Row; select?: Row } = {}) => {
      const row = findFirst("investigation", args);
      return row && args.select ? pick(row, args.select) : row;
    },
    findUnique: async (args: { where: Row }) => findFirst("investigation", args),
    create: async (args: { data: Row; select?: Row }) => {
      const row = insert("investigation", {
        qaHistory: [],
        report: null,
        reportGeneratedAt: null,
        ...args.data,
      });
      return args.select ? pick(row, args.select) : row;
    },
    update: async (args: { where: Row; data: Row }) => {
      const row = findFirst("investigation", { where: args.where });
      if (!row) throw new Error("FakePrisma: investigation not found");
      Object.assign(row, args.data);
      return row;
    },
    delete: async (args: { where: Row }) => {
      const idx = tables.investigation.findIndex((r) => matches(r, args.where));
      if (idx === -1) throw new Error("FakePrisma: investigation not found");
      const [row] = tables.investigation.splice(idx, 1);
      // Cascade: evidence + findings
      for (const t of ["evidence", "finding"]) {
        for (let i = tables[t].length - 1; i >= 0; i--) {
          if (tables[t][i]!.investigationId === row!.id) tables[t].splice(i, 1);
        }
      }
      return row;
    },
    count: async (args: { where?: Row } = {}) =>
      tables.investigation.filter((row) => matches(row, args.where)).length,
  };

  const evidence = {
    findMany: async (args: { where?: Row; orderBy?: Row; select?: Row } = {}) => {
      let rows = tables.evidence.filter((row) => matches(row, args.where));
      if (args.orderBy?.createdAt === "asc") {
        rows = [...rows].sort(
          (a, b) =>
            (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime(),
        );
      }
      return args.select ? rows.map((r) => pick(r, args.select!)) : rows;
    },
    findFirst: async (args: { where?: Row; select?: Row } = {}) => {
      const row = findFirst("evidence", args);
      return row && args.select ? pick(row, args.select) : row;
    },
    create: async (args: { data: Row; select?: Row }) => {
      const row = insert("evidence", args.data);
      return args.select ? pick(row, args.select) : row;
    },
    delete: async (args: { where: Row }) => {
      const idx = tables.evidence.findIndex((r) => matches(r, args.where));
      if (idx === -1) throw new Error("FakePrisma: evidence not found");
      const [row] = tables.evidence.splice(idx, 1);
      return row;
    },
    count: async (args: { where?: Row } = {}) =>
      tables.evidence.filter((row) => matches(row, args.where)).length,
    updateMany: async (args: { where?: Row; data: Row }) => {
      const rows = tables.evidence.filter((row) => matches(row, args.where));
      for (const row of rows) Object.assign(row, args.data);
      return { count: rows.length };
    },
  };

  const finding = {
    findMany: async (args: { where?: Row; orderBy?: Row; select?: Row } = {}) => {
      let rows = tables.finding.filter((row) => matches(row, args.where));
      if (args.orderBy?.createdAt === "asc") {
        rows = [...rows].sort(
          (a, b) =>
            (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime(),
        );
      }
      return args.select ? rows.map((r) => pick(r, args.select!)) : rows;
    },
    create: async (args: { data: Row }) => insert("finding", args.data),
    createMany: async (args: { data: Row[] }) => {
      for (const data of args.data) insert("finding", data);
      return { count: args.data.length };
    },
    deleteMany: async (args: { where?: Row }) => {
      const before = tables.finding.length;
      tables.finding = tables.finding.filter((row) => !matches(row, args.where));
      return { count: before - tables.finding.length };
    },
    count: async (args: { where?: Row } = {}) =>
      tables.finding.filter((row) => matches(row, args.where)).length,
  };

  const client = {
    user,
    mystery,
    stage,
    clue,
    stageAnswer,
    hint,
    gameSession,
    investigation,
    evidence,
    finding,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn(client),
    // Raw probe used by /api/health — mocked as "database reachable".
    $queryRaw: async () => [{ "?column?": 1 }],
  };

  return client;
}
