import { api, connect } from './api.js';

const el = (id) => document.getElementById(id);
const ui = {
  versao: el('versao'),
  porSlide: el('porSlide'),
  formRef: el('formRef'),
  ref: el('ref'),
  formBusca: el('formBusca'),
  busca: el('busca'),
  status: el('status'),
  trilha: el('trilha'),
  filtro: el('filtro'),
  conteudo: el('conteudo'),
  preview: el('preview'),
  aviso: el('aviso'),
};

const ESTILOS = [
  'fontScale',
  'fontFamily',
  'textColor',
  'bgColor',
  'referenceColor',
  'align',
  'showReference',
  'showVerseNumbers',
  'uppercaseReference',
];

const app = {
  estrutura: null,
  livros: [],
  vista: 'livros', // livros | capitulos | versos | busca
  livroId: null,
  capitulo: null,
  selecao: null, // ultimo trecho escolhido, para o botao Projetar
  resultados: null,
  servidor: null,
};

const socket = connect({
  onState: aoReceberEstado,
  onStatus: (status) => {
    ui.status.dataset.status = status;
    ui.status.textContent = status === 'online' ? 'conectado' : 'sem conexão';
  },
  onError: avisar,
});

let avisoTimer = null;
function avisar(mensagem) {
  ui.aviso.textContent = mensagem;
  ui.aviso.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { ui.aviso.hidden = true; }, 4000);
}

function livroPorId(id) {
  return app.estrutura?.books.find((livro) => livro.id === id) ?? null;
}

/* ---------- carga inicial ---------- */

async function iniciar() {
  const versoes = await api('/api/versions');
  ui.versao.replaceChildren(
    ...versoes.map((versao) => new Option(`${versao.shortName} — ${versao.name}`, versao.id)),
  );

  ui.porSlide.replaceChildren(
    ...Array.from({ length: 10 }, (_, i) => new Option(i === 0 ? '1 verso' : `${i + 1} versos`, i + 1)),
  );

  const estado = await api('/api/state');
  ui.versao.value = estado.versionId;
  ui.porSlide.value = estado.versesPerSlide;
  await carregarEstrutura(estado.versionId);
  aoReceberEstado(estado);
}

async function carregarEstrutura(versionId) {
  app.estrutura = await api('/api/structure', { version: versionId });
  app.livros = app.estrutura.books;
  render();
}

/* ---------- estado vindo do servidor ---------- */

function aoReceberEstado(estado) {
  app.servidor = estado;

  if (ui.versao.value !== estado.versionId && document.activeElement !== ui.versao) {
    ui.versao.value = estado.versionId;
    carregarEstrutura(estado.versionId).catch((erro) => avisar(erro.message));
  }
  if (document.activeElement !== ui.porSlide) ui.porSlide.value = estado.versesPerSlide;

  aplicarEstiloNosControles(estado.style);
  el('btnPreta').setAttribute('aria-pressed', String(estado.blank));
  renderPreview();
  if (app.vista === 'versos') renderConteudo();
}

function aplicarEstiloNosControles(estilo) {
  for (const chave of ESTILOS) {
    const campo = el(chave);
    // Nao mexe no controle enquanto o operador esta interagindo com ele.
    if (!campo || campo === document.activeElement) continue;
    if (campo.type === 'checkbox') campo.checked = Boolean(estilo[chave]);
    else campo.value = estilo[chave];
  }
  el('valorFonte').textContent = `${Math.round(Number(estilo.fontScale) * 100)}%`;
}

/* ---------- acoes ---------- */

function projetar(trecho) {
  app.selecao = { ...app.selecao, ...trecho };
  socket.send('show', {
    versionId: ui.versao.value,
    versesPerSlide: Number(ui.porSlide.value),
    bookId: app.selecao.bookId,
    chapter: app.selecao.chapter,
    startVerse: app.selecao.startVerse,
  });
}

function abrirLivro(livroId) {
  app.livroId = livroId;
  const livro = livroPorId(livroId);
  if (livro?.chapters.length === 1) {
    app.capitulo = 1;
    app.vista = 'versos';
  } else {
    app.capitulo = null;
    app.vista = 'capitulos';
  }
  render();
}

function abrirCapitulo(numero) {
  app.capitulo = numero;
  app.vista = 'versos';
  render();
}

/* ---------- renderizacao ---------- */

function render() {
  renderTrilha();
  renderConteudo();
}

function renderTrilha() {
  const partes = [];
  const livro = livroPorId(app.livroId);

  const botao = (texto, aoClicar, atual = false) => {
    const b = document.createElement('button');
    b.textContent = texto;
    if (atual) b.classList.add('atual');
    else b.addEventListener('click', aoClicar);
    return b;
  };

  partes.push(botao('Livros', () => { app.vista = 'livros'; render(); }, app.vista === 'livros'));

  if (app.vista === 'busca') {
    partes.push(separador(), botao(`Busca: “${app.resultados?.query ?? ''}”`, null, true));
  } else if (livro && app.vista !== 'livros') {
    partes.push(separador(), botao(livro.name, () => abrirLivro(livro.id), app.vista === 'capitulos'));
    if (app.vista === 'versos') {
      partes.push(separador(), botao(`Capítulo ${app.capitulo}`, null, true));
    }
  }

  ui.trilha.replaceChildren(...partes);
}

