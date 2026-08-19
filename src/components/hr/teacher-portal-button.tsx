"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TeacherPortalButton({
  teacherId,
  email,
  linked,
}: {
  teacherId: string;
  email: string | null;
  linked: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function invite() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitePortal: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not send invite");
        return;
      }
      if (json.provision?.invitesSent) {
        toast.success(linked ? "Password setup email sent." : "Teacher portal invited. Password setup email sent.");
      } else if (json.provision?.skipped) {
        toast.error("Add a unique email before inviting this teacher.");
      } else {
        toast.success("Teacher login is already linked.");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={loading || !email}
      onClick={invite}
    >
      {linked ? "Resend invite" : "Set up portal"}
    </Button>
  );
}
