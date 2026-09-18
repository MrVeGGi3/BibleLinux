#!/usr/bin/env node
// Baixa as traducoes em portugues e grava em data/ ja normalizadas.
// Uso: npm run fetch-bibles [-- --force]

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS, normalize } from '../server/books.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const BASE_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json';

const VERSIONS = [
  { id: 'acf', shortName: 'ACF', name: 'Almeida Corrigida Fiel', source: 'pt_acf.json' },
  { id: 'aa', shortName: 'AA', name: 'Almeida Revista e Atualizada', source: 'pt_aa.json' },
  { id: 'nvi', shortName: 'NVI', name: 'Nova Versão Internacional', source: 'pt_nvi.json' },
];

const force = process.argv.includes('--force');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar ${url}`);
  // Os arquivos de origem vem com BOM UTF-8, que quebra o JSON.parse.
  const text = (await response.text()).replace(/^﻿/, '');
  return JSON.parse(text);
}

/**
 * A origem traz os 66 livros em ordem canonica, entao a posicao e o vinculo mais
 * confiavel com a nossa tabela; a sigla serve so para conferir o alinhamento.
 */
function normalizeVersion(version, raw) {
  if (!Array.isArray(raw) || raw.length !== BOOKS.length) {
    throw new Error(`${version.id}: esperava ${BOOKS.length} livros, recebi ${raw?.length}`);
  }

  const books = BOOKS.map((book, index) => {
    const source = raw[index];
    const sourceAbbrev = normalize(source.abbrev ?? '');
    const expected = [book.id, book.abbrev, book.name, ...book.extras].map(normalize);
    if (!expected.some((alias) => alias.startsWith(sourceAbbrev) || sourceAbbrev.startsWith(alias))) {
      console.warn(`  aviso: "${source.abbrev}" (${source.name}) na posição ${index + 1}, esperava ${book.name}`);
    }
    const chapters = source.chapters.map((verses) => verses.map((verse) => verse.trim()));
    if (chapters.length === 0) throw new Error(`${version.id}/${book.id}: sem capítulos`);
    return { id: book.id, chapters };
  });

  return { id: version.id, name: version.name, shortName: version.shortName, books };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const manifest = [];

  for (const version of VERSIONS) {
    const file = `${version.id}.json`;
    const target = join(DATA_DIR, file);
    manifest.push({ id: version.id, name: version.name, shortName: version.shortName, file });

    if (!force && (await exists(target))) {
      console.log(`- ${version.shortName}: já existe, pulando (use --force para baixar de novo)`);
      continue;
    }

    console.log(`- ${version.shortName}: baixando ${version.source}...`);
    const raw = await download(`${BASE_URL}/${version.source}`);
    const normalized = normalizeVersion(version, raw);
    await writeFile(target, JSON.stringify(normalized), 'utf8');
    const verses = normalized.books.reduce(
      (total, book) => total + book.chapters.reduce((sum, chapter) => sum + chapter.length, 0),
      0,
    );
    console.log(`  ok: ${normalized.books.length} livros, ${verses} versículos -> data/${file}`);
  }

  await writeFile(join(DATA_DIR, 'versions.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\nManifesto gravado em data/versions.json (${manifest.length} versões).`);
}

main().catch((error) => {
  console.error(`\nFalhou: ${error.message}`);
  process.exit(1);
});