function separador() {
  const span = document.createElement('span');
  span.className = 'separador';
  span.textContent = '›';
  return span;
}

function renderConteudo() {
  if (!app.estrutura) return;
  if (app.vista === 'busca') return renderBusca();
  if (app.vista === 'capitulos') return renderCapitulos();
  if (app.vista === 'versos') return renderVersos();
  return renderLivros();
}

function renderLivros() {
  const filtro = ui.filtro.value.trim().toLowerCase();
  const combina = (livro) =>
    !filtro ||
    livro.name.toLowerCase().includes(filtro) ||
    livro.abbrev.toLowerCase().includes(filtro) ||
    livro.id.includes(filtro);

  const secoes = [
    ['Antigo Testamento', app.livros.filter((l) => l.testament === 'AT' && combina(l))],
    ['Novo Testamento', app.livros.filter((l) => l.testament === 'NT' && combina(l))],
  ];

  const blocos = [];
  for (const [titulo, livros] of secoes) {
    if (livros.length === 0) continue;
    const grupo = document.createElement('div');
    grupo.className = 'grupo';
    const h2 = document.createElement('h2');
    h2.className = 'titulo-secao';
    h2.textContent = titulo;
    const grade = document.createElement('div');
    grade.className = 'grade-livros';

    for (const livro of livros) {
      const botao = document.createElement('button');
      botao.className = 'livro';
      botao.classList.toggle('selecionado', livro.id === app.servidor?.bookId);
      botao.title = `${livro.name} · ${livro.chapters.length} capítulos`;
      botao.innerHTML = '<span class="sigla"></span><span class="nome"></span>';
      botao.querySelector('.sigla').textContent = livro.abbrev;
      botao.querySelector('.nome').textContent = livro.name;
      botao.addEventListener('click', () => abrirLivro(livro.id));
      grade.append(botao);
    }

    grupo.append(h2, grade);
    blocos.push(grupo);
  }

  if (blocos.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'vazio-msg';
    vazio.textContent = `Nenhum livro corresponde a “${ui.filtro.value}”.`;
    blocos.push(vazio);
  }

  ui.conteudo.replaceChildren(...blocos);
}

function renderCapitulos() {
  const livro = livroPorId(app.livroId);
  if (!livro) return renderLivros();

  const grade = document.createElement('div');
  grade.className = 'grade-numeros';
  livro.chapters.forEach((_versos, indice) => {
    const numero = indice + 1;
    const botao = document.createElement('button');
    botao.className = 'numero-item';
    botao.textContent = numero;
    botao.classList.toggle(
      'no-ar',
      app.servidor?.bookId === livro.id && app.servidor?.chapter === numero && app.servidor?.live,
    );
    botao.addEventListener('click', () => abrirCapitulo(numero));
    grade.append(botao);
  });

  ui.conteudo.replaceChildren(titulo(`${livro.name} — escolha o capítulo`), grade);
}

function renderVersos() {
  const livro = livroPorId(app.livroId);
  const total = livro?.chapters[app.capitulo - 1] ?? 0;
  if (!livro || !total) return renderLivros();

  const noAr = app.servidor?.live && app.servidor.bookId === livro.id && app.servidor.chapter === app.capitulo
    ? app.servidor.slide
    : null;

  const grade = document.createElement('div');
  grade.className = 'grade-numeros';
  for (let numero = 1; numero <= total; numero += 1) {
    const botao = document.createElement('button');
    botao.className = 'numero-item';
    botao.textContent = numero;
    if (noAr && numero >= noAr.startVerse && numero <= noAr.endVerse) botao.classList.add('selecionado');
    botao.addEventListener('click', () =>
      projetar({ bookId: livro.id, chapter: app.capitulo, startVerse: numero }),
    );
    grade.append(botao);
  }

  ui.conteudo.replaceChildren(
    titulo(`${livro.name} ${app.capitulo} — clique no verso inicial para projetar`),
    grade,
  );
}

function renderBusca() {
  const dados = app.resultados;
  if (!dados) return renderLivros();

  if (dados.results.length === 0) {
    ui.conteudo.replaceChildren(titulo(`Nada encontrado para “${dados.query}”.`));
    return;
  }

  const lista = dados.results.map((item) => {
    const botao = document.createElement('button');
    botao.className = 'resultado';
    const referencia = document.createElement('span');
    referencia.className = 'referencia';
    referencia.textContent = item.reference;
    botao.append(referencia, ...destacar(item.text, dados.query));
    botao.addEventListener('click', () =>
      projetar({ bookId: item.bookId, chapter: item.chapter, startVerse: item.verse }),
    );
    return botao;
  });

  const cabecalho = titulo(
    `${dados.total}${dados.truncated ? '+' : ''} resultado(s) para “${dados.query}”`,
  );
  ui.conteudo.replaceChildren(cabecalho, ...lista);
}

