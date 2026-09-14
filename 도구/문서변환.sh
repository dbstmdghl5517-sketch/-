#!/usr/bin/env bash
# HTML → (DOCX 또는 HWP) + PDF 변환
#
# 사용법:
#   bash "도구/문서변환.sh" "<html경로>" "<출력폴더>" "<파일명(확장자 제외)>" [docx|hwp]
#     4번째 인자로 편집본 형식을 고른다. 생략하면 docx.
# 예:
#   bash "도구/문서변환.sh" "/tmp/초안.html" "광고 계약서 모음" "샘플업체_광고 계약서" hwp
#
# PDF 는 Chrome 으로 만든다 — HTML 을 그대로 렌더링하므로 원본 디자인이 100% 보존된다.
# 편집본(DOCX/HWP)은 각 오피스의 HTML 해석기를 쓰므로 레이아웃이 원본과 다를 수 있다.
#   - Word: 배경 이미지·절대위치 미지원
#   - 한글 2002(Hwp80): 이미지가 삽입되지 않음. 도장은 PDF 에만 찍힌다.
#
# 겪었던 함정들:
#  1) 산출물을 대상 경로에 바로 쓰면, 그 파일이 뷰어에 열려 있을 때 덮어쓰기가 조용히 실패한다.
#     파일은 존재하므로 성공으로 오인된다. → 임시 폴더에 만든 뒤 mv 로 옮기고 실패를 알린다.
#  2) 임시 .ps1 은 반드시 UTF-8 with BOM. 없으면 PowerShell 5.1 이 ANSI 로 읽어 한글 경로가 깨진다.
#  3) PowerShell 스크립트에 param()+Mandatory 를 쓰면 인자 바인딩 실패 시 stdin 프롬프트로 멈춘다.
#     → 경로를 박아 넣은 스크립트를 인자 없이 실행한다.
#  4) 콜드 스타트 Word 는 Documents.Open 에서 보이지 않는 대화상자로 멈춘다.
#     → 빈 문서를 한 번 만들었다 닫아 초기화한 뒤 연다.
#  5) 한글은 상대 경로 이미지(../)를 못 찾으면 보이지 않는 대화상자로 멈춘다.
#     → 절대 경로로 바꾼 사본을 넘긴다.
#  6) Word·한글 모두, 앞선 실행이 남긴 프로세스가 있으면 새 인스턴스도 같이 멈춘다.
#     → 실행 전에 정리한다.

set -euo pipefail

HTML="${1:-}"; OUTDIR="${2:-}"; NAME="${3:-}"; FMT="${4:-docx}"
if [[ -z "$HTML" || -z "$OUTDIR" || -z "$NAME" ]]; then
  echo '사용법: bash "도구/문서변환.sh" "<html경로>" "<출력폴더>" "<파일명(확장자 제외)>" [docx|hwp]' >&2
  exit 1
fi
[[ -f "$HTML" ]] || { echo "오류: HTML 파일이 없습니다 - $HTML" >&2; exit 1; }
[[ "$FMT" == "docx" || "$FMT" == "hwp" ]] || { echo "오류: 형식은 docx 또는 hwp 만 됩니다 - $FMT" >&2; exit 1; }

mkdir -p "$OUTDIR"
OUT="$(cd "$OUTDIR" && pwd)"
SRC="$(cd "$(dirname "$HTML")" && pwd)/$(basename "$HTML")"

# 파일명 금지문자만 제거 (대괄호는 유지)
NAME="$(printf '%s' "$NAME" | tr -d '\\/:*?"<>|')"
PDF="$OUT/$NAME.pdf"
DOCX="$OUT/$NAME.docx"
HWP="$OUT/$NAME.hwp"

TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT
TPDF="$TMPD/out.pdf"
TDOCX="$TMPD/out.docx"
THWP="$TMPD/out.hwp"

URL="file:///$(cygpath -m "$SRC")"

