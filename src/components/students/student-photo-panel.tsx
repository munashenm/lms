"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { STUDENT_PHOTO_ACCEPT, postMultipart } from "@/lib/registration-docs";

export function StudentPhotoPanel({
  studentId,
  photoUrl,
  firstName,
  lastName,
  canWrite,
  identityCardLabel,
}: {
  studentId: string;
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  canWrite: boolean;
  identityCardLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const file = new FormData(form).get("photo");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose a photo to upload");
      setLoading(false);
      return;
    }
    try {
      const result = await postMultipart(`/api/students/${studentId}/photo`, { photo: file });
      if (!result.ok) throw new Error(result.message);
      toast.success("Photo saved. It is used on the identity card.");
      form.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identity photo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 rounded-lg">
            {photoUrl ? <AvatarImage src={photoUrl} alt="" className="rounded-lg object-cover" /> : null}
            <AvatarFallback className="rounded-lg">
              {getInitials(firstName, lastName)}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm text-muted">
            This photo is printed on the {identityCardLabel.toLowerCase()}.
          </p>
        </div>
        {canWrite ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="student-photo">Upload photo</Label>
              <Input
                id="student-photo"
                name="photo"
                type="file"
                accept={STUDENT_PHOTO_ACCEPT}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted">JPG, PNG or WebP. Max 5 MB.</p>
            </div>
            <Button type="submit" disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save photo"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
