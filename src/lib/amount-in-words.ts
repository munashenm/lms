const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function chunkToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const rest = n % 10;
    return TENS[Math.floor(n / 10)] + (rest ? `-${ONES[rest]}` : "");
  }
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${chunkToWords(rest)}` : ""}`;
}

/** South African Rand amount in words, e.g. "one thousand two hundred rand and 50 cents". */
export function amountInWordsZar(amount: number): string {
  const centsTotal = Math.round(Math.abs(amount) * 100);
  const rand = Math.floor(centsTotal / 100);
  const cents = centsTotal % 100;
  if (rand === 0 && cents === 0) return "zero rand";

  const parts: string[] = [];
  const millions = Math.floor(rand / 1_000_000);
  const thousands = Math.floor((rand % 1_000_000) / 1000);
  const remainder = rand % 1000;

  if (millions) parts.push(`${chunkToWords(millions)} million`);
  if (thousands) parts.push(`${chunkToWords(thousands)} thousand`);
  if (remainder) parts.push(chunkToWords(remainder));

  const randWords = rand === 0 ? "zero rand" : `${parts.join(" ")} rand`;
  if (cents === 0) return randWords;
  return `${randWords} and ${String(cents).padStart(2, "0")} cents`;
}
