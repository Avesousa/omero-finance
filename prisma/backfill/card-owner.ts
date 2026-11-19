type Candidate = { id: string; name: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Ambiguous names deliberately fall back to the finance owner. */
export function assignCardOwner(
  card: { name: string; ownerName: string | null }, users: Candidate[], fallback: string,
): { userId: string; rule: "ownerName" | "cardName" | "financeOwner" } {
  const ownerName = normalize(card.ownerName ?? "");
  const byOwner = users.filter((u) => ownerName && [normalize(u.name), normalize(u.name).split(/\s+/)[0]].includes(ownerName));
  if (byOwner.length === 1) return { userId: byOwner[0].id, rule: "ownerName" };
  if (byOwner.length > 1) return { userId: fallback, rule: "financeOwner" };
  const words = normalize(card.name).split(/[^\p{L}\p{N}]+/u);
  const byName = users.filter((u) => words.includes(normalize(u.name).split(/\s+/)[0]));
  return byName.length === 1
    ? { userId: byName[0].id, rule: "cardName" }
    : { userId: fallback, rule: "financeOwner" };
}