function titulo(texto) {
  const h2 = document.createElement('h2');
  h2.className = 'titulo-secao';
  h2.textContent = texto;
  return h2;
}

/** Tira acentos preservando o tamanho da string, para o indice bater no texto original. */
function dobrar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function destacar(texto, termo) {
  const inicio = dobrar(texto).indexOf(dobrar(termo).trim());
  if (inicio < 0) return [document.createTextNode(texto)];
  const fim = inicio + termo.trim().length;
  const marca = document.createElement('mark');
  marca.textContent = texto.slice(inicio, fim);
  return [document.createTextNode(texto.slice(0, inicio)), marca, document.createTextNode(texto.slice(fim))];
}

function renderPreview() {
  const estado = app.servidor;
  if (!estado?.slide) {
    ui.preview.className = 'preview vazio';
    const p = document.createElement('p');
    p.className = 'preview-vazio';
    p.textContent = 'Nada sendo projetado.';
    ui.preview.replaceChildren(p);
    return;
  }

  ui.preview.className = `preview${estado.blank ? ' apagado' : ''}`;
  const texto = document.createElement('div');
  texto.className = 'texto';
  for (const verso of estado.slide.verses) {
    const span = document.createElement('span');
    const numero = document.createElement('span');
    numero.className = 'numero';
    numero.textContent = verso.n;
    span.append(numero, document.createTextNode(`${verso.text} `));
    texto.append(span);
  }

  const referencia = document.createElement('div');
  referencia.className = 'referencia';
  referencia.textContent = `${estado.slide.reference} — ${estado.slide.versionShortName}${estado.blank ? ' · TELA PRETA' : ''}`;

  ui.preview.replaceChildren(texto, referencia);
}

/* ---------- eventos ---------- */

ui.versao.addEventListener('change', async () => {
  socket.send('version', { versionId: ui.versao.value });
  await carregarEstrutura(ui.versao.value);
});

ui.porSlide.addEventListener('change', () =>
  socket.send('versesPerSlide', { value: Number(ui.porSlide.value) }),
);

ui.filtro.addEventListener('input', () => {
  app.vista = 'livros';
  render();
});

ui.formRef.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const termo = ui.ref.value.trim();
  if (!termo) return;
  try {
    const dados = await api('/api/reference', {
      version: ui.versao.value,
      q: termo,
      count: ui.porSlide.value,
    });
    // Um intervalo explicito ("Jo 3:16-18") manda no numero de versos do slide.
    if (dados.parsed.to) {
      ui.porSlide.value = dados.parsed.to - dados.parsed.from + 1;
      socket.send('versesPerSlide', { value: Number(ui.porSlide.value) });
    }
    app.livroId = dados.bookId;
    app.capitulo = dados.chapter;
    app.vista = 'versos';
    render();
    projetar({ bookId: dados.bookId, chapter: dados.chapter, startVerse: dados.startVerse });
    ui.ref.select();
  } catch (erro) {
    avisar(erro.message);
  }
});

ui.formBusca.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    app.resultados = await api('/api/search', { version: ui.versao.value, q: ui.busca.value });
    app.vista = 'busca';
    render();
  } catch (erro) {
    avisar(erro.message);
  }
});

el('btnProjetar').addEventListener('click', () => {
  const alvo = app.selecao ?? (app.servidor?.bookId
    ? { bookId: app.servidor.bookId, chapter: app.servidor.chapter, startVerse: app.servidor.startVerse }
    : null);
  if (!alvo) return avisar('Escolha um livro, capítulo e verso primeiro.');
  projetar(alvo);
});

el('btnProximo').addEventListener('click', () => socket.send('next'));
el('btnAnterior').addEventListener('click', () => socket.send('prev'));
el('btnPreta').addEventListener('click', () => socket.send('blank'));
el('btnLimpar').addEventListener('click', () => socket.send('clear'));
el('btnPadrao').addEventListener('click', (evento) => {
  evento.preventDefault();
  socket.send('resetStyle');
});

for (const chave of ESTILOS) {
  const campo = el(chave);
  campo.addEventListener('input', () => {
    const valor = campo.type === 'checkbox'
      ? campo.checked
      : (chave === 'fontScale' ? Number(campo.value) : campo.value);
    if (chave === 'fontScale') el('valorFonte').textContent = `${Math.round(valor * 100)}%`;
    socket.send('style', { [chave]: valor });
  });
}

document.addEventListener('keydown', (evento) => {
  const alvo = evento.target;
  const digitando = alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement;

  if (evento.key === 'Escape') {
    if (digitando) alvo.blur();
    else socket.send('clear');
    return;
  }
  if (digitando) return;

  switch (evento.key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      evento.preventDefault();
      socket.send('next');
      break;
    case 'ArrowLeft':
    case 'PageUp':
      evento.preventDefault();
      socket.send('prev');
      break;
    case 'b':
    case 'B':
      socket.send('blank');
      break;
    case '/':
      evento.preventDefault();
      ui.busca.focus();
      break;
    case 'r':
    case 'R':
      evento.preventDefault();
      ui.ref.focus();
      break;
    default:
      break;
  }
});

iniciar().catch((erro) => avisar(erro.message));
