import { describe, expect, it } from "vitest";
import { examTimeRemainingMs, publicExamQuestion, scoreExamResponse } from "@/lib/online-exams";

describe("online exams", () => {
  it("scores multiple-choice and true/false answers case-insensitively", () => {
    expect(
      scoreExamResponse({
        type: "MULTIPLE_CHOICE",
        correctAnswer: "B",
        points: 5,
        response: "b",
      })
    ).toEqual({ isCorrect: true, pointsAwarded: 5 });
    expect(
      scoreExamResponse({
        type: "TRUE_FALSE",
        correctAnswer: "True",
        points: 2,
        response: "False",
      })
    ).toEqual({ isCorrect: false, pointsAwarded: 0 });
  });

  it("leaves short answers unmarked when no expected answer is stored", () => {
    expect(
      scoreExamResponse({
        type: "SHORT_ANSWER",
        correctAnswer: null,
        points: 3,
        response: "photosynthesis",
      })
    ).toEqual({ isCorrect: null, pointsAwarded: 0 });
  });

  it("awards zero for a blank response", () => {
    expect(
      scoreExamResponse({
        type: "MULTIPLE_CHOICE",
        correctAnswer: "A",
        points: 1,
        response: "   ",
      })
    ).toEqual({ isCorrect: false, pointsAwarded: 0 });
  });

  it("strips the correct answer before sending a question to a learner", () => {
    const publicQuestion = publicExamQuestion({
      id: "q1",
      prompt: "2 + 2?",
      correctAnswer: "4",
      points: 1,
    });
    expect(publicQuestion).toEqual({ id: "q1", prompt: "2 + 2?", points: 1 });
    expect("correctAnswer" in publicQuestion).toBe(false);
  });

  it("returns remaining time and clamps to zero after the window", () => {
    const startedAt = "2026-08-20T10:00:00.000Z";
    expect(examTimeRemainingMs({ startedAt, durationMinutes: null })).toBeNull();
    expect(
      examTimeRemainingMs({
        startedAt,
        durationMinutes: 30,
        now: new Date("2026-08-20T10:10:00.000Z"),
      })
    ).toBe(20 * 60 * 1000);
    expect(
      examTimeRemainingMs({
        startedAt,
        durationMinutes: 30,
        now: new Date("2026-08-20T11:00:00.000Z"),
      })
    ).toBe(0);
  });
});
