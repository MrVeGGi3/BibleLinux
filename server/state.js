// Estado da projecao. O servidor e o dono do estado: qualquer janela que abra ou
// recarregue recebe o slide atual, e dois paineis abertos ficam sincronizados.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS } from './books.js';
import { countChapters, countVerses, defaultVersionId, getVerses, getVersion, listVersions } from './bible.js';

const SETTINGS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'settings.json');

export const DEFAULT_STYLE = {
  fontScale: 1,
  fontFamily: "Georgia, 'Times New Roman', serif",
  textColor: '#ffffff',
  bgColor: '#0b0d12',
  referenceColor: '#f2c14e',
  align: 'center',
  showReference: true,
  showVerseNumbers: true,
  uppercaseReference: false,
};

const listeners = new Set();
let saveTimer = null;

const state = {
  versionId: null,
  versesPerSlide: 2,
  bookId: null,
  chapter: 1,
  startVerse: 1,
  live: false,
  blank: false,
  style: { ...DEFAULT_STYLE },
};

export async function initState() {
  state.versionId = defaultVersionId();
  try {
    const saved = JSON.parse(await readFile(SETTINGS_FILE, 'utf8'));
    state.style = { ...DEFAULT_STYLE, ...(saved.style ?? {}) };
    if (saved.versesPerSlide) state.versesPerSlide = clampPerSlide(saved.versesPerSlide);
    if (saved.versionId && listVersions().some((v) => v.id === saved.versionId)) {
      state.versionId = saved.versionId;
    }
  } catch {
    // Primeira execucao: segue com os padroes.
  }
}

function clampPerSlide(value) {
  return Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), 10);
}

/** Grava as preferencias com debounce — o slider de fonte dispara muitos eventos. */
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload = {
      style: state.style,
      versesPerSlide: state.versesPerSlide,
      versionId: state.versionId,
    };
    writeFile(SETTINGS_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8').catch((error) => {
      console.error('Não consegui salvar data/settings.json:', error.message);
    });
  }, 400);
  saveTimer.unref?.();
}

/** Estado + o slide ja renderizado, que e o que as duas telas consomem. */
export function getSnapshot() {
  const base = {
    versionId: state.versionId,
    versesPerSlide: state.versesPerSlide,
    bookId: state.bookId,
    chapter: state.chapter,
    startVerse: state.startVerse,
    live: state.live,
    blank: state.blank,
    style: state.style,
  };

  if (!state.live || !state.bookId) return { ...base, slide: null };

  try {
    const slide = getVerses(state.versionId, state.bookId, state.chapter, state.startVerse, state.versesPerSlide);
    return { ...base, chapter: slide.chapter, startVerse: slide.startVerse, slide };
  } catch (error) {
    // Rede de seguranca: um estado impossivel nunca pode travar todas as janelas.
    console.error('Estado inválido, limpando a projeção:', error.message);
    state.live = false;
    return { ...base, live: false, slide: null };
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  const snapshot = getSnapshot();
  for (const listener of listeners) listener(snapshot);
  return snapshot;
}

/** Valida o trecho antes de trocar o estado, para um pedido invalido nao apagar o que esta no ar. */
export function show({ versionId, bookId, chapter, startVerse, versesPerSlide }) {
  const alvo = {
    versionId: versionId ?? state.versionId,
    versesPerSlide: versesPerSlide ? clampPerSlide(versesPerSlide) : state.versesPerSlide,
    bookId: bookId ?? state.bookId,
    chapter: chapter ? Math.max(1, Math.trunc(chapter)) : state.chapter,
    startVerse: startVerse ? Math.max(1, Math.trunc(startVerse)) : state.startVerse,
  };

  if (alvo.bookId) {
    getVerses(alvo.versionId, alvo.bookId, alvo.chapter, alvo.startVerse, alvo.versesPerSlide);
  }

  Object.assign(state, alvo);
  if (state.bookId) {
    state.live = true;
    state.blank = false;
  }
  persist();
  return emit();
}

export function setVersion(versionId) {
  getVersion(versionId);
  state.versionId = versionId;
  persist();
  return emit();
}

export function setVersesPerSlide(value) {
  state.versesPerSlide = clampPerSlide(value);
  persist();
  return emit();
}

export function setStyle(patch) {
  state.style = { ...state.style, ...patch };
  persist();
  return emit();
}

export function resetStyle() {
  state.style = { ...DEFAULT_STYLE };
  persist();
  return emit();
}

export function setBlank(value) {
  state.blank = typeof value === 'boolean' ? value : !state.blank;
  return emit();
}

export function clear() {
  state.live = false;
  state.blank = false;
  return emit();
}

/**
 * Avanca ou volta um bloco de versos, virando o capitulo (e o livro) nas pontas,
 * para dar para conduzir uma leitura longa so com as setas.
 */
export function step(direction) {
  if (!state.live || !state.bookId) return emit();

  const size = state.versesPerSlide;
  const total = countVerses(state.versionId, state.bookId, state.chapter);

  if (direction > 0) {
    const next = state.startVerse + size;
    if (next <= total) {
      state.startVerse = next;
    } else if (state.chapter < countChapters(state.versionId, state.bookId)) {
      state.chapter += 1;
      state.startVerse = 1;
    } else {
      const index = BOOKS.findIndex((book) => book.id === state.bookId);
      const nextBook = BOOKS[index + 1];
      if (!nextBook) return emit();
      state.bookId = nextBook.id;
      state.chapter = 1;
      state.startVerse = 1;
    }
  } else {
    const previous = state.startVerse - size;
    if (previous >= 1) {
      state.startVerse = previous;
    } else if (state.chapter > 1) {
      state.chapter -= 1;
      state.startVerse = lastBlockStart(countVerses(state.versionId, state.bookId, state.chapter), size);
    } else {
      const index = BOOKS.findIndex((book) => book.id === state.bookId);
      const previousBook = BOOKS[index - 1];
      if (!previousBook) return emit();
      state.bookId = previousBook.id;
      state.chapter = countChapters(state.versionId, state.bookId);
      state.startVerse = lastBlockStart(countVerses(state.versionId, state.bookId, state.chapter), size);
    }
  }

  state.blank = false;
  return emit();
}

/** Inicio do ultimo bloco do capitulo, mantendo o alinhamento dos blocos. */
function lastBlockStart(verseCount, size) {
  if (verseCount <= size) return 1;
  return Math.floor((verseCount - 1) / size) * size + 1;
}
