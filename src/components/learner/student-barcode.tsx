import { code39Svg } from "@/lib/code39";

export function StudentBarcode({ value }: { value: string }) {
  return (
    <div
      className="max-w-full overflow-x-auto rounded-lg border border-border bg-white p-3"
      dangerouslySetInnerHTML={{ __html: code39Svg(value) }}
    />
  );
}
