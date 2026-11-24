/**
 * Brønnøysundregisteret public API client (low-volume, ethical).
 * https://data.brreg.no/enhetsregisteret/api/docs/index.html
 */
const UA = "Oppslag/1.0 (+https://github.com/DicedPingu/oppslag; ethical low-volume directory)";

async function fetchJson(url, signal) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal,
  });
  if (!res.ok) throw new Error("Brreg " + res.status);
  return res.json();
}

function mapEnhet(e) {
  const addr = e.forretningsadresse || e.postadresse || {};
  const phone = e.telefon || e.mobil || "";
  return {
    id: "brreg-" + e.organisasjonsnummer,
    kind: "firm",
    name: e.navn || "",
    orgnr: e.organisasjonsnummer || "",
    phone: phone ? String(phone).replace(/\s/g, "") : "",
    postcode: addr.postnummer || "",
    place: addr.poststed || "",
    address: [addr.adresse, addr.postnummer, addr.poststed].filter(Boolean).join(", "),
    job: e.organisasjonsform?.beskrivelse || "",
    source: "brreg",
  };
}

async function searchFirms(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];

  if (/^\d{9}$/.test(q.replace(/\s/g, ""))) {
    try {
      const data = await fetchJson(
        `https://data.brreg.no/enhetsregisteret/api/enheter/${q.replace(/\s/g, "")}`,
        signal
      );
      return [mapEnhet(data)];
    } catch {
      return [];
    }
  }

  const usable = q
    .replace(/["*_]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 3)
    .join(" ");
  if (!usable) return [];

  const params = new URLSearchParams({
    navn: usable,
    size: "25",
  });

  try {
    const [enheter, under] = await Promise.all([
      fetchJson(`https://data.brreg.no/enhetsregisteret/api/enheter?${params}`, signal).catch(() => ({ _embedded: {} })),
      fetchJson(`https://data.brreg.no/enhetsregisteret/api/underenheter?${params}`, signal).catch(() => ({ _embedded: {} })),
    ]);

    const list = [
      ...(enheter._embedded?.enheter || []),
      ...(under._embedded?.underenheter || []),
    ];

    const mapped = list
      .filter((e) => !e.slettedato)
      .map(mapEnhet)
      .filter((e) => e.name);

    const seen = new Set();
    const withPhone = [];
    const without = [];
    for (const m of mapped) {
      if (seen.has(m.orgnr)) continue;
      seen.add(m.orgnr);
      if (m.phone) withPhone.push(m);
      else without.push(m);
    }
    return [...withPhone, ...without].slice(0, 12);
  } catch (err) {
    if (err.name === "AbortError") return [];
    console.warn("Brreg error", err);
    return [];
  }
}

window.OppslagBrreg = { searchFirms };
