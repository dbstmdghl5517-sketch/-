#!/usr/bin/env bash
# 3-1 체험단 가이드 → 브랜드·채널별 구글 문서 + 발행 이력 기록
#
# 사용법:  bash "도구/체험단문서.sh" "<3-1 데이터.json>"
#
# 왜 있는가
#   기획형(5-1)은 구글 문서가 만들어져 발행 이력에 링크가 남는다.
#   체험단(3-1)은 로컬 DOCX·PDF 뿐이라 이력의 「가이드 문서」 칸이 비어 있었다.
#   기획형과 같은 모양으로 맞추기 위해 구글 문서를 만든다.
#
#   채널별 제작 기준·기본 제작 안내 문구는 데이터에 실려 간다.
#   양식(가이드_양식.html)이 유일한 기준이어야 해서, Apps Script 에 또 적지 않는다.
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. 셸 변수명에 한글을 쓸 수 없다. 변수명은 ASCII 로 둔다.
# 2. encode_json 은 UTF-8 바이트를 돌려준다. 핸들에 :utf8 을 걸면 이중 인코딩된다.
# 3. 웹앱은 302 로 응답하므로 -L 이 필요하다. `-X POST` 와 같이 쓰면 두 번 실행된다.
# 4. `.gs` 를 고치면 「배포 관리 → 편집 → 새 버전」 으로 다시 배포해야 반영된다.
# 5. 같은 브랜드·채널의 옛 문서는 스크립트가 휴지통으로 보낸다. 중복이 쌓이지 않는다.
# 6. 브랜드가 많으면 Apps Script 6분 제한에 걸린다. 12건은 문제없다.

set -euo pipefail

DATA="${1:-}"
if [[ -z "$DATA" || ! -f "$DATA" ]]; then
  echo "사용법: bash '도구/체험단문서.sh' '<3-1 _작업/데이터.json>'" >&2
  exit 1
fi

ENVFILE="연동/.env"
[[ -f "$ENVFILE" ]] || { echo "오류: $ENVFILE 이 없습니다." >&2; exit 1; }
URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
[[ -n "${URL:-}" && -n "${KEY:-}" ]] || {
  echo "오류: $ENVFILE 에 공고가이드_웹앱 / 공고가이드_비밀키 가 필요합니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/wrap.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;
use JSON::PP;
my ($src, $key, $out) = @ARGV;
$key =~ s/[^A-Za-z0-9_-]//g;
local $/;
open(my $F, '<:raw', $src) or die "데이터: $!";
my $데이터 = decode_json(<$F>); close $F;
die "데이터가 비어 있습니다.\n" unless ref $데이터 eq 'ARRAY' && @$데이터;
open(my $O, '>:raw', $out) or die $!;
print $O encode_json({ '비밀키' => $key, '동작' => '체험단문서', '데이터' => $데이터 });
close $O;
print STDERR "브랜드·채널 " . scalar(@$데이터) . "건\n";
PERLEOF
perl "$TMP/wrap.pl" "$DATA" "$KEY" "$TMP/req.json"

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
use utf8;
use JSON::PP;
binmode(STDOUT, ':encoding(UTF-8)');
local $/;
open(my $F, '<:raw', $ARGV[0]) or die $!;
my $d = decode_json(<$F>); close $F;
if (!$d->{'성공'}) { print "실패: ", ($d->{'오류'} // ''), "\n"; exit 2 }
print "완료 $d->{'건수'}건\n";
for my $x (@{ $d->{'문서'} || [] }) {
  printf("  [%s] %s (%s)\n        %s\n",
         $x->{'상태'}, $x->{'브랜드'}, $x->{'채널'}, $x->{'링크'} // '');
}
print "\n폴더: $d->{'폴더'}\n";
PERLEOF
perl "$TMP/show.pl" "$TMP/res.json"
