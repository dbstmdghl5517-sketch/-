#!/usr/bin/env bash
# TSV → XLSX + PDF 변환 (Microsoft Excel COM)
#
# 사용법:
#   bash "도구/표변환.sh" "<tsv경로>" "<출력폴더>" "<파일명(확장자 제외)>"
# 예:
#   bash "도구/표변환.sh" "공고/5-1 .../공고가이드_항목.tsv" "공고/5-1 ..." "기획형 인플루언서 공고 가이드"
#
# 데이터는 TSV 로 관리한다(깃 diff 가 읽히고 수정이 쉽다).
# XLSX·PDF 는 산출물이므로 TSV 만 고치고 다시 실행하면 된다.
#
# 겪었던 함정들:
#  1) 산출물이 뷰어에 열려 있으면 덮어쓰기가 조용히 실패한다 → 임시 폴더에 만든 뒤 mv
#  2) 임시 .ps1 은 반드시 UTF-8 with BOM (PowerShell 5.1 이 ANSI 로 읽으면 한글 깨짐)
#  3) 앞선 실행이 남긴 EXCEL.EXE 가 새 인스턴스를 멈추게 한다 → 먼저 정리
#  4) 확장자가 .tsv 면 Excel 가져오기 마법사가 떠서 멈춘다 → .txt 로 복사 후 OpenText 로 연다
#  5) Workbook.SaveAs 는 슬래시 경로를 받지 못한다. 'C:/a/b' 를 주면 'C:\//a/b' 로 깨진다.
#     OpenText 는 슬래시를 받지만 SaveAs 는 아니므로, 백슬래시 경로를 써야 한다.
#  6) 백슬래시 경로를 sed 치환으로 넣으면 \t, \U 등 이스케이프로 해석돼 또 깨진다.
#     → PS 본문은 확장 없는 heredoc(<<'PSEOF')으로 쓰고, 경로는 printf '%s' 로
#       변수 선언 줄을 앞에 붙여 넣는다. printf %s 는 백슬래시를 건드리지 않는다.
#  7) Visible=$false 면 ActiveWindow 가 없을 수 있다 → 틀 고정은 try/catch 로 감싼다

set -euo pipefail

TSV="${1:-}"; OUTDIR="${2:-}"; NAME="${3:-}"
if [[ -z "$TSV" || -z "$OUTDIR" || -z "$NAME" ]]; then
  echo '사용법: bash "도구/표변환.sh" "<tsv경로>" "<출력폴더>" "<파일명(확장자 제외)>"' >&2
  exit 1
fi
[[ -f "$TSV" ]] || { echo "오류: TSV 파일이 없습니다 - $TSV" >&2; exit 1; }

mkdir -p "$OUTDIR"
OUT="$(cd "$OUTDIR" && pwd)"
SRC="$(cd "$(dirname "$TSV")" && pwd)/$(basename "$TSV")"

NAME="$(printf '%s' "$NAME" | tr -d '\\/:*?"<>|')"
XLSX="$OUT/$NAME.xlsx"
PDF="$OUT/$NAME.pdf"

TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT

# Excel 텍스트 가져오기는 UTF-8 BOM 이 있어야 한글을 제대로 읽는다
TSRC="$TMPD/src.txt"
printf '\xEF\xBB\xBF' > "$TSRC"
cat "$SRC" >> "$TSRC"

TXLSX="$TMPD/out.xlsx"
TPDF="$TMPD/out.pdf"

taskkill //F //IM EXCEL.EXE >/dev/null 2>&1 || true

PS="$TMPD/run.ps1"
printf '\xEF\xBB\xBF' > "$PS"
# 경로는 변수 선언으로 주입한다 (함정 5·6)
printf '%s\n' "\$srcPath  = '$(cygpath -w "$TSRC")'"  >> "$PS"
printf '%s\n' "\$xlsxPath = '$(cygpath -w "$TXLSX")'" >> "$PS"
printf '%s\n' "\$pdfPath  = '$(cygpath -w "$TPDF")'"  >> "$PS"
cat >> "$PS" <<'PSEOF'
$ErrorActionPreference = 'Stop'
$x = New-Object -ComObject Excel.Application
$x.Visible = $false
$x.DisplayAlerts = $false
try {
  # DataType 1 = xlDelimited, Origin 65001 = UTF-8, 탭 구분자만 사용
  $x.Workbooks.OpenText($srcPath, 65001, 1, 1, 1, $false, $true, $false, $false, $false, $false) | Out-Null
  $wb = $x.ActiveWorkbook
  $ws = $wb.Worksheets.Item(1)
  $ws.Name = '항목'

  $used = $ws.UsedRange
  $rows = $used.Rows.Count
  $cols = $used.Columns.Count

  $hdr = $ws.Range($ws.Cells(1,1), $ws.Cells(1,$cols))
  $hdr.Font.Bold = $true
  $hdr.Interior.Color = 15921906
  $hdr.HorizontalAlignment = -4108

  $used.Borders.LineStyle = 1
  $used.VerticalAlignment = -4160
  $used.WrapText = $true
  $ws.Rows.Item(1).RowHeight = 22

  $widths = @(16, 6, 24, 10, 6, 70)
  for ($i = 1; $i -le $cols; $i++) {
    if ($i -le $widths.Count) { $ws.Columns.Item($i).ColumnWidth = $widths[$i-1] }
  }
  $ws.Rows.Item("2:$rows").AutoFit() | Out-Null

  try { $x.ActiveWindow.SplitRow = 1; $x.ActiveWindow.FreezePanes = $true } catch {}

  $ws.PageSetup.Orientation    = 2   # xlLandscape
  $ws.PageSetup.PaperSize      = 9   # xlPaperA4
  $ws.PageSetup.Zoom           = $false
  $ws.PageSetup.FitToPagesWide = 1
  $ws.PageSetup.FitToPagesTall = $false
  try { $ws.PageSetup.PrintTitleRows = '$1:$1' } catch {}

  $wb.SaveAs($xlsxPath, 51)                 # 51 = xlOpenXMLWorkbook
  $wb.ExportAsFixedFormat(0, $pdfPath)      # 0  = xlTypePDF
  $wb.Close($false)
  Write-Output 'OK'
} catch {
  Write-Output ('ERR: ' + $_.Exception.Message)
} finally {
  $x.Quit()
}
PSEOF

RESULT="$(powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$PS")" 2>&1 | tr -d '\r' | grep -v '^[[:space:]]*$' | tail -1)"
[[ "$RESULT" == "OK" ]] || { echo "변환 실패: $RESULT" >&2; exit 1; }
[[ -s "$TXLSX" ]] || { echo "XLSX 생성 실패" >&2; exit 1; }
[[ -s "$TPDF" ]]  || { echo "PDF 생성 실패" >&2; exit 1; }

for pair in "$TXLSX|$XLSX" "$TPDF|$PDF"; do
  src="${pair%%|*}"; dst="${pair#*|}"
  if ! mv -f "$src" "$dst" 2>/dev/null; then
    echo "오류: 아래 파일을 덮어쓸 수 없습니다. 열려 있으면 닫고 다시 실행하세요." >&2
    echo "      $dst" >&2
    exit 1
  fi
done

echo "XLSX : $OUTDIR/$NAME.xlsx"
echo "PDF  : $OUTDIR/$NAME.pdf"
