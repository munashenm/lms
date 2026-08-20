export function scoreExamResponse(opts: {
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  correctAnswer?: string | null;
  points: number;
  response: string;
}): { isCorrect: boolean | null; pointsAwarded: number } {
  const response = opts.response.trim();
  const expected = opts.correctAnswer?.trim() ?? "";
  if (!response) return { isCorrect: false, pointsAwarded: 0 };

  if (opts.type === "SHORT_ANSWER" && !expected) {
    return { isCorrect: null, pointsAwarded: 0 };
  }

  const ok = response.toLowerCase() === expected.toLowerCase();
  return { isCorrect: ok, pointsAwarded: ok ? opts.points : 0 };
}

export function publicExamQuestion<T extends { correctAnswer?: string | null }>(
  question: T
): Omit<T, "correctAnswer"> {
  const { correctAnswer: _hidden, ...rest } = question;
  return rest;
}

export function examTimeRemainingMs(opts: {
  startedAt: Date | string;
  durationMinutes?: number | null;
  now?: Date;
}): number | null {
  if (!opts.durationMinutes || opts.durationMinutes <= 0) return null;
  const started = new Date(opts.startedAt).getTime();
  const ends = started + opts.durationMinutes * 60 * 1000;
  return Math.max(0, ends - (opts.now ?? new Date()).getTime());
}
