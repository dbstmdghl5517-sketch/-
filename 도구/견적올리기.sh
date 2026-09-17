#!/usr/bin/env bash
# 견적서 PDF → 드라이브 + 견적 이력 탭 + 광고주 관리 탭
#
# 사용법:
#   bash "도구/견적올리기.sh" "<견적서.pdf 또는 .html>" \
#        "업체명=프라임매니지먼트" "브랜드=트레블로지 스위트 부산 센텀" \
#        "견적명=…" "품명=…" "수량=19" "단가=80,000" \
#        "공급가액=1,500,000" "세액=150,000" "견적금액=1,650,000"
#
#   기업명이 여러 열에 겹치거나 시트 이름과 상호가 다르면 열 번호로 지정한다
#        "열=4"    ← D열
#
# ★ 왜 만들었나
#   견적서는 PC 폴더에만 남고 시트에 아무 기록이 없었다. 공고(3-1·4·5-1·6)는
#   시트·노션까지 자동으로 가는데 견적만 빠져 있었다. 나중에 «얼마에 보냈더라»를
#   찾을 방법이 없다. 이제 견적서를 만들면 이걸 같이 돌린다.
#
# ★ 들어가는 곳 세 군데
#   1) 드라이브 `견적서` 폴더 — PDF (시트에서 바로 열린다)
#   2) `견적 이력` 탭        — 한 줄. 같은 (업체명, 견적명) 이면 그 줄을 갱신한다
#   3) `광고주 관리` 탭      — 업체 열의 `견적금액` · `견적서` 행
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. **셸 변수명에 한글을 쓸 수 없다.** 변수명은 ASCII 로 둔다.
# 2. **업체명과 브랜드명은 다르다.** 광고주 관리 열은 **업체명**으로 찾는다.
#    브랜드명(트레블로지 …)으로 찾으면 열이 없어 건너뛴다.
# 3. 웹앱은 302 로 응답하므로 -L 이 필요하다. `-X POST` 와 같이 쓰면 두 번 실행된다.
# 4. **JSON 은 perl 로 만든다.** use utf8 이 없으면 한글 키가 이중 인코딩되어
#    「비밀키 불일치」가 난다.
# 5. PDF 는 base64 로 실어 보낸다. 셸 변수에 담지 말고 파일째 다룬다.

set -euo pipefail

SRC="${1:-}"
shift || true
[[ -n "$SRC" ]] || { echo '사용법: bash "도구/견적올리기.sh" "<견적서.pdf>" "업체명=…" …' >&2; exit 1; }

# html 을 넘기면 같은 이름의 pdf 를 찾는다
PDF="$SRC"
[[ "$PDF" == *.html ]] && PDF="${SRC%.html}.pdf"
[[ -f "$PDF" ]] || { echo "오류: PDF 가 없습니다: $PDF" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVFILE="$ROOT/연동/.env"
URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
[[ -n "${URL:-}" && -n "${KEY:-}" ]] || {
  echo "오류: $ENVFILE 에 공고가이드_웹앱 / 공고가이드_비밀키 가 필요합니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf '%s\n' "$@" > "$TMP/args.txt"
base64 -w0 < "$PDF" > "$TMP/pdf.b64" 2>/dev/null || base64 < "$PDF" | tr -d '\n' > "$TMP/pdf.b64"

cat > "$TMP/req.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;                      # 없으면 한글 키가 이중 인코딩된다 (함정 4)
use Encode qw(decode);
use JSON::PP;
my ($key, $argfile, $b64file, $fname, $out) = @ARGV;
$key =~ s/[^A-Za-z0-9_-]//g;

my %v;
open(my $A, '<:encoding(UTF-8)', $argfile) or die $!;
while (my $l = <$A>) {
  chomp $l;
  next unless $l =~ /^([^=]+)=(.*)$/;
  my ($k, $val) = ($1, $2);
  $k =~ s/^\s+|\s+$//g; $val =~ s/^\s+|\s+$//g;
  $v{$k} = $val;
}
close $A;
die "업체명이 필요합니다\n" unless ($v{'업체명'} // '') ne '';

local $/;
open(my $B, '<:raw', $b64file) or die $!;
my $b64 = <$B>; close $B; $b64 =~ s/\s+//g;

$v{'파일명'} = decode('UTF-8', $fname);
$v{'pdf'}   = $b64;

open(my $O, '>:raw', $out) or die $!;
print $O encode_json({ '비밀키' => $key, '동작' => '견적기록', '견적' => \%v });
close $O;
print "PDF ", int(length($b64) * 3 / 4 / 1024), "KB\n";
PERLEOF

SIZE="$(perl "$TMP/req.pl" "$KEY" "$TMP/args.txt" "$TMP/pdf.b64" "$(basename "$PDF")" "$TMP/req.json")"
echo "올립니다… ($SIZE)"

CODE=$(curl -sS -L --max-time 540 -H 'Content-Type: application/json' \
  --data-binary "@$TMP/req.json" -o "$TMP/res.json" -w '%{http_code}' "$URL") || {
  echo "오류: 호출 실패" >&2; exit 1; }
if [[ "$CODE" != "200" ]]; then
  echo "오류: HTTP $CODE" >&2; head -c 300 "$TMP/res.json" >&2; echo >&2; exit 1
fi

cat > "$TMP/show.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;
use JSON::PP;
binmode(STDOUT, ':encoding(UTF-8)');
local $/;
open(my $F, '<:raw', $ARGV[0]) or die $!;
my $r = decode_json(<$F>); close $F;
if (!$r->{'성공'}) { print "실패: ", ($r->{'오류'} // ''), "\n"; exit 2 }
print "견적 이력 «", $r->{'탭'}, "» ", $r->{'행'}, "행에 기록했습니다.\n";
print "  PDF : ", $r->{'링크'}, "\n" if $r->{'링크'};
for my $s (@{ $r->{'광고주관리'} || [] }) { print "  광고주 관리: $s\n" }
PERLEOF
perl "$TMP/show.pl" "$TMP/res.json"
