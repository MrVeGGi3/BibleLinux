// Tabela canonica dos 66 livros: fonte unica para a grade do painel, para a
// formatacao de referencias e para o parser de "Jo 3:16".
// `extras` traz apelidos que nao derivam automaticamente da sigla ou do nome.

const TABLE = [
  ['gn', 'Gn', 'Gênesis', 'AT', ['gen']],
  ['ex', 'Êx', 'Êxodo', 'AT', ['exo']],
  ['lv', 'Lv', 'Levítico', 'AT', ['lev']],
  ['nm', 'Nm', 'Números', 'AT', ['num']],
  ['dt', 'Dt', 'Deuteronômio', 'AT', ['deut']],
  ['js', 'Js', 'Josué', 'AT', ['jos']],
  ['jz', 'Jz', 'Juízes', 'AT', ['juizes', 'jui']],
  ['rt', 'Rt', 'Rute', 'AT', ['rut']],
  ['1sm', '1Sm', '1 Samuel', 'AT', ['1sam']],
  ['2sm', '2Sm', '2 Samuel', 'AT', ['2sam']],
  ['1rs', '1Rs', '1 Reis', 'AT', ['1re']],
  ['2rs', '2Rs', '2 Reis', 'AT', ['2re']],
  ['1cr', '1Cr', '1 Crônicas', 'AT', ['1cron', '1cro']],
  ['2cr', '2Cr', '2 Crônicas', 'AT', ['2cron', '2cro']],
  ['ed', 'Ed', 'Esdras', 'AT', ['esd']],
  ['ne', 'Ne', 'Neemias', 'AT', ['nee']],
  ['et', 'Et', 'Ester', 'AT', ['est']],
  ['job', 'Jó', 'Jó', 'AT', []],
  ['sl', 'Sl', 'Salmos', 'AT', ['salmo', 'sal', 'salm', 'ps']],
  ['pv', 'Pv', 'Provérbios', 'AT', ['prov', 'pro', 'pb']],
  ['ec', 'Ec', 'Eclesiastes', 'AT', ['ecl']],
  ['ct', 'Ct', 'Cânticos', 'AT', ['cantares', 'cantico dos canticos', 'cant', 'cc']],
  ['is', 'Is', 'Isaías', 'AT', ['isa']],
  ['jr', 'Jr', 'Jeremias', 'AT', ['jer']],
  ['lm', 'Lm', 'Lamentações', 'AT', ['lamentacoes de jeremias', 'lam']],
  ['ez', 'Ez', 'Ezequiel', 'AT', ['eze']],
  ['dn', 'Dn', 'Daniel', 'AT', ['dan']],
  ['os', 'Os', 'Oséias', 'AT', ['oseias', 'ose']],
  ['jl', 'Jl', 'Joel', 'AT', ['joe']],
  ['am', 'Am', 'Amós', 'AT', ['amo']],
  ['ob', 'Ob', 'Obadias', 'AT', ['abd', 'obd']],
  ['jn', 'Jn', 'Jonas', 'AT', ['jon']],
  ['mq', 'Mq', 'Miquéias', 'AT', ['miqueias', 'miq']],
  ['na', 'Na', 'Naum', 'AT', ['nau']],
  ['hc', 'Hc', 'Habacuque', 'AT', ['hab']],
  ['sf', 'Sf', 'Sofonias', 'AT', ['sof']],
  ['ag', 'Ag', 'Ageu', 'AT', ['age']],
  ['zc', 'Zc', 'Zacarias', 'AT', ['zac']],
  ['ml', 'Ml', 'Malaquias', 'AT', ['mal']],
  ['mt', 'Mt', 'Mateus', 'NT', ['mat']],
  ['mc', 'Mc', 'Marcos', 'NT', ['mar', 'mr']],
  ['lc', 'Lc', 'Lucas', 'NT', ['luc', 'lu']],
  ['jo', 'Jo', 'João', 'NT', ['joao']],
  ['at', 'At', 'Atos', 'NT', ['atos', 'atos dos apostolos', 'ato']],
  ['rm', 'Rm', 'Romanos', 'NT', ['rom', 'ro']],
  ['1co', '1Co', '1 Coríntios', 'NT', ['1cor', '1corintios']],
  ['2co', '2Co', '2 Coríntios', 'NT', ['2cor', '2corintios']],
  ['gl', 'Gl', 'Gálatas', 'NT', ['gal', 'ga']],
  ['ef', 'Ef', 'Efésios', 'NT', ['efe']],
  ['fp', 'Fp', 'Filipenses', 'NT', ['fil', 'filip']],
  ['cl', 'Cl', 'Colossenses', 'NT', ['col']],
  ['1ts', '1Ts', '1 Tessalonicenses', 'NT', ['1tes', '1te']],
  ['2ts', '2Ts', '2 Tessalonicenses', 'NT', ['2tes', '2te']],
  ['1tm', '1Tm', '1 Timóteo', 'NT', ['1tim', '1ti']],
  ['2tm', '2Tm', '2 Timóteo', 'NT', ['2tim', '2ti']],
  ['tt', 'Tt', 'Tito', 'NT', ['tit', 'ti']],
  ['fm', 'Fm', 'Filemom', 'NT', ['filemon', 'flm', 'fle']],
  ['hb', 'Hb', 'Hebreus', 'NT', ['heb', 'he']],
  ['tg', 'Tg', 'Tiago', 'NT', ['tia']],
  ['1pe', '1Pe', '1 Pedro', 'NT', ['1pd', '1ped']],
  ['2pe', '2Pe', '2 Pedro', 'NT', ['2pd', '2ped']],
  ['1jo', '1Jo', '1 João', 'NT', ['1joao', '1jn']],
  ['2jo', '2Jo', '2 João', 'NT', ['2joao', '2jn']],
  ['3jo', '3Jo', '3 João', 'NT', ['3joao', '3jn']],
  ['jd', 'Jd', 'Judas', 'NT', ['jud']],
  ['ap', 'Ap', 'Apocalipse', 'NT', ['apo', 'apoc', 'rev']],
];

