import { VisitorBookScreen } from "@/components/visitors/visitor-book-screen";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default function AdminVisitorsPage({ searchParams }: PageProps) {
  return <VisitorBookScreen searchParams={searchParams} />;
}
