/** Paddle catalog price id for a pack: DB column, then ROM_PADDLE_PRICE_<PACK_ID> env. */
export function resolvePaddlePriceId(packId: string, paddlePriceIdFromDb: string | null | undefined): string | null {
  const fromDb = (paddlePriceIdFromDb ?? "").trim();
  if (fromDb) return fromDb;
  const envKey = `ROM_PADDLE_PRICE_${packId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const fromEnv = (process.env[envKey] ?? "").trim();
  return fromEnv || null;
}
