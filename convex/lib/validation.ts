export function cleanText(value: string, field: string, maxLength: number) {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength)
    throw new Error(`Invalid ${field}`);
  return cleaned;
}

export function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
  );
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