export const BOOKS = TABLE.map(([id, abbrev, name, testament, extras], index) => ({
  id,
  abbrev,
  name,
  testament,
  order: index + 1,
  extras,
}));

export const BOOK_BY_ID = new Map(BOOKS.map((book) => [book.id, book]));

/** Minusculas, sem acentos e sem pontuacao/espacos — forma usada nas comparacoes. */
export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Indice de apelidos -> livro. A busca acontece em duas etapas: primeiro
// respeitando os acentos e depois ignorando-os, para que "Jó" caia em Jó e
// "Jo" (o jeito usual de escrever) caia em João.
const EXACT = new Map();
const LOOSE = new Map();

/** Minusculas e sem pontuacao/espacos, mas preservando os acentos. */
function keyWithAccents(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const ORDINALS = {
  1: ['1', '1a', '1o', 'i', 'primeira', 'primeiro'],
  2: ['2', '2a', '2o', 'ii', 'segunda', 'segundo'],
  3: ['3', '3a', '3o', 'iii', 'terceira', 'terceiro'],
};

/** Gera, para cada apelido, tambem as variantes de numeracao (1co, i co, primeira co...). */
function expand(alias) {
  const out = [alias];
  const match = keyWithAccents(alias).match(/^([123])(.+)$/u);
  if (match) {
    const [, num, rest] = match;
    for (const ordinal of ORDINALS[num]) out.push(ordinal + rest);
  }
  return out;
}

function register(map, keyOf, alias, book) {
  const key = keyOf(alias);
  if (key && !map.has(key)) map.set(key, book);
}

// Desempate de apelidos ambiguos depois que os acentos caem: o primeiro a entrar
// no indice vence, entao "jo" e reservado para Joao antes do resto.
const LOOSE_PREFERRED = [['jo', 'jo']];

for (const [alias, bookId] of LOOSE_PREFERRED) {
  const book = BOOKS.find((item) => item.id === bookId);
  if (book) LOOSE.set(normalize(alias), book);
}

for (const book of BOOKS) {
  for (const base of [book.id, book.abbrev, book.name, ...book.extras]) {
    for (const alias of expand(base)) {
      register(EXACT, keyWithAccents, alias, book);
      register(LOOSE, normalize, alias, book);
    }
  }
}

/** Resolve um termo digitado pelo usuario ("1 Co", "joao", "SL") para um livro. */
export function findBook(term) {
  if (!term) return null;
  return EXACT.get(keyWithAccents(term)) ?? LOOSE.get(normalize(term)) ?? null;
}
