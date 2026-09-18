import { connect } from './api.js';

const palco = document.getElementById('palco');
const texto = document.getElementById('texto');
const referencia = document.getElementById('referencia');

let escalaBase = 1;

function aplicarEstilo(estilo) {
  const raiz = document.documentElement.style;
  raiz.setProperty('--cor-texto', estilo.textColor);
  raiz.setProperty('--cor-fundo', estilo.bgColor);
  raiz.setProperty('--cor-referencia', estilo.referenceColor);
  raiz.setProperty('--fonte', estilo.fontFamily);
  raiz.setProperty('--alinhamento', estilo.align);
  escalaBase = Number(estilo.fontScale) || 1;
  raiz.setProperty('--escala', escalaBase);
}

/**
 * Reduz a fonte em passos ate o bloco caber na tela. Sem isso, um trecho de 6
 * versos em Salmos escorre para fora da area visivel do projetor.
 */
function ajustarTamanho() {
  const raiz = document.documentElement.style;
  let escala = escalaBase;
  raiz.setProperty('--escala', escala);
  let guarda = 0;
  while (palco.scrollHeight > palco.clientHeight && escala > 0.28 && guarda < 40) {
    escala *= 0.94;
    raiz.setProperty('--escala', escala);
    guarda += 1;
  }
}

function render(estado) {
  aplicarEstilo(estado.style);

  if (estado.blank) {
    document.body.dataset.estado = 'preta';
    return;
  }
  if (!estado.slide) {
    document.body.dataset.estado = 'vazio';
    texto.replaceChildren();
    referencia.textContent = '';
    return;
  }

  document.body.dataset.estado = 'ativo';

  texto.replaceChildren(
    ...estado.slide.verses.map((verso) => {
      const span = document.createElement('span');
      span.className = 'verso';
      if (estado.style.showVerseNumbers) {
        const numero = document.createElement('span');
        numero.className = 'numero';
        numero.textContent = verso.n;
        span.append(numero);
      }
      span.append(document.createTextNode(verso.text));
      return span;
    }),
  );

  const rotulo = `${estado.slide.reference} — ${estado.slide.versionShortName}`;
  referencia.textContent = estado.style.showReference
    ? (estado.style.uppercaseReference ? rotulo.toUpperCase() : rotulo)
    : '';

  ajustarTamanho();
}

let ultimoEstado = null;

connect({
  onState: (estado) => {
    ultimoEstado = estado;
    render(estado);
  },
  onStatus: (status) => palco.classList.toggle('desconectado', status === 'offline'),
});

window.addEventListener('resize', () => ultimoEstado && render(ultimoEstado));

document.addEventListener('dblclick', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
