#!/usr/bin/env bash
# Instalador do BibleLinux: traz o proprio Node.js, sem sudo e sem mexer no
# Node do sistema. Tudo fica em ~/.local/share/biblelinux.
#
#   curl -fsSL https://raw.githubusercontent.com/MrVeGGi3/BibleLinux/main/install.sh | bash
#   bash install.sh                 instala ou atualiza
#   bash install.sh --desinstalar   remove o app, o atalho e o icone
#
# Variaveis opcionais:
#   NODE_MAJOR=22        linha do Node a instalar
#   BIBLELINUX_REF=main  branch ou tag do GitHub a baixar (quando nao roda num clone)

set -euo pipefail

REPO="MrVeGGi3/BibleLinux"
NODE_MAJOR="${NODE_MAJOR:-22}"
REF="${BIBLELINUX_REF:-main}"
DADOS="${XDG_DATA_HOME:-$HOME/.local/share}"
# O .desktop portatil procura o app exatamente aqui.
APP="$HOME/.local/share/biblelinux"
DESKTOP="$DADOS/applications/biblelinux.desktop"
ICONE="$DADOS/icons/hicolor/scalable/apps/biblelinux.svg"

passo() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
falhar() {
  printf '\033[31mErro:\033[0m %s\n' "$1" >&2
  exit 1
}

desinstalar() {
  passo "Removendo o BibleLinux"
  [ -x "$APP/scripts/biblelinux.sh" ] && "$APP/scripts/biblelinux.sh" --parar >/dev/null 2>&1 || true
  rm -rf "$APP"
  rm -f "$DESKTOP" "$ICONE"
  command -v update-desktop-database >/dev/null 2>&1 &&
    update-desktop-database "$DADOS/applications" >/dev/null 2>&1 || true
  echo "Pronto. O BibleLinux foi removido."
}

case "${1:-}" in
  --desinstalar) desinstalar; exit 0 ;;
  "") ;;
  *) falhar "opcao desconhecida: $1 (use --desinstalar ou nada)" ;;
esac

for cmd in curl tar sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || falhar "o comando '$cmd' e necessario. Instale-o e rode de novo."
done

case "$(uname -m)" in
  x86_64 | amd64) ARCH=x64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  armv7l) ARCH=armv7l ;;
  *) falhar "arquitetura $(uname -m) nao suportada pelo Node.js oficial." ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$APP"

# --- Node.js -----------------------------------------------------------------

instalar_node() {
  local base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  local ext=tar.xz linha arquivo soma versao atual=""

  command -v xz >/dev/null 2>&1 || ext=tar.gz
  curl -fsSL "$base/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt" ||
    falhar "nao consegui consultar nodejs.org. Confira a internet."
  linha="$(grep -E " node-v[0-9.]+-linux-${ARCH}\.${ext}\$" "$TMP/SHASUMS256.txt" | head -1)"
  [ -n "$linha" ] || falhar "nao achei o Node ${NODE_MAJOR} para linux-${ARCH}."
  soma="${linha%% *}"
  arquivo="${linha##* }"
  versao="$(echo "$arquivo" | sed -E 's/^node-(v[0-9.]+)-.*/\1/')"

  [ -x "$APP/node/bin/node" ] && atual="$("$APP/node/bin/node" -v 2>/dev/null || true)"
  if [ "$atual" = "$versao" ]; then
    echo "Node $versao ja instalado."
    return 0
  fi

  echo "Baixando Node $versao ($ARCH)..."
  curl -fL --progress-bar "$base/$arquivo" -o "$TMP/$arquivo" || falhar "falha ao baixar $arquivo."
  echo "$soma  $TMP/$arquivo" | sha256sum -c --quiet - || falhar "o arquivo do Node veio corrompido."

  rm -rf "$APP/node.novo"
  mkdir -p "$APP/node.novo"
  tar -xf "$TMP/$arquivo" --strip-components=1 -C "$APP/node.novo"
  rm -rf "$APP/node"
  mv "$APP/node.novo" "$APP/node"
}

# --- Aplicativo ----------------------------------------------------------------

origem_do_app() {
  # Rodando de dentro de um clone: usa os arquivos locais. Via `curl | bash`,
  # BASH_SOURCE nao aponta para um arquivo e o app vem do GitHub.
  local aqui=""
  if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    aqui="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
  fi
  if [ -n "$aqui" ] && [ -f "$aqui/server/index.js" ] && [ -z "${BIBLELINUX_REF:-}" ]; then
    echo "$aqui"
    return 0
  fi

  echo "Baixando o BibleLinux ($REF)..." >&2
  curl -fsSL "https://github.com/$REPO/archive/$REF.tar.gz" -o "$TMP/app.tar.gz" ||
    falhar "falha ao baixar o app do GitHub ($REF)."
  mkdir -p "$TMP/app"
  tar -xzf "$TMP/app.tar.gz" --strip-components=1 -C "$TMP/app"
  echo "$TMP/app"
}

copiar_app() {
  local origem="$1"
  if [ "$(readlink -f "$origem")" = "$(readlink -f "$APP")" ]; then
    echo "Rodando de dentro da instalacao; arquivos mantidos."
    return 0
  fi
  # Troca o codigo, mas preserva as biblias e as preferencias (data/), o Node
  # embutido e as dependencias ja instaladas.
  find "$APP" -mindepth 1 -maxdepth 1 \
    ! -name data ! -name node ! -name node_modules -exec rm -rf {} +
  tar -C "$origem" \
    --exclude=./data --exclude=./node --exclude=./node_modules --exclude=./.git \
    -cf - . | tar -C "$APP" -xf -
  mkdir -p "$APP/data"
  chmod +x "$APP/scripts/"*.sh "$APP/install.sh" 2>/dev/null || true
}

# --- Execucao ------------------------------------------------------------------

passo "Node.js $NODE_MAJOR LTS"
instalar_node

passo "Aplicativo"
ORIGEM="$(origem_do_app)"
copiar_app "$ORIGEM"

export PATH="$APP/node/bin:$PATH"

passo "Dependencias"
(cd "$APP" && npm ci --omit=dev --no-fund --no-audit --no-update-notifier --loglevel=error)

passo "Texto biblico (so na primeira vez)"
(cd "$APP" && npm run --silent fetch-bibles)

passo "Atalho no menu"
install -Dm644 "$APP/desktop/biblelinux.svg" "$ICONE"
install -Dm644 "$APP/desktop/biblelinux-portatil.desktop" "$DESKTOP"
command -v update-desktop-database >/dev/null 2>&1 &&
  update-desktop-database "$DADOS/applications" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 &&
  gtk-update-icon-cache -q -t "$DADOS/icons/hicolor" >/dev/null 2>&1 || true

cat <<EOF

BibleLinux instalado em $APP (Node $(node -v)).
Procure por "BibleLinux" no menu de aplicativos, ou rode:
  $APP/scripts/biblelinux.sh
Para remover: bash $APP/install.sh --desinstalar
EOF
