import { NextResponse } from "next/server";

export const FORBIDDEN_MESSAGE = "You do not have permission to perform this action.";

export function forbiddenJson() {
  return NextResponse.json({ message: FORBIDDEN_MESSAGE }, { status: 403 });
}

export function unauthorizedJson() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export function notFoundJson() {
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
