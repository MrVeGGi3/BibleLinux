// Parser das referencias digitadas no painel: "Jo 3:16", "1co 13.4-7", "Sl 23".

import { findBook } from './books.js';

const PATTERN = /^\s*(.+?)\s*(\d+)\s*(?:[:.,\s]\s*(\d+)\s*(?:\s*[-–a]\s*(\d+))?)?\s*$/u;

/**
 * Aceita separador ":" ou ".", intervalo com "-" e capitulo sem verso.
 * Retorna null quando nao reconhece, para a UI avisar em vez de projetar errado.
 */
export function parseReference(input) {
  if (!input) return null;

  const match = String(input).replace(/\s+/g, ' ').match(PATTERN);
  if (!match) {
    // "Jo 3" sem numero nenhum: ainda pode ser so o nome do livro.
    const onlyBook = findBook(input);
    return onlyBook ? { bookId: onlyBook.id, chapter: 1, from: 1, to: null } : null;
  }

  const [, rawBook, rawChapter, rawVerse, rawEnd] = match;
  const book = findBook(rawBook);
  if (!book) return null;

  const chapter = Number(rawChapter);
  const from = rawVerse ? Number(rawVerse) : 1;
  const to = rawEnd ? Number(rawEnd) : null;

  return { bookId: book.id, chapter, from, to: to && to >= from ? to : null };
}
