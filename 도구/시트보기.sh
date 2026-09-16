#!/usr/bin/env bash
# 비공개 구글 시트 내용 보기 (웹앱 경유, 읽기 전용)
#
# 사용법:  bash "도구/시트보기.sh" <시트> [탭] [최대행]
#          bash "도구/시트보기.sh" 통합              ← 탭 목록 + 첫 탭
#          bash "도구/시트보기.sh" 통합 "5-0 응답"
#          bash "도구/시트보기.sh" 통합 928374615 30  ← gid 로도 된다
#          bash "도구/시트보기.sh" 응답
#          bash "도구/시트보기.sh" 관리
#          bash "도구/시트보기.sh" <스프레드시트ID> "탭이름"
#
# 왜 이 도구가 있는가
#   광고주 관리 시트와 5-0 응답 시트를 비공개로 바꿨다. 계좌번호와 포포몬 계정
#   비밀번호가 링크만 알면 보이는 상태였기 때문이다. 그래서 CSV 내보내기로 읽던
#   방식(도구/시트받기.sh)이 막혔다. 이 도구는 비밀키를 아는 쪽만 쓸 수 있는
#   읽기 전용 통로다. 쓰기는 하지 않는다.
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. 셸 변수명에 한글을 쓸 수 없다. 변수명은 ASCII 로 둔다.
# 2. 웹앱은 302 로 응답하므로 -L 이 필요하다. 단 `-X POST` 와 같이 쓰면
#    리다이렉트에서 재전송돼 두 번 실행된다. 여기는 읽기라 해롭지 않지만 쓰지 않는다.
# 3. `.gs` 를 고치면 반드시 「배포 관리 → 편집 → 새 버전」 으로 다시 배포해야 반영된다.
# 4. 응답은 500행까지로 제한된다. 그보다 크면 잘림 표시가 나온다.
# 5. 읽은 내용에 연락처·계좌번호가 들어 있을 수 있다. 대화에 그대로 붙이지 않는다.

set -euo pipefail

TARGET="${1:-}"
TAB="${2:-}"
MAX="${3:-200}"

if [[ -z "$TARGET" ]]; then
  echo "사용법: bash '도구/시트보기.sh' <통합|응답|관리|시트ID> [탭] [최대행]" >&2
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

cat > "$TMP/req.pl" <<'PERLEOF'
use strict; use warnings;
my ($key, $sheet, $tab, $max, $out) = @ARGV;
$key =~ s/[^A-Za-z0-9_-]//g;
for ($sheet, $tab) { s/"/\\"/g }
$max =~ s/[^0-9]//g; $max = 200 if $max eq '';
open(my $O, '>:raw', $out) or die $!;
print $O '{"비밀키":"' . $key . '","동작":"시트읽기","시트":"' . $sheet
       . '","탭":"' . $tab . '","최대":' . $max . '}';
close $O;
PERLEOF
perl "$TMP/req.pl" "$KEY" "$TARGET" "$TAB" "$MAX" "$TMP/req.json"

CODE=$(curl -sS -L --max-time 180 -H 'Content-Type: application/json' \
  --data-binary "@$TMP/req.json" -o "$TMP/res.json" -w '%{http_code}' "$URL") || {
  echo "오류: 호출 실패" >&2; exit 1; }

if [[ "$CODE" != "200" ]]; then
  echo "오류: HTTP $CODE" >&2; head -c 300 "$TMP/res.json" >&2; echo >&2; exit 1
fi
if grep -qi '<html' "$TMP/res.json"; then
  echo "오류: JSON 대신 HTML 이 왔습니다. 배포 접근 권한을 확인하세요." >&2; exit 1
fi

cp "$TMP/res.json" "$TMP/out.json"

cat > "$TMP/show.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;                # 없으면 소스의 한글 키가 바이트로 남아 매칭되지 않는다
use JSON::PP;
binmode(STDOUT, ':encoding(UTF-8)');
local $/;
open(my $F, '<:raw', $ARGV[0]) or die $!;
my $raw = <$F>; close $F;
my $d = decode_json($raw);

if (!$d->{'성공'}) {
  print "실패: ", ($d->{'오류'} // '(내용 없음)'), "\n";
  if ($d->{'탭목록'}) {
    print "\n있는 탭\n";
    printf("  %-24s gid %-12s %s행 x %s열\n",
           $_->{'이름'}, $_->{'gid'}, $_->{'행'}, $_->{'열'}) for @{$d->{'탭목록'}};
  }
  exit 2;
}

print "시트 : $d->{'시트명'}\n";
print "탭   : $d->{'탭명'}  ($d->{'행'}행 x $d->{'열'}열)";
print "  ※ 일부만 가져왔습니다" if $d->{'잘림'};
print "\n";

print "\n있는 탭\n";
printf("  %-24s gid %-12s %s행 x %s열\n",
       $_->{'이름'}, $_->{'gid'}, $_->{'행'}, $_->{'열'}) for @{$d->{'탭목록'}};

my $v = $d->{'값'} || [];
print "\n내용\n";
my $r = 0;
for my $row (@$v) {
  $r++;
  my @cells = map { my $s = defined $_ ? $_ : ''; $s =~ s/\s*\n\s*/ ⏎ /g;
                    $s = substr($s, 0, 40) . '…' if length($s) > 40; $s } @$row;
  # 뒤쪽 빈 칸은 잘라서 읽기 쉽게
  pop @cells while @cells && $cells[-1] eq '';
  next unless @cells;
  printf("%4d | %s\n", $r, join(' | ', @cells));
}
PERLEOF
perl "$TMP/show.pl" "$TMP/out.json"
