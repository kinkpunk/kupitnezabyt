export type ExportedUserData<TData extends Record<string, unknown>> = {
  schemaVersion: 1;
  exportedAt: string;
  data: TData;
};

export function normalizeSearchQuery(value: string, maxLength = 80): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

export function createUserDataExport<TData extends Record<string, unknown>>(input: {
  exportedAt: Date;
  data: TData;
}): ExportedUserData<TData> {
  return {
    schemaVersion: 1,
    exportedAt: input.exportedAt.toISOString(),
    data: input.data
  };
}
