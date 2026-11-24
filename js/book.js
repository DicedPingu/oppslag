/**
 * Offline book – localStorage persistence.
 */
const KEY = "oppslag-book-v1";

const DEFAULT_EXAMPLES = [
  { id: "ex-1", kind: "person", name: "Victoria Berg", phone: "90000001", postcode: "0150", place: "Oslo", job: "Designer", source: "example" },
  { id: "ex-2", kind: "person", name: "Viktoria Nilsen", phone: "90000002", postcode: "5003", place: "Bergen", job: "Lærer", source: "example" },
  { id: "ex-3", kind: "person", name: "Johnny David Hauge", phone: "90000003", postcode: "7010", place: "Trondheim", source: "example" },
  { id: "ex-4", kind: "person", name: "Johnny Dale Olsen", phone: "90000004", postcode: "8001", place: "Bodø", source: "example" },
  { id: "ex-5", kind: "person", name: "Maria Elise Lie", phone: "90000005", postcode: "0683", place: "Oslo", source: "example" },
  { id: "ex-6", kind: "person", name: "Karen Sofie Hansen", phone: "90000006", postcode: "0583", place: "Oslo", source: "example" },
  { id: "ex-7", kind: "person", name: "Kari Anne Berg", phone: "90000007", postcode: "0150", place: "Oslo", source: "example" },
  { id: "ex-8", kind: "person", name: "William Hansen", phone: "90000008", postcode: "2000", place: "Lillestrøm", source: "example" },
  { id: "ex-9", kind: "person", name: "Bill Andersen", phone: "90000009", postcode: "3015", place: "Drammen", source: "example" },
  { id: "ex-10", kind: "person", name: "Svein Morten Pedersen", phone: "90000010", postcode: "0683", place: "Oslo", job: "Ingeniør", source: "example" },
];

function loadBook() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { entries: [], hiddenIds: [], theme: "papir", showExamples: true };
    const data = JSON.parse(raw);
    return {
      entries: Array.isArray(data.entries) ? data.entries : [],
      hiddenIds: Array.isArray(data.hiddenIds) ? data.hiddenIds : [],
      theme: data.theme || "papir",
      showExamples: data.showExamples !== false,
    };
  } catch {
    return { entries: [], hiddenIds: [], theme: "papir", showExamples: true };
  }
}

function saveBook(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      entries: state.entries.slice(0, 500),
      hiddenIds: state.hiddenIds.slice(0, 200),
      theme: state.theme,
      showExamples: state.showExamples,
    }));
  } catch (e) {
    console.warn("Could not save book", e);
  }
}

function remember(state, entry) {
  if (!entry || !entry.name) return state;
  const id = entry.id || ("book-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7));
  const clean = {
    id,
    kind: entry.kind || "person",
    name: entry.name,
    phone: entry.phone || "",
    postcode: entry.postcode || "",
    place: entry.place || "",
    address: entry.address || "",
    job: entry.job || "",
    orgnr: entry.orgnr || "",
    source: entry.source || "book",
  };
  const key = (clean.name + "|" + clean.postcode).toLowerCase();
  const filtered = state.entries.filter((e) => (e.name + "|" + (e.postcode || "")).toLowerCase() !== key);
  return { ...state, entries: [clean, ...filtered].slice(0, 500) };
}

function forget(state, id) {
  return {
    ...state,
    entries: state.entries.filter((e) => e.id !== id),
    hiddenIds: [...new Set([...state.hiddenIds, id])].slice(0, 200),
  };
}

function allEntries(state) {
  const hidden = new Set(state.hiddenIds);
  const book = state.entries.filter((e) => !hidden.has(e.id));
  const examples = state.showExamples
    ? DEFAULT_EXAMPLES.filter((e) => !hidden.has(e.id) && !book.some((b) => b.name === e.name))
    : [];
  return [...book, ...examples];
}

window.OppslagBook = { loadBook, saveBook, remember, forget, allEntries, DEFAULT_EXAMPLES };
