#!/usr/bin/env bash
# 사업자등록증 · 계약서 → 드라이브 + 통합 시트 탭
#
# 사용법:
#   bash "도구/업체기록.sh" 사업자 "<사업자등록증 이미지·PDF>" \
#        "업체명=인디언" "브랜드=어반캠핑 인디언바베큐" "등록번호=141-05-47000" \
#        "대표자=김동욱" "개업일=2013-07-01" "소재지=…" "업태=…" "종목=…" "과세유형=일반과세자"
#
#   bash "도구/업체기록.sh" 계약 "<계약서.pdf>" \
#        "구분=업체계약서" "업체명=인디언" "브랜드=어반캠핑 인디언바베큐" \
#        "계약명=…" "상대방=김동욱" "계약일=2026-09-14" "계약기간=…" \
#        "계약금액=5,060,000" "공급가액=4,600,000" "세액=460,000" "연결견적서=…" "등록번호=…"
#
#   bash "도구/업체기록.sh" 조회 "" "업체명=인디언"     ← 계약서 작성용 자료 (사업자 + 견적서 이력)
#
# ★ 들어가는 곳
#   사업자 → 드라이브 `사업자등록증` 폴더 + `사업자등록증` 탭 (등록번호가 같으면 갱신)
#   계약   → 드라이브 `계약서` 폴더 + `계약서 이력` 탭 + `광고주 관리` 탭 `계약서` 행(업체계약서만) ((구분, 업체명, 계약명, 상대방)이 같으면 갱신)
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. 업체명은 **사업자등록증 상호**다. 브랜드명을 넣으면 계약서·견적과 이어지지 않는다.
# 2. 구분은 `업체계약서`(1-7, 광고주와) / `인플루언서계약서`(1-6, 인플루언서 개인과) 둘 뿐이다.
# 3. **주민번호·계좌번호는 인자로 넘기지 않는다.** 시트 칸에 남으면 안 된다. PDF 안에만 둔다.
# 4. 셸 변수명은 ASCII, JSON 은 perl(use utf8) 로 만든다 — 견적올리기.sh 와 같은 이유.
# 5. .gs 를 고쳤으면 `bash 도구/앱스푸시.sh 배포` 를 해야 웹앱에 반영된다.

set -euo pipefail

MODE="${1:-}"; SRC="${2:-}"
shift 2 || true
case "$MODE" in 사업자|계약|조회) ;; *)
  echo '사용법: bash "도구/업체기록.sh" 사업자|계약|조회 "<파일>" "키=값" …' >&2; exit 1;; esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVFILE="$ROOT/연동/.env"
URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
[[ -n "${URL:-}" && -n "${KEY:-}" ]] || {
  echo "오류: $ENVFILE 에 공고가이드_웹앱 / 공고가이드_비밀키 가 필요합니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
printf '%s\n' "$@" > "$TMP/args.txt"
: > "$TMP/file.b64"
if [[ "$MODE" != "조회" ]]; then
  [[ -f "$SRC" ]] || { echo "오류: 파일이 없습니다: $SRC" >&2; exit 1; }
  base64 -w0 < "$SRC" > "$TMP/file.b64" 2>/dev/null || base64 < "$SRC" | tr -d '\n' > "$TMP/file.b64"
fi

cat > "$TMP/req.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;
use Encode qw(decode);
use JSON::PP;
my ($key, $mode, $argfile, $b64file, $fname, $out) = @ARGV;
$key =~ s/[^A-Za-z0-9_-]//g;
$mode = decode('UTF-8', $mode);
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
die "주민번호·계좌번호는 넘기지 않습니다\n" if grep { /주민|계좌/ } keys %v;
local $/;
open(my $B, '<:raw', $b64file) or die $!;
my $b64 = <$B>; close $B; $b64 =~ s/\s+//g;
my $name = decode('UTF-8', $fname);
my %req = ('비밀키' => $key);
if ($mode eq '조회') {
  %req = (%req, '동작' => '업체자료', '업체명' => ($v{'업체명'} // ''));
} elsif ($mode eq '사업자') {
  my $ext = lc(($name =~ /\.([^.]+)$/)[0] // 'png');
  my %mime = (png => 'image/png', jpg => 'image/jpeg', jpeg => 'image/jpeg', pdf => 'application/pdf');
  %req = (%req, '동작' => '사업자등록기록',
          '자료' => { %v, '파일명' => $name, '파일' => $b64, '형식' => ($mime{$ext} // 'image/png') });
} else {
  %req = (%req, '동작' => '계약서기록', '자료' => { %v, '파일명' => $name, 'pdf' => $b64 });
}
open(my $O, '>:raw', $out) or die $!;
print $O encode_json(\%req);
close $O;
PERLEOF

perl "$TMP/req.pl" "$KEY" "$MODE" "$TMP/args.txt" "$TMP/file.b64" "$(basename "${SRC:-x}")" "$TMP/req.json"
echo "보냅니다…"
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
if (exists $r->{'사업자'}) { print JSON::PP->new->utf8(0)->pretty->canonical->encode($r); exit 0 }
print "«", $r->{'탭'}, "» ", $r->{'행'}, "행에 기록했습니다.\n";
print "  파일 : ", $r->{'링크'}, "\n" if $r->{'링크'};
for my $s (@{ $r->{'광고주관리'} || [] }) { print "  광고주 관리: $s\n" }
PERLEOF
perl "$TMP/show.pl" "$TMP/res.json"
