#!/usr/bin/env bash
# Lancador grafico: sobe o servidor se ele ainda nao estiver no ar e abre a
# janela pedida no navegador. Usado pelo atalho .desktop.
#
#   biblelinux.sh             painel do operador
#   biblelinux.sh --projecao  tela de projecao
#   biblelinux.sh --parar     encerra o servidor

set -uo pipefail

RAIZ="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PORTA="${PORT:-3210}"
BASE="http://localhost:${PORTA}"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/biblelinux"
LOG="$CACHE/servidor.log"
PIDFILE="$CACHE/servidor.pid"

mkdir -p "$CACHE"

avisar() {
  # O atalho roda sem terminal, entao os erros precisam aparecer na area de trabalho.
  echo "$1: $2"
  if command -v notify-send >/dev/null 2>&1; then
    notify-send --app-name=BibleLinux "$1" "$2"
  elif command -v zenity >/dev/null 2>&1; then
    zenity --info --title="$1" --text="$2" &
  fi
}

# O Node instalado pelo nvm nao esta no PATH de aplicativos graficos.
preparar_node() {
  command -v node >/dev/null 2>&1 && return 0
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
  fi
  command -v node >/dev/null 2>&1 && return 0
  local recente
  recente="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$recente" ] && PATH="$recente:$PATH" && export PATH
  command -v node >/dev/null 2>&1
}

no_ar() {
  curl -fsS -o /dev/null --max-time 2 "$BASE/api/state" 2>/dev/null
}

# Confere se o PID guardado ainda e o nosso servidor, e nao um processo que
# reaproveitou o numero depois de um desligamento abrupto.
nosso_processo() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null &&
    ps -p "$pid" -o args= 2>/dev/null | grep -q 'server/index.js'
}

parar() {
  local pid=""
  [ -f "$PIDFILE" ] && pid="$(cat "$PIDFILE")"
  if nosso_processo "$pid"; then
    kill "$pid"
    rm -f "$PIDFILE"
    avisar "BibleLinux" "Servidor encerrado."
  else
    rm -f "$PIDFILE"
    avisar "BibleLinux" "O servidor nao estava rodando."
  fi
}

primeira_vez() {
  [ -d "$RAIZ/node_modules" ] && [ -f "$RAIZ/data/versions.json" ] && return 0
  avisar "BibleLinux" "Primeira execucao: preparando o app (pode levar um minuto)."
  ( cd "$RAIZ" && npm install --no-fund --no-audit && npm run fetch-bibles ) >>"$LOG" 2>&1
}

subir() {
  no_ar && return 0

  preparar_node || {
    avisar "BibleLinux nao abriu" "Node.js nao encontrado. Instale o Node 18 ou mais novo."
    exit 1
  }

  primeira_vez || {
    avisar "BibleLinux nao abriu" "Falha ao preparar o app. Veja $LOG"
    exit 1
  }

  # O `exec` faz o subshell virar o proprio node, entao $! e o PID do servidor.
  ( cd "$RAIZ" && exec env PORT="$PORTA" nohup node server/index.js >>"$LOG" 2>&1 ) &
  echo $! >"$PIDFILE"

  for _ in $(seq 1 40); do
    no_ar && return 0
    sleep 0.5
  done

  avisar "BibleLinux nao abriu" "O servidor nao respondeu na porta $PORTA. Veja $LOG"
  exit 1
}

case "${1:-}" in
  --parar) parar; exit 0 ;;
  --projecao) destino="$BASE/projecao" ;;
  *) destino="$BASE/" ;;
esac

subir
xdg-open "$destino" >/dev/null 2>&1 &
