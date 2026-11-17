#!/usr/bin/env bash
# 견적서 HTML → A4 세로 미리보기 PNG + PDF 생성
#
# 사용법:  bash "도구/미리보기.sh" "견적/발행/2026/2026-09-12_위캔필라테스_인스타블로그체험단.html"
# 결과:    같은 폴더에 .png (A4 세로 이미지) 와 .pdf 를 만든다.

set -euo pipefail

HTML="${1:-}"
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "오류: HTML 파일 경로를 넘겨주세요. 예) bash '도구/미리보기.sh' '견적/발행/2026/....html'" >&2
  exit 1
fi

# 브라우저 탐색 (Chrome → Edge)
BROWSER=""
for p in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  "/c/Program Files/Microsoft/Edge/Application/msedge.exe" ; do
  [[ -x "$p" ]] && { BROWSER="$p"; break; }
done
[[ -z "$BROWSER" ]] && { echo "오류: Chrome 또는 Edge를 찾지 못했습니다." >&2; exit 1; }

# 크롬은 상대 경로를 자기 작업 디렉터리 기준으로 해석하므로 반드시 절대 경로로 넘긴다
ABS="$(cd "$(dirname "$HTML")" && pwd)/$(basename "$HTML")"
BASE="${ABS%.html}"
URL="file:///$(cygpath -m "$ABS")"
PNG_W="$(cygpath -w "$BASE.png")"
PDF_W="$(cygpath -w "$BASE.pdf")"

# 이전 결과를 먼저 지운다. 남아 있으면 브라우저가 실패해도 옛 파일을 보고 「성공」 으로 알린다.
# 지워지지 않으면 뷰어에 열려 있는 것이다.
for f in "$BASE.png" "$BASE.pdf"; do
  rm -f "$f" 2>/dev/null || true
  [[ -e "$f" ]] && { echo "오류: $(basename "$f") 가 열려 있어 덮어쓸 수 없습니다. 닫고 다시 실행하세요." >&2; exit 1; }
done

# A4 세로 794×1123px(96dpi) 기준, 2배 해상도로 선명하게
"$BROWSER" --headless --disable-gpu --hide-scrollbars \
  --window-size=794,1123 --force-device-scale-factor=2 \
  --screenshot="$PNG_W" "$URL" >/dev/null 2>&1

"$BROWSER" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PDF_W" "$URL" >/dev/null 2>&1

[[ -f "$BASE.png" ]] || { echo "오류: PNG 생성 실패" >&2; exit 1; }
[[ -f "$BASE.pdf" ]] || { echo "오류: PDF 생성 실패" >&2; exit 1; }

echo "PNG : ${BASE#$(pwd)/}.png"
echo "PDF : ${BASE#$(pwd)/}.pdf"

# 페이지 수 확인 (1페이지를 벗어나면 경고)
if command -v grep >/dev/null; then
  CNT=$(grep -ao '/Count [0-9]*' "$BASE.pdf" 2>/dev/null | head -1 | tr -dc '0-9' || echo "")
  if [[ -n "$CNT" && "$CNT" != "1" ]]; then
    echo "경고: PDF가 ${CNT}페이지입니다. 항목 수를 줄이거나 양식을 확인하세요." >&2
  fi
fi
