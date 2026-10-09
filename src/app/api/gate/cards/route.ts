import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSchoolPermission } from "@/lib/gate/access";
import { issueCardSchema } from "@/lib/gate/schema";
import { issueAccessCard } from "@/lib/gate/cards";
import { searchGatePeople } from "@/lib/gate/queries";

export async function GET(request: NextRequest) {
  const auth = await requireSchoolPermission("cards:manage");
  if ("error" in auth) return auth.error;
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const people = await searchGatePeople(auth.schoolId, q);
  const studentIds = people.map((person) => person.studentId).filter((id): id is string => Boolean(id));
  const userIds = people.map((person) => person.userId).filter((id): id is string => Boolean(id));
  const employeeIds = people.map((person) => person.employeeId).filter((id): id is string => Boolean(id));
  const cardFilters = [
    ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
    ...(userIds.length ? [{ userId: { in: userIds } }] : []),
    ...(employeeIds.length ? [{ employeeId: { in: employeeIds } }] : []),
  ];
  const cards = cardFilters.length
    ? await prisma.accessCard.findMany({
        where: { schoolId: auth.schoolId, status: "ACTIVE", OR: cardFilters },
        select: { id: true, studentId: true, userId: true, employeeId: true, status: true, issuedAt: true },
      })
    : [];
  return NextResponse.json({
    people: people.map((person) => {
      const card = cards.find(
        (item) =>
          (person.studentId && item.studentId === person.studentId) ||
          (person.employeeId && item.employeeId === person.employeeId) ||
          (person.userId && item.userId === person.userId)
      );
      return {
        ...person,
        cardId: card?.id ?? null,
        cardStatus: card?.status ?? "NONE",
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSchoolPermission("cards:manage");
  if ("error" in auth) return auth.error;
  const parsed = issueCardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const issued = await issueAccessCard({
    schoolId: auth.schoolId,
    actorId: auth.session.userId,
    holderType: parsed.data.holderType,
    studentId: parsed.data.studentId,
    userId: parsed.data.userId,
    employeeId: parsed.data.employeeId,
  });
  if (!issued.ok) return NextResponse.json({ message: issued.message }, { status: 404 });
  return NextResponse.json(issued, { status: 201 });
}
