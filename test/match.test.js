/**
 * Node test suite for match engine – no deps.
 * Run: node test/match.test.js
 */
const assert = require("assert");
const path = require("path");
const { searchEntries, groupHits, matchEntry, tokenize, looseFold } = require(
  path.join(__dirname, "..", "js", "match.js")
);

const examples = [
  { id: "1", kind: "person", name: "Victoria Berg", phone: "90000001", postcode: "0150", place: "Oslo" },
  { id: "2", kind: "person", name: "Viktoria Nilsen", phone: "90000002", postcode: "5003", place: "Bergen" },
  { id: "3", kind: "person", name: "Johnny David Hauge", phone: "90000003", postcode: "7010" },
  { id: "4", kind: "person", name: "Johnny Dale Olsen", phone: "90000004", postcode: "8001" },
  { id: "5", kind: "person", name: "Maria Elise Lie", phone: "90000005", postcode: "0683", place: "Oslo" },
  { id: "6", kind: "person", name: "Karen Sofie Hansen", phone: "90000006", postcode: "0583" },
  { id: "7", kind: "person", name: "Kari Anne Berg", phone: "90000007", postcode: "0150" },
  { id: "8", kind: "person", name: "William Hansen", phone: "90000008", postcode: "2000" },
  { id: "9", kind: "person", name: "Bill Andersen", phone: "90000009", postcode: "3015" },
  { id: "10", kind: "person", name: "Svein Morten Pedersen", phone: "90000010", postcode: "0683", place: "Oslo" },
];

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    console.error("  ✗ " + name);
    console.error("    " + e.message);
  }
}

console.log("Oppslag match tests\n");

test("looseFold Victoria ≈ Viktoria", () => {
  assert.strictEqual(looseFold("Victoria"), looseFold("Viktoria"));
});

test("Victoria finds both Victoria and Viktoria", () => {
  const hits = searchEntries("Victoria", examples);
  const names = hits.map((h) => h.name);
  assert.ok(names.includes("Victoria Berg"), "exact Victoria");
  assert.ok(names.includes("Viktoria Nilsen"), "spelling Viktoria");
  assert.strictEqual(hits.find((h) => h.name === "Victoria Berg").band, "exact");
  assert.strictEqual(hits.find((h) => h.name === "Viktoria Nilsen").band, "near");
});

test("Johnny D* finds David and Dale", () => {
  const hits = searchEntries("Johnny D*", examples);
  const names = hits.map((h) => h.name);
  assert.ok(names.some((n) => n.includes("David")));
  assert.ok(names.some((n) => n.includes("Dale")));
});

test("*ar* * *e finds Maria pattern", () => {
  const hits = searchEntries("*ar* * *e", examples);
  assert.ok(hits.length >= 1, "expected at least Maria Elise Lie, got " + hits.length);
  const names = hits.map((h) => h.name);
  assert.ok(names.some((n) => n.includes("Maria")));
});

test("Svein Morten * 0683", () => {
  const hits = searchEntries("Svein Morten * 0683", examples);
  assert.ok(hits.some((h) => h.name.includes("Svein Morten") && h.postcode === "0683"));
});

test("Bill finds William via nickname", () => {
  const hits = searchEntries("Bill", examples);
  assert.ok(hits.some((h) => h.name === "William Hansen" || h.name === "Bill Andersen"));
});

test("tokenize quoted and wildcards", () => {
  const t = tokenize('Svein "0683" Mort*');
  assert.strictEqual(t.length, 3);
  assert.ok(t[1].exact);
  assert.ok(t[2].hasWild);
});

test("groupHits bands", () => {
  const hits = searchEntries("Victoria", examples);
  const g = groupHits(hits);
  assert.ok(g.exact.length >= 1);
  assert.ok(g.near.length >= 1);
});

test("_ is single char, * is multi", () => {
  const entries = [
    { id: "1", kind: "person", name: "abc", phone: "", postcode: "" },
    { id: "2", kind: "person", name: "aXc", phone: "", postcode: "" },
    { id: "3", kind: "person", name: "ac", phone: "", postcode: "" },
    { id: "4", kind: "person", name: "abbc", phone: "", postcode: "" },
  ];
  const under = searchEntries("a_c", entries).map((h) => h.name).sort();
  const star = searchEntries("a*c", entries).map((h) => h.name).sort();
  assert.deepStrictEqual(under, ["aXc", "abc"]);
  assert.ok(star.includes("abbc") && star.includes("ac"));
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
