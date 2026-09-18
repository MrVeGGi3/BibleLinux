// Carga das versoes em memoria (~12 MB para as tres) e leitura de trechos.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS, BOOK_BY_ID, normalize } from './books.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

/** @type {Map<string, {id, name, shortName, books: Map<string, string[][]>}>} */
const versions = new Map();
const manifest = [];
/** Indice normalizado por versao, construido sob demanda na primeira busca. */
const searchIndexes = new Map();

export class BibleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function loadBible() {
  let entries;
  try {
    entries = JSON.parse(await readFile(join(DATA_DIR, 'versions.json'), 'utf8'));
  } catch {
    throw new Error('data/versions.json não encontrado. Rode antes: npm run fetch-bibles');
  }

  for (const entry of entries) {
    const raw = JSON.parse(await readFile(join(DATA_DIR, entry.file), 'utf8'));
    versions.set(entry.id, {
      id: entry.id,
      name: entry.name,
      shortName: entry.shortName,
      books: new Map(raw.books.map((book) => [book.id, book.chapters])),
    });
    manifest.push({ id: entry.id, name: entry.name, shortName: entry.shortName });
  }

  if (versions.size === 0) throw new Error('Nenhuma versão carregada. Rode: npm run fetch-bibles');
  return manifest;
}

export function listVersions() {
  return manifest;
}

export function defaultVersionId() {
  return manifest[0]?.id ?? null;
}

export function getVersion(versionId) {
  const version = versions.get(versionId);
  if (!version) throw new BibleError(`Versão desconhecida: ${versionId}`, 404);
  return version;
}

function getChapters(versionId, bookId) {
  const version = getVersion(versionId);
  const chapters = version.books.get(bookId);
  if (!chapters) throw new BibleError(`Livro desconhecido: ${bookId}`, 404);
  return chapters;
}

export function countChapters(versionId, bookId) {
  return getChapters(versionId, bookId).length;
}

export function countVerses(versionId, bookId, chapter) {
  const chapters = getChapters(versionId, bookId);
  return chapters[chapter - 1]?.length ?? 0;
}

/** Capitulos por livro e versos por capitulo — alimenta as grades do painel. */
export function getStructure(versionId) {
  const version = getVersion(versionId);
  return {
    version: { id: version.id, name: version.name, shortName: version.shortName },
    books: BOOKS.map((book) => ({
      id: book.id,
      abbrev: book.abbrev,
      name: book.name,
      testament: book.testament,
      chapters: (version.books.get(book.id) ?? []).map((verses) => verses.length),
    })),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatReference(bookId, chapter, from, to) {
  const book = BOOK_BY_ID.get(bookId);
  const name = book ? book.name : bookId;
  return from === to ? `${name} ${chapter}:${from}` : `${name} ${chapter}:${from}-${to}`;
}

/**
 * Le um trecho, sempre ajustando os limites para dentro do capitulo, de modo que
 * uma referencia fora de faixa mostre algo util em vez de quebrar ao vivo.
 */
export function getVerses(versionId, bookId, chapter, from, count = 1) {
  const version = getVersion(versionId);
  const chapters = getChapters(versionId, bookId);
  const chapterNumber = clamp(Math.trunc(chapter) || 1, 1, chapters.length);
  const verses = chapters[chapterNumber - 1];
  const start = clamp(Math.trunc(from) || 1, 1, verses.length);
  const end = clamp(start + Math.max(1, Math.trunc(count)) - 1, start, verses.length);

  return {
    versionId: version.id,
    versionName: version.name,
    versionShortName: version.shortName,
    bookId,
    bookName: BOOK_BY_ID.get(bookId)?.name ?? bookId,
    bookAbbrev: BOOK_BY_ID.get(bookId)?.abbrev ?? bookId,
    chapter: chapterNumber,
    startVerse: start,
    endVerse: end,
    chapterCount: chapters.length,
    verseCount: verses.length,
    reference: formatReference(bookId, chapterNumber, start, end),
    verses: verses.slice(start - 1, end).map((text, offset) => ({ n: start + offset, text })),
  };
}

function getSearchIndex(versionId) {
  if (searchIndexes.has(versionId)) return searchIndexes.get(versionId);

  const version = getVersion(versionId);
  const index = [];
  for (const book of BOOKS) {
    const chapters = version.books.get(book.id) ?? [];
    chapters.forEach((verses, chapterOffset) => {
      verses.forEach((text, verseOffset) => {
        index.push({
          bookId: book.id,
          chapter: chapterOffset + 1,
          verse: verseOffset + 1,
          text,
          haystack: normalize(text),
        });
      });
    });
  }
  searchIndexes.set(versionId, index);
  return index;
}

/** Busca por palavra: varredura linear sobre o texto sem acentos (~31 mil versos). */
export function search(versionId, query, limit = 60) {
  const needle = normalize(query ?? '');
  if (needle.length < 3) throw new BibleError('Digite ao menos 3 letras para buscar.');

  const results = [];
  for (const entry of getSearchIndex(versionId)) {
    if (!entry.haystack.includes(needle)) continue;
    results.push({
      bookId: entry.bookId,
      bookName: BOOK_BY_ID.get(entry.bookId)?.name ?? entry.bookId,
      chapter: entry.chapter,
      verse: entry.verse,
      reference: formatReference(entry.bookId, entry.chapter, entry.verse, entry.verse),
      text: entry.text,
    });
    if (results.length >= limit) break;
  }
  return { query, versionId, total: results.length, truncated: results.length >= limit, results };
}
