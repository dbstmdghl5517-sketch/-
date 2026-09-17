#!/usr/bin/env bash
# 5-1 가이드 데이터.json → 구글 문서 (브랜드별 한 건씩)
#
# 사용법:  bash "도구/가이드문서.sh" "<데이터.json>"
#     예)  bash "도구/가이드문서.sh" \
#            "공고/5-1 기획형 인플루언서 공고 가이드/_작업/데이터.json"
#
# ★ 왜 만들었나
#   전에는 생성기가 만든 데이터.gs 를 편집기에 붙여넣고 [실행] 을 눌러야 했다.
#   붙여넣기 단계에서 엉뚱한 파일에 넣거나 옛 버전이 들어가는 사고가 반복됐다.
#   이제 웹앱으로 바로 넘긴다. 사람 손이 닿지 않는다.
#
# ★ 같은 브랜드의 기존 문서는 휴지통으로 가고 새로 만들어진다.
#   최초 작성일은 데이터.json 에 담겨 오므로 다시 만들어도 날짜가 안 바뀐다.
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. **셸 변수명에 한글을 쓸 수 없다.** 변수명은 ASCII 로 둔다.
# 2. 웹앱은 302 로 응답하므로 -L 이 필요하다. `-X POST` 와 같이 쓰면 두 번 실행된다.
# 3. 데이터.json 이 크다. 셸 변수에 담지 말고 **파일째로** 보낸다.
#    JSON 을 문자열로 이어 붙이면 따옴표·줄바꿈에서 깨진다.
# 4. 이 동작은 웹앱 코드다. 구글문서생성.gs 를 고쳤으면
#    «bash 도구/앱스푸시.sh 배포» 로 배포까지 해야 반영된다.

set -euo pipefail

DATA="${1:-}"
[[ -n "$DATA" && -f "$DATA" ]] || {
  echo '사용법: bash "도구/가이드문서.sh" "<데이터.json>"' >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVFILE="$ROOT/연동/.env"
[[ -f "$ENVFILE" ]] || { echo "오류: $ENVFILE 이 없습니다." >&2; exit 1; }

URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
[[ -n "${URL:-}" && -n "${KEY:-}" ]] || {
  echo "오류: $ENVFILE 에 공고가이드_웹앱 / 공고가이드_비밀키 가 필요합니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 요청 본문을 perl 로 만든다 (함정 3). 데이터는 파일에서 읽어 그대로 끼운다.
cat > "$TMP/req.pl" <<'PERLEOF'
use strict; use warnings;
# ★ use utf8 가 없으면 '비밀키' 같은 한글 키가 **이중 인코딩**된다.
#   서버는 그 키를 못 알아보고 「비밀키 불일치」로 막는다. 실제로 그렇게 막혔다.
use utf8;
use JSON::PP;
my ($key, $datafile, $out) = @ARGV;
$key =~ s/[^A-Za-z0-9_-]//g;
local $/;
open(my $F, '<:raw', $datafile) or die "데이터: $!";
my $data = decode_json(<$F>); close $F;
die "데이터.json 이 배열이 아닙니다\n" unless ref($data) eq 'ARRAY';
die "데이터.json 이 비어 있습니다\n" unless @$data;
open(my $O, '>:raw', $out) or die $!;
print $O encode_json({ '비밀키' => $key, '동작' => '가이드문서', '데이터' => $data });
close $O;
print scalar(@$data), "\n";
PERLEOF

COUNT="$(perl "$TMP/req.pl" "$KEY" "$DATA" "$TMP/req.json")"
echo "브랜드 ${COUNT}건을 구글 문서로 만듭니다…"

CODE=$(curl -sS -L --max-time 540 -H 'Content-Type: application/json' \
  --data-binary "@$TMP/req.json" -o "$TMP/res.json" -w '%{http_code}' "$URL") || {
  echo "오류: 호출 실패" >&2; exit 1; }
if [[ "$CODE" != "200" ]]; then
  echo "오류: HTTP $CODE" >&2; head -c 300 "$TMP/res.json" >&2; echo >&2; exit 1
fi
if grep -qi '<html' "$TMP/res.json"; then
  echo "오류: JSON 대신 HTML 이 왔습니다. 배포 설정을 확인하세요." >&2; exit 1
fi

cat > "$TMP/show.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;                 # 한글 리터럴이 깨지지 않게
use JSON::PP;
binmode(STDOUT, ':encoding(UTF-8)');
local $/;
open(my $F, '<:raw', $ARGV[0]) or die $!;
my $r = decode_json(<$F>); close $F;
if (!$r->{'성공'}) { print "실패: ", ($r->{'오류'} // ''), "\n"; exit 2 }
print "완료 ", ($r->{'건수'} // 0), "건  (", ($r->{'시각'} // ''), ")\n";
for my $d (@{ $r->{'문서'} || [] }) {
  my $name = ref($d) eq 'HASH' ? ($d->{'이름'} // $d->{'브랜드'} // '') : $d;
  my $url  = ref($d) eq 'HASH' ? ($d->{'url'} // $d->{'링크'} // '') : '';
  print "  · $name\n";
  print "      $url\n" if $url;
}
print "관리 시트: $r->{'관리시트'}\n" if $r->{'관리시트'};
print "폴더     : $r->{'폴더'}\n"   if $r->{'폴더'};
PERLEOF
perl "$TMP/show.pl" "$TMP/res.json"
