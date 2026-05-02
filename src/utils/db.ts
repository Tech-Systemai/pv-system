type DbOperation = 'insert' | 'update' | 'delete' | 'upsert';

export async function dbOp(
  table: string,
  operation: DbOperation,
  data?: Record<string, any> | Record<string, any>[],
  filters?: Record<string, any>,
  select?: string
): Promise<{ data: any[] | null; error: string | null }> {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, operation, data, filters, select }),
  });
  const json = await res.json();
  if (!res.ok) return { data: null, error: json.error || 'Unknown error' };
  return { data: json.data, error: null };
}
