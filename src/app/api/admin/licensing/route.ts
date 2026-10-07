import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { buildLicensingPortfolio, type PortfolioFilter } from "@/lib/licensing/portfolio";
import { DEFAULT_PRICE_PER_LEARNER } from "@/lib/licensing/commercial";

const FILTERS: PortfolioFilter[] = [
  "all",
  "trial",
  "active",
  "grace",
  "expired",
  "suspended",
  "revoked",
  "trials_expiring_soon",
];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("filter") ?? "all";
  const filter = (FILTERS.includes(raw as PortfolioFilter) ? raw : "all") as PortfolioFilter;
  const portfolio = await buildLicensingPortfolio(filter);
  return NextResponse.json({
    ...portfolio,
    defaults: {
      suggestedPricePerLearner: DEFAULT_PRICE_PER_LEARNER.toString(),
      priceCurrency: "ZAR",
    },
  });
}
