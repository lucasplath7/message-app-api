const formatMeta = (meta?: unknown): string => {
  if (!meta) return "";
  if (meta instanceof Error)
    return ` ${meta.message}${meta.stack ? `\n${meta.stack}` : ""}`;
  try {
    return ` ${JSON.stringify(meta, Object.getOwnPropertyNames(meta))}`;
  } catch {
    return ` ${String(meta)}`;
  }
};

export const logger = {
  info(message: string, meta?: unknown) {
    console.log(`[INFO] ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: unknown) {
    console.error(`[ERROR] ${message}${formatMeta(meta)}`);
  }
};
