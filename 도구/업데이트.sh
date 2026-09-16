#!/usr/bin/env bash
# 자동화 현황 확인 — 사용자가 「업데이트」 라고 할 때 돌린다
#
# 사용법:  bash "도구/업데이트.sh"
#
# 매일 오전 6시 보고 메일과 **같은 함수**(통합관리.gs 의 현황요약)를 쓴다.
# 두 곳에서 따로 계산하면 숫자가 어긋난다.
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. 셸 변수명에 한글을 쓸 수 없다. 변수명은 ASCII 로 둔다.
# 2. 웹앱은 302 로 응답하므로 -L 이 필요하다. `-X POST` 와 같이 쓰면 두 번 실행된다.
# 3. `.gs` 를 고치면 「배포 관리 → 편집 → 새 버전」 으로 다시 배포해야 반영된다.
# 4. 읽은 내용에 업체명이 들어 있다. 연락처는 들어오지 않지만 그대로 외부에 옮기지 않는다.

set -euo pipefail

ENVFILE="연동/.env"
[[ -f "$ENVFILE" ]] || { echo "오류: $ENVFILE 이 없습니다." >&2; exit 1; }
URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
[[ -n "${URL:-}" && -n "${KEY:-}" ]] || {
  echo "오류: $ENVFILE 에 공고가이드_웹앱 / 공고가이드_비밀키 가 필요합니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf '{"비밀키":"%s","동작":"현황요약"}' "$KEY" > "$TMP/req.json"

CODE=$(curl -sS -L --max-time 300 -H 'Content-Type: application/json' \
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
my $s = decode_json(<$F>); close $F;
if (!$s->{'성공'}) { print "실패: ", ($s->{'오류'} // ''), "\n"; exit 2 }

print "자동화 현황  ($s->{'시각'})\n";
print '=' x 62, "\n";

print "\n■ 업체 현황\n";
my $상 = $s->{'상태별'} || {};
printf("   %-10s %d개\n", $_, $상->{$_}) for sort keys %$상;
printf("   %-10s %d개\n", '진행완료 탭', $s->{'진행완료탭'} // 0);
printf("   %-10s %d개\n", '불발 탭',     $s->{'불발탭'}     // 0);

print "\n■ 발행 이력\n";
my $이 = $s->{'발행이력'} || {};
if (keys %$이) { printf("   %-14s %d건\n", $_, $이->{$_}) for sort keys %$이 }
else { print "   (없음)\n" }
printf("   %-14s %d건\n", '5-0 신청서 누적', $s->{'5-0응답'} // 0);

my $임 = $s->{'불발임박'} || [];
if (@$임) {
  print "\n■ 불발 임박 (3주 기준)\n";
  printf("   %-22s %-8s %2d일 무변화 / %2d일 남음\n",
         $_->{'업체'}, $_->{'상태'}, $_->{'무변화'}, $_->{'남은일'}) for @$임;
  print "   ※ 내용을 고치면 시계가 다시 시작됩니다.\n";
}

my $빈 = $s->{'브랜드명빈칸'} || [];
if (@$빈) {
  print "\n■ 5-0 브랜드명이 비어 진행 현황이 안 붙는 업체 (", scalar(@$빈), "개)\n";
  print "   ", join(', ', @$빈), "\n";
}

my $공 = $s->{'공고없음'} || [];
if (@$공) {
  print "\n■ 가이드는 있고 공고는 아직 없는 건 (", scalar(@$공), "건)\n";
  print "   $_\n" for @$공;
}

print "\n■ 돌고 있는 자동화\n";
my $트 = $s->{'트리거'} || {};
if (keys %$트) { printf("   %-16s ×%d\n", $_, $트->{$_}) for sort keys %$트 }
else { print "   (없음)\n" }

for my $k ('상태별오류', '이력오류', '추적오류') {
  print "\n[오류] $k: $s->{$k}\n" if $s->{$k};
}
PERLEOF
perl "$TMP/show.pl" "$TMP/res.json"
