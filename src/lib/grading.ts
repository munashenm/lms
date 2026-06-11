/**
 * South African CAPS/NSC grade symbol calculation
 * Level 1–7 scale used in FET phase report cards
 */

export function percentageToSymbol(percentage: number): string {
  if (percentage >= 80) return "7";
  if (percentage >= 70) return "6";
  if (percentage >= 60) return "5";
  if (percentage >= 50) return "4";
  if (percentage >= 40) return "3";
  if (percentage >= 30) return "2";
  return "1";
}

export function symbolLabel(symbol: string): string {
  const labels: Record<string, string> = {
    "7": "Outstanding Achievement",
    "6": "Meritorious Achievement",
    "5": "Substantial Achievement",
    "4": "Adequate Achievement",
    "3": "Moderate Achievement",
    "2": "Elementary Achievement",
    "1": "Not Achieved",
  };
  return labels[symbol] ?? symbol;
}

export function calculatePercentage(score: number, maxMarks: number): number {
  if (maxMarks <= 0) return 0;
  return Math.round((score / maxMarks) * 10000) / 100;
}

export function calculateWeightedAverage(
  marks: { score: number; maxMarks: number; weight?: number | null }[]
): number {
  if (marks.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const m of marks) {
    const pct = calculatePercentage(m.score, m.maxMarks);
    const weight = m.weight ?? 1;
    weightedSum += pct * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}
