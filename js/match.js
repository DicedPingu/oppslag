/**
 * Oppslag match engine – pure JS, no deps.
 * Supports: *, _, "exact", nicknames, spelling fold, band ranking.
 * _ = exactly one character, * = zero or more characters.
 */

const NICKNAMES = {
  william: ["bill", "will", "willy"],
  bill: ["william", "will"],
  john: ["johnny", "jonny", "jon", "jack"],
  johnny: ["john", "jonny", "jon"],
  robert: ["bob", "rob", "bobby"],
  bob: ["robert", "rob"],
  richard: ["rick", "dick", "rich"],
  elizabeth: ["liz", "beth", "betty", "eliza"],
  alexander: ["alex", "xander"],
  alex: ["alexander"],
  catherine: ["cathy", "kate", "katy", "kathryn"],
  kathryn: ["kate", "cathy", "catherine"],
  christopher: ["chris", "kit"],
  chris: ["christopher"],
  michael: ["mike", "mick"],
  mike: ["michael"],
  james: ["jim", "jimmy", "jamie"],
  jim: ["james"],
  thomas: ["tom", "tommy"],
  tom: ["thomas"],
  margaret: ["maggie", "meg", "peggy"],
  victoria: ["vicky", "vikki"],
  viktoria: ["vicky", "vikki"],
};

function looseFold(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "aa")
    .replace(/c/g, "k")
    .replace(/w/g, "v")
    .replace(/ph/g, "f")
    .replace(/(.)\1+/g, "$1");
}

function nicknameSet(token) {
  const f = looseFold(token);
  const set = new Set([f]);
  if (NICKNAMES[f]) NICKNAMES[f].forEach((n) => set.add(looseFold(n)));
  for (const [k, vals] of Object.entries(NICKNAMES)) {
    if (vals.includes(f) || vals.map(looseFold).includes(f)) {
      set.add(k);
      vals.forEach((v) => set.add(looseFold(v)));
    }
  }
  return set;
}

function tokenize(query) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(query.trim())) !== null) {
    if (m[1] !== undefined) {
      tokens.push({ raw: m[1], exact: true, type: "text" });
    } else {
      const raw = m[2];
      const hasWild = /[*_]/.test(raw);
      const isDigitish = /^[\d*_\s\-]+$/.test(raw) && /\d/.test(raw);
      tokens.push({ raw, exact: false, type: isDigitish ? "digit" : "text", hasWild });
    }
  }
  return tokens;
}

