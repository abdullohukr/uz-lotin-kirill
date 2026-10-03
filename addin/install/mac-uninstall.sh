#!/bin/bash
# Lotin <-> Kirill: removes the Word add-in on macOS.
#   curl -fsSL https://abdullohukr.github.io/uz-lotin-kirill/mac-uninstall.sh | bash
WORD="$HOME/Library/Containers/com.microsoft.Word/Data"
rm -f "$WORD/Documents/wef/uz-lotin-kirill.xml" "$WORD/Documents/wef/uz-lotin-kirill.manifest.xml"
rm -rf "$WORD/Library/Caches/WebKit/NetworkCache" 2>/dev/null || true
echo "Lotin ⇄ Kirill o'chirildi / удалён. Word'ni qayta ishga tushiring / Перезапустите Word."
echo "Offline macro (if imported) stays in Normal.dotm: VBA editor -> Remove UzLotinKirill."
