import { NextResponse } from "next/server";

export const FORBIDDEN_MESSAGE = "You do not have permission to perform this action.";

export function forbiddenJson() {
  return NextResponse.json({ message: FORBIDDEN_MESSAGE }, { status: 403 });
}
