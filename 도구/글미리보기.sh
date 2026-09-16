#!/usr/bin/env bash
# 공고 텍스트 → 미리보기 PDF · PNG
#
# 사용법:  bash "도구/글미리보기.sh" "<공고txt>" "<출력폴더>"
#          bash "도구/글미리보기.sh" "<폴더>/_목록.txt" "<출력폴더>" 목록
#
# 왜 있는가
#   4번·6번 공고는 표를 못 쓰는 업로드 화면에 맞춰 **순수 텍스트**로 만든다.
#   그런데 검토할 때는 PDF 가 편하다. 텍스트를 A4 로 그려 PDF·PNG 로 만든다.
#   이건 검토용이다. 실제 업로드는 원본 .txt 내용을 붙여 넣는다.
#
# 입력 형식 (4번·6번 생성기가 내보내는 그대로)
#   # 큰 제목 / ## 제목 / ### 작은 제목 / - 불릿 / 1. 번호 / --- 구분선
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. 셸 변수명에 한글을 쓸 수 없다. 변수명은 ASCII 로 둔다.
# 2. perl 한 줄 명령에 한글 패턴을 쓸 때는 -Mutf8 이 필요하다. 그래서 .pl 로 뺀다.
# 3. 이 PC 에는 크롬이 없고 엣지가 있다. 두 경로를 모두 찾아본다.
# 4. 브라우저는 상대 경로를 자기 작업 디렉터리로 해석한다. 반드시 절대 경로로 넘긴다.
# 5. 엣지 인스턴스가 겹치면 조용히 실패한다. --user-data-dir 을 건마다 다르게 준다.

set -euo pipefail

SRC="${1:-}"
OUTD="${2:-}"
MODE="${3:-단건}"

if [[ -z "$SRC" || -z "$OUTD" ]]; then
  echo "사용법: bash '도구/글미리보기.sh' '<공고txt>' '<출력폴더>' [목록]" >&2
  exit 1
fi
mkdir -p "$OUTD"

BROWSER=""
for p in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  "/c/Program Files/Microsoft/Edge/Application/msedge.exe" ; do
  [[ -x "$p" ]] && { BROWSER="$p"; break; }
done
[[ -n "$BROWSER" ]] || { echo "오류: 크롬·엣지를 찾지 못했습니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/html.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;
use Encode qw(encode decode);

my ($src, $out) = map { decode('UTF-8', $_) } @ARGV;
open(my $F, '<:encoding(UTF-8)', encode('UTF-8', $src)) or die "입력: $!";

sub esc {
  my ($s) = @_;
  $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g;
  return $s;
}

my @body;
my $목록열림 = 0;
sub 목록닫기 { if ($목록열림) { push @body, "</$목록열림>"; $목록열림 = 0 } }

while (my $l = <$F>) {
  $l =~ s/[\r\n]+$//;
  if ($l =~ /^\s*$/)              { 목록닫기(); next }
  if ($l =~ /^#\s+(.*)$/)         { 목록닫기(); push @body, '<h1>' . esc($1) . '</h1>'; next }
  if ($l =~ /^###\s+(.*)$/)       { 목록닫기(); push @body, '<h3>' . esc($1) . '</h3>'; next }
  if ($l =~ /^##\s+(.*)$/)        { 목록닫기(); push @body, '<h2>' . esc($1) . '</h2>'; next }
  if ($l =~ /^-{3,}\s*$/)         { 목록닫기(); push @body, '<hr>'; next }
  if ($l =~ /^\s*-\s+(.*)$/) {
    if ($목록열림 ne 'ul') { 목록닫기(); push @body, '<ul>'; $목록열림 = 'ul' }
    push @body, '<li>' . esc($1) . '</li>'; next;
  }
  if ($l =~ /^\s*\d+[.)]\s+(.*)$/) {
    if ($목록열림 ne 'ol') { 목록닫기(); push @body, '<ol>'; $목록열림 = 'ol' }
    push @body, '<li>' . esc($1) . '</li>'; next;
  }
  목록닫기();
  push @body, '<p>' . esc($l) . '</p>';
}
목록닫기();
close $F;

my $css = <<'CSS';
  @page { size: A4 portrait; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
         font-size: 10.5pt; color: #222; line-height: 1.75;
         margin: 0; padding: 16mm 14mm; }
  h1 { font-size: 17pt; margin: 0 0 10pt; color: #111; }
  h2 { font-size: 12.5pt; margin: 18pt 0 6pt; padding-bottom: 3pt;
       border-bottom: 1.5px solid #1F3864; color: #1F3864; }
  h3 { font-size: 11pt; margin: 12pt 0 4pt; color: #333; }
  p  { margin: 0 0 6pt; }
  ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
  li { margin-bottom: 3pt; }
  hr { border: 0; border-top: 1px solid #C5CEE0; margin: 12pt 0; }
  .note { font-size: 9pt; color: #888; margin: 0 0 14pt; }
CSS

my $이름 = $src; $이름 =~ s{.*[/\\]}{}; $이름 =~ s{\.txt$}{};

open(my $O, '>:encoding(UTF-8)', encode('UTF-8', $out)) or die "출력: $!";
print $O "<!DOCTYPE html>\n<html lang=\"ko\"><head><meta charset=\"UTF-8\">\n";
print $O "<title>", esc($이름), "</title>\n<style>\n$css</style></head><body>\n";
print $O "<p class=\"note\">검토용 미리보기입니다. 실제 업로드는 원본 텍스트를 붙여 넣습니다.</p>\n";
print $O join("\n", @body), "\n</body></html>\n";
close $O;
PERLEOF

만들기() {
  local txt="$1" idx="$2"
  local base; base="$(basename "$txt" .txt)"
  perl "$TMP/html.pl" "$txt" "$TMP/$base.html"
  local abs; abs="$(cd "$TMP" && pwd)/$base.html"
  local outabs; outabs="$(cd "$OUTD" && pwd)"
  "$BROWSER" --headless --disable-gpu --no-pdf-header-footer \
    --user-data-dir="$(cygpath -w "$TMP/u$idx")" \
    --print-to-pdf="$(cygpath -w "$outabs/$base.pdf")" \
    "file:///$(cygpath -m "$abs")" >/dev/null 2>&1 || true
  "$BROWSER" --headless --disable-gpu --hide-scrollbars \
    --window-size=794,1123 --force-device-scale-factor=2 \
    --user-data-dir="$(cygpath -w "$TMP/v$idx")" \
    --screenshot="$(cygpath -w "$outabs/$base.png")" \
    "file:///$(cygpath -m "$abs")" >/dev/null 2>&1 || true
  if [[ -f "$OUTD/$base.pdf" ]]; then
    local c; c=$(grep -ao '/Count [0-9]*' "$OUTD/$base.pdf" 2>/dev/null | head -1 | tr -dc '0-9' || true)
    echo "  ${c:-?}페이지  $base.pdf"
  else
    echo "  실패  $base" >&2
  fi
}

if [[ "$MODE" == "목록" ]]; then
  DIR="$(dirname "$SRC")"
  i=0
  while IFS= read -r n; do
    [[ -z "$n" ]] && continue
    i=$((i+1))
    만들기 "$DIR/$n.txt" "$i"
  done < "$SRC"
else
  만들기 "$SRC" 1
fi
