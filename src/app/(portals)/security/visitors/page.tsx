import { VisitorBookScreen } from "@/components/visitors/visitor-book-screen";

interface PageProps {
  searchParams: Promise<{ date?: string; q?: string }>;
}

export default function SecurityVisitorsPage({ searchParams }: PageProps) {
  return <VisitorBookScreen searchParams={searchParams} />;
}