# ─── PDF: Chrome ───
BROWSER=""
for p in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "/c/Program Files/Microsoft/Edge/Application/msedge.exe"; do
  [[ -x "$p" ]] && { BROWSER="$p"; break; }
done
[[ -n "$BROWSER" ]] || { echo "오류: Chrome/Edge 를 찾지 못했습니다." >&2; exit 1; }

"$BROWSER" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$(cygpath -w "$TPDF")" "$URL" >/dev/null 2>&1
[[ -s "$TPDF" ]] || { echo "PDF 생성 실패" >&2; exit 1; }

# ─── 편집본 ───
PS="$(mktemp --suffix=.ps1)"
printf '\xEF\xBB\xBF' > "$PS"

if [[ "$FMT" == "hwp" ]]; then
  EDIT="$HWP"; TEDIT="$THWP"; LABEL="HWP"
  taskkill //F //IM Hwp.exe >/dev/null 2>&1 || true

  # 상대 경로 이미지를 절대 경로로 바꾼 사본을 만든다 (함정 5)
  HSRC="$TMPD/hwpsrc.html"
  SRCDIR_W="$(cygpath -m "$(dirname "$SRC")")"
  sed -e "s|src=\"\\.\\./|src=\"file:///$SRCDIR_W/../|g" \
      -e "s|src=\"이미지/|src=\"file:///$SRCDIR_W/이미지/|g" "$SRC" > "$HSRC"

  cat >> "$PS" <<PSEOF
\$ErrorActionPreference='Stop'
try {
  \$h = New-Object -ComObject HWPFrame.HwpObject
  # 보안 모듈을 등록하지 않으면 파일 접근 시 대화상자가 떠서 멈춘다
  try { \$h.RegisterModule("FilePathCheckDLL","FilePathCheckerModule") | Out-Null } catch {}
  \$h.Open("$(cygpath -w "$HSRC")", "HTML", "")
  \$h.SaveAs("$(cygpath -w "$THWP")", "HWP", "")
  Write-Output "OK"
} catch { Write-Output ("ERR: " + \$_.Exception.Message) }
finally { try { \$h.Quit() } catch {} }
PSEOF

else
  EDIT="$DOCX"; TEDIT="$TDOCX"; LABEL="DOCX"
  taskkill //F //IM WINWORD.EXE >/dev/null 2>&1 || true

  cat >> "$PS" <<PSEOF
\$ErrorActionPreference='Stop'
\$w = New-Object -ComObject Word.Application
\$w.Visible = \$false
\$w.DisplayAlerts = 0
try {
  \$warm = \$w.Documents.Add(); \$warm.Close(0)
  \$d = \$w.Documents.Open("$(cygpath -w "$SRC")", \$false, \$true)
  \$d.SaveAs2("$(cygpath -w "$TDOCX")", 16)   # 16 = wdFormatDocumentDefault (.docx)
  \$d.Close(0)
  Write-Output "OK"
} catch { Write-Output ("ERR: " + \$_.Exception.Message) }
finally { \$w.Quit() }
PSEOF
fi

RESULT="$(powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$PS")" 2>&1 | tr -d '\r' | tail -1)"
rm -f "$PS"
[[ "$RESULT" == "OK" ]] || { echo "$LABEL 변환 실패: $RESULT" >&2; exit 1; }
[[ -s "$TEDIT" ]] || { echo "$LABEL 생성 실패" >&2; exit 1; }

# ─── 제자리로 이동 ───
for pair in "$TPDF|$PDF" "$TEDIT|$EDIT"; do
  src="${pair%%|*}"; dst="${pair#*|}"
  if ! mv -f "$src" "$dst" 2>/dev/null; then
    echo "오류: 아래 파일을 덮어쓸 수 없습니다. 뷰어에서 열려 있으면 닫고 다시 실행하세요." >&2
    echo "      $dst" >&2
    exit 1
  fi
done

echo "$LABEL : $OUTDIR/$NAME.${FMT}"
echo "PDF  : $OUTDIR/$NAME.pdf"
