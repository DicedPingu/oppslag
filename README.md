# Oppslag

Norsk telefonkatalog – enkel, offline-først, mobilvennlig.

**TL;DR for nye brukere**

```bash
# Kjør lokalt (kun statiske filer, ingen build nødvendig)
npx serve .          # eller python -m http.server 8080
# Åpne http://localhost:8080
```

- Søk: navn, nummer, postnummer, `*`, `_`, hermetegn for eksakt.
- `_` = nøyaktig ett tegn, `*` = null eller flere tegn.
- Victoria finner også Viktoria (forsiktig stavingsfold).
- Johnny D* finner Johnny David …
- Offline-bok: søk lagres automatisk, legg til egne kontakter.
- Bedrifter: live fra Brønnøysundregisteret (offentlig API).
- 3 temaer (papir / natt / kart) via hjørne-meny.
- PWA – legg til på hjemskjerm (Android / iOS).

Ingen scraping av 1881/Gule Sider. Kun offentlig Brreg + din egen bok.

## Funksjoner (forbedringer)

1. **Smart matcher** – wildcard `*`/`_`, sitater, kallenavn (Bill→William), stavingsfold (c/k, æ/ae …), band (eksakt / nær / løst).
2. **Offline-first** – localStorage-bok, auto-lagring av treff med telefon, manuell legg-til/fjern.
3. **Brreg-integrasjon** – enheter + underenheter, prioritert med telefon, dedupe.
4. **Rent design** – symmetriske kort, diskrete band-farger, 44 px touch-mål, hjørne-popup.
5. **PWA + Android-klar** – manifest, service worker, installbar.
6. **GitHub Actions** – lint + test + build på push/PR.

## Utvikling

```bash
# Matcher-tester (Node, ingen deps)
node test/match.test.js

# Statisk server
npx serve -p 8080 .
```

## Etikk

Følger phone-book-number-getter: lavt volum, ærlig User-Agent, Brreg offentlig API, ingen bulk-scrape.
