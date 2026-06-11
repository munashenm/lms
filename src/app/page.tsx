import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLE_DASHBOARD } from "@/lib/constants";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_DASHBOARD[session.role]);
  }
  redirect("/login");
}
