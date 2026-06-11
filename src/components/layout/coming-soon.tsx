import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  phase: string;
  description: string;
}

export function ComingSoon({ title, phase, description }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted text-sm mt-1">{description}</p>
      </div>
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <Construction className="h-12 w-12 text-accent mx-auto" />
          <div>
            <p className="font-medium">Coming in {phase}</p>
            <p className="text-sm text-muted mt-2 max-w-md mx-auto">
              This module is planned and will be built in an upcoming development phase.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
