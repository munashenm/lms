import Link from "next/link";
import { cn } from "@/lib/utils";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
}

interface ChildFilterProps {
  children: Child[];
  selectedId?: string;
  basePath: string;
}

export function ChildFilter({ children, selectedId, basePath }: ChildFilterProps) {
  if (children.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={basePath}
        className={cn(
          "rounded-full px-3 py-1 text-sm border transition-colors",
          !selectedId
            ? "bg-primary text-white border-primary"
            : "border-border text-muted hover:border-primary/50"
        )}
      >
        All children
      </Link>
      {children.map((child) => (
        <Link
          key={child.id}
          href={`${basePath}?studentId=${child.id}`}
          className={cn(
            "rounded-full px-3 py-1 text-sm border transition-colors",
            selectedId === child.id
              ? "bg-primary text-white border-primary"
              : "border-border text-muted hover:border-primary/50"
          )}
        >
          {child.firstName} {child.lastName}
        </Link>
      ))}
    </div>
  );
}
