#!/bin/bash
# Lotin <-> Kirill: Word add-in installer for macOS.
# Run in Terminal:  curl -fsSL https://abdullohukr.github.io/uz-lotin-kirill/mac.sh | bash
# Uninstall:        curl -fsSL https://abdullohukr.github.io/uz-lotin-kirill/mac-uninstall.sh | bash
# Also saves the offline macro (VBA) to ~/Documents/Lotin-Kirill for use without internet.
set -e
SITE="https://abdullohukr.github.io/uz-lotin-kirill"
REPO="https://raw.githubusercontent.com/abdullohukr/uz-lotin-kirill/main"
WORD="$HOME/Library/Containers/com.microsoft.Word/Data"
WEF="$WORD/Documents/wef"
DOCS="$HOME/Documents/Lotin-Kirill"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

if [ ! -d "/Applications/Microsoft Word.app" ]; then
  echo "Microsoft Word topilmadi / Microsoft Word не найден."; exit 1
fi

if pgrep -x "Microsoft Word" >/dev/null; then
  say "Word yopilmoqda (saqlanmagan hujjatlarni saqlang) / Закрываем Word (сохраните документы)"
  osascript -e 'quit app "Microsoft Word"' >/dev/null 2>&1 || true
  for i in $(seq 1 60); do pgrep -x "Microsoft Word" >/dev/null || break; sleep 1; done
  if pgrep -x "Microsoft Word" >/dev/null; then
    echo "Word hali ochiq. Uni yoping (Cmd+Q) va buyruqni qayta ishga tushiring."
    echo "Word всё ещё открыт. Закройте его (Cmd+Q) и запустите команду снова."; exit 1
  fi
fi

say "1/3  Word add-in: Lotin ⇄ Kirill"
mkdir -p "$WEF"
rm -f "$WEF/uz-lotin-kirill.manifest.xml"            # older manual installs
curl -fsSL "$SITE/manifest.xml" -o "$WEF/uz-lotin-kirill.xml"
echo "  $WEF/uz-lotin-kirill.xml"

say "2/3  Offline macro (VBA) -> $DOCS"
mkdir -p "$DOCS"
if curl -fsSL "$REPO/vba/UzLotinKirill.bas" -o "$DOCS/UzLotinKirill.bas"; then
  echo "  $DOCS/UzLotinKirill.bas"
else
  echo "  ! not available now, skipped"
fi

say "3/3  Clearing Word's add-in cache / Кэш надстроек Word"
# Word shows the task pane from its WebKit cache; clear it so the current version is loaded
rm -rf "$WORD/Library/Caches/WebKit/NetworkCache" 2>/dev/null || true

say "Tayyor. Word'ni oching: «Lotin-Kirill» yorlig'ida Kirillga / Lotinga / Panel tugmalari.
Agar yorliq ko'rinmasa: Qo'shish (Insert) -> Надстройки -> Мои надстройки -> Lotin ⇄ Kirill.
Готово. Откройте Word: вкладка «Lotin-Kirill», кнопки Kirillga / Lotinga / Panel.
Если вкладки нет: Вставка -> Надстройки -> Мои надстройки -> Lotin ⇄ Kirill."
