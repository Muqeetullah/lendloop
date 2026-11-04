import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  hasNext,
  loading,
  previous,
  next,
  label,
}: {
  page: number;
  hasNext: boolean;
  loading: boolean;
  previous: () => void;
  next: () => void;
  label: string;
}) {
  if (page === 1 && !hasNext && !loading) return null;
  return (
    <nav className="pagination" aria-label={`${label} pagination`}>
      <Button
        variant="secondary"
        onClick={previous}
        disabled={page === 1 || loading}
      >
        Previous
      </Button>
      <span role="status" aria-live="polite">
        Page {page}
      </span>
      <Button variant="secondary" onClick={next} disabled={!hasNext || loading}>
        Next
      </Button>
    </nav>
  );
}
