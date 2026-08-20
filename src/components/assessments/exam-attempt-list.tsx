import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export type ExamAttemptRow = {
  studentName: string;
  studentNumber: string;
  status: string;
  score: number | null;
  startedAt: Date | string;
  submittedAt: Date | string | null;
};

export function ExamAttemptList({
  maxMarks,
  attempts,
}: {
  maxMarks: number;
  attempts: ExamAttemptRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Online sittings</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {attempts.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">No learner has started this paper yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Learner</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={`${attempt.studentNumber}-${attempt.startedAt}`} className="border-t">
                    <td className="px-4 py-2">
                      {attempt.studentName}
                      <span className="block text-xs text-muted">{attempt.studentNumber}</span>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={attempt.status === "SUBMITTED" ? "success" : "secondary"}>
                        {attempt.status === "SUBMITTED" ? "Submitted" : "In progress"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {attempt.score != null ? `${attempt.score} / ${maxMarks}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {formatDate(attempt.startedAt)}
                      {attempt.submittedAt ? ` · submitted ${formatDate(attempt.submittedAt)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
