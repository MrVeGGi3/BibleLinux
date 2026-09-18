#!/usr/bin/env bash
# Instala o atalho no menu de aplicativos, apontando para este diretorio.
set -euo pipefail

RAIZ="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
DESTINO="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ARQUIVO="$DESTINO/biblelinux.desktop"

mkdir -p "$DESTINO"
sed "s|@RAIZ@|$RAIZ|g" "$RAIZ/desktop/biblelinux.desktop.in" >"$ARQUIVO"
chmod +x "$ARQUIVO" "$RAIZ/scripts/biblelinux.sh"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESTINO" >/dev/null 2>&1

echo "Atalho instalado em $ARQUIVO"
echo "Procure por \"BibleLinux\" no menu de aplicativos."