function patternToRegExp(pat, exact) {
  if (exact) return new RegExp("^" + escapeRegExp(pat) + "$", "i");
  let s = "";
  for (const ch of pat) {
    if (ch === "*") s += ".*";
    else if (ch === "_") s += ".";
    else s += escapeRegExp(ch);
  }
  if (!/[*_]/.test(pat) && pat.length <= 2) return new RegExp("^" + s, "i");
  return new RegExp("^" + s + "$", "i");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scorePart(queryTok, candidate) {
  const q = queryTok.raw;
  const c = candidate || "";
  const qFold = looseFold(q);
  const cFold = looseFold(c);
  if (q.toLowerCase() === c.toLowerCase()) return { band: "exact", reason: "exact" };
  if (queryTok.exact) {
    if (q.toLowerCase() === c.toLowerCase()) return { band: "exact", reason: "exact" };
    return null;
  }
  if (queryTok.type === "digit") {
    const digitsC = c.replace(/\D/g, "");
    if (!digitsC) return null;
    const re = patternToRegExp(q.replace(/\s/g, ""), false);
    if (re.test(c) || re.test(digitsC)) {
      if (!/[*_]/.test(q) && q.replace(/\D/g, "") === digitsC) return { band: "exact", reason: "exact" };
      return { band: "near", reason: "wildcard" };
    }
    if (digitsC.includes(q.replace(/\D/g, "").replace(/[*_]/g, "")) && q.replace(/\D/g, "").length >= 3)
      return { band: "loose", reason: "prefix" };
    return null;
  }
  if (queryTok.hasWild) {
    const re = patternToRegExp(q, false);
    if (re.test(c) || re.test(cFold)) return { band: "near", reason: "wildcard" };
    return null;
  }
  if (q.length <= 2 && cFold.startsWith(qFold)) return { band: "near", reason: "prefix" };
  if (qFold === cFold) return { band: "near", reason: "spelling" };
  const nicks = nicknameSet(q);
  if (nicks.has(cFold)) return { band: "near", reason: "nickname" };
  if (cFold.startsWith(qFold) && qFold.length >= 3) return { band: "loose", reason: "prefix" };
  if (cFold.includes(qFold) && qFold.length >= 4) return { band: "loose", reason: "contains" };
  return null;
}

function bandRank(b) {
  return { exact: 0, near: 1, loose: 2 }[b] ?? 3;
}

function matchEntry(query, entry) {
  const tokens = tokenize(query);
  if (!tokens.length) return null;
  const nameParts = (entry.name || "").split(/\s+/).filter(Boolean);
  const fields = {
    name: nameParts,
    post: entry.postcode ? [String(entry.postcode)] : [],
    phone: entry.phone ? [String(entry.phone).replace(/\s/g, "")] : [],
    place: entry.place ? [entry.place] : [],
    job: entry.job ? [entry.job] : [],
    address: entry.address ? [entry.address] : [],
  };
  let worst = "exact";
  const used = new Set();
  const reasons = [];
  for (const tok of tokens) {
    if (tok.raw === "*" && !tok.exact) {
      let skipped = false;
      for (let i = 0; i < nameParts.length; i++) {
        if (!used.has("n" + i)) {
          used.add("n" + i);
          reasons.push("wildcard");
          if (bandRank("near") > bandRank(worst)) worst = "near";
          skipped = true;
          break;
        }
      }
      if (!skipped) {
        reasons.push("wildcard");
        if (bandRank("loose") > bandRank(worst)) worst = "loose";
      }
      continue;
    }
    let best = null;
    let bestIdx = -1;
    let bestField = null;
    for (let i = 0; i < nameParts.length; i++) {
      if (used.has("n" + i)) continue;
      const sc = scorePart(tok, nameParts[i]);
      if (sc && (!best || bandRank(sc.band) < bandRank(best.band))) {
        best = sc; bestIdx = i; bestField = "name";
      }
    }
    const order = tok.type === "digit" ? ["post", "phone", "place", "address", "job"] : ["place", "job", "address", "post", "phone"];
    for (const f of order) {
      for (let i = 0; i < fields[f].length; i++) {
        const key = f + i;
        if (used.has(key)) continue;
        const sc = scorePart(tok, fields[f][i]);
        if (sc && (!best || bandRank(sc.band) < bandRank(best.band))) {
          best = sc; bestIdx = i; bestField = f;
        }
      }
    }
    if (!best) return null;
    if (bandRank(best.band) > bandRank(worst)) worst = best.band;
    reasons.push(best.reason);
    if (bestField === "name") used.add("n" + bestIdx);
    else used.add(bestField + bestIdx);
  }
  return { band: worst, reasons };
}

function searchEntries(query, entries) {
  const hits = [];
  for (const e of entries) {
    const m = matchEntry(query, e);
    if (m) hits.push({ ...e, band: m.band, reasons: m.reasons });
  }
  hits.sort((a, b) => {
    const br = bandRank(a.band) - bandRank(b.band);
    if (br !== 0) return br;
    const pa = a.kind === "person" ? 0 : 1;
    const pb = b.kind === "person" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.name || "").localeCompare(b.name || "", "nb");
  });
  return hits;
}

function groupHits(hits) {
  const groups = { exact: [], near: [], loose: [] };
  for (const h of hits) groups[h.band]?.push(h);
  return groups;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { searchEntries, groupHits, matchEntry, tokenize, looseFold, nicknameSet, scorePart };
} else {
  window.OppslagMatch = { searchEntries, groupHits, matchEntry, tokenize, looseFold };
}
