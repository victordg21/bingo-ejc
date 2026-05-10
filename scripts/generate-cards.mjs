#!/usr/bin/env node
/**
 * Generates 1000 bingo cards, each with 15 unique numbers from 1-90.
 * Deterministic: uses a fixed seed so the same set is reproducible.
 * Writes data/cards.json and data/cards.csv.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const SEED = 0xB1A6_2026; // "BINGO 2026"
const NUM_CARDS = 1000;
const NUMBERS_PER_CARD = 15;
const MIN = 1;
const MAX = 90;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique(rand, count, min, max) {
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  // Fisher-Yates partial shuffle
  for (let i = pool.length - 1; i > pool.length - 1 - count; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(pool.length - count).sort((a, b) => a - b);
}

const rand = mulberry32(SEED);
const cards = [];
for (let i = 1; i <= NUM_CARDS; i++) {
  cards.push({
    code: String(i).padStart(4, "0"),
    numbers: pickUnique(rand, NUMBERS_PER_CARD, MIN, MAX),
  });
}

mkdirSync(DATA_DIR, { recursive: true });

writeFileSync(
  join(DATA_DIR, "cards.json"),
  JSON.stringify({ seed: SEED, count: cards.length, cards }, null, 2) + "\n",
  "utf8",
);

const csvHeader = ["code", ...Array.from({ length: NUMBERS_PER_CARD }, (_, i) => `n${i + 1}`)].join(",");
const csvRows = cards.map((c) => [c.code, ...c.numbers].join(","));
writeFileSync(
  join(DATA_DIR, "cards.csv"),
  csvHeader + "\n" + csvRows.join("\n") + "\n",
  "utf8",
);

console.log(`Wrote ${cards.length} cards to data/cards.json and data/cards.csv (seed=${SEED.toString(16)})`);
