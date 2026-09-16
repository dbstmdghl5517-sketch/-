#!/usr/bin/env bash
# 광고주 관리 탭 정리 — 열 정렬 · 진행완료 이동 · 불발 이동
#
# 사용법:  bash "도구/상태정리.sh"            ← 실제로 정리한다
#          bash "도구/상태정리.sh" 미리보기    ← 무엇이 옮겨질지만 본다
#
# 매일 오전 6시 트리거와 **같은 함수**를 쓴다. 직접 돌리고 싶을 때 이걸 쓴다.
#
# 하는 일
#   1) 진행상태가 `진행완료` → 진행완료 탭으로 옮긴다
#   2) 진행상태가 `불발` → 불발 탭으로 바로 옮긴다 (3주 기다리지 않는다)
#   3) 제안중·진행대기가 3주간 변화 없으면 → 불발 탭으로 옮긴다
#   4) 남은 열을 제안중 → 진행중 → 진행대기 순서로 왼쪽부터 배치한다
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. 셸 변수명에 한글을 쓸 수 없다. 변수명은 ASCII 로 둔다.
# 2. 웹앱은 302 로 응답하므로 -L 이 필요하다. `-X POST` 와 같이 쓰면 두 번 실행된다.
# 3. **옮긴 열은 원본에서 지워진다.** 복사가 확인된 뒤에만 지우지만 되돌리기 어렵다.
#    처음 돌릴 때는 `미리보기` 로 먼저 확인한다.
# 4. 구글 시트에는 열별 수정 시각이 없다. 지문을 `_상태추적` 탭에 적어 비교하므로
#    3주는 **추적을 시작한 날부터** 센다.

set -euo pipefail

MODE="${1:-실행}"
DRY=false
[[ "$MODE" == "미리보기" ]] && DRY=true

ENVFILE="연동/.env"
[[ -f "$ENVFILE" ]] || { echo "오류: $ENVFILE 이 없습니다." >&2; exit 1; }
URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
[[ -n "${URL:-}" && -n "${KEY:-}" ]] || {
  echo "오류: $ENVFILE 에 공고가이드_웹앱 / 공고가이드_비밀키 가 필요합니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf '{"비밀키":"%s","동작":"상태정리","미리보기":%s}' "$KEY" "$DRY" > "$TMP/req.json"

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
my $r = decode_json(<$F>); close $F;
if (!$r->{'성공'}) { print "실패: ", ($r->{'오류'} // ''), "\n"; exit 2 }

print($r->{'미리보기'} ? "[미리보기] 아무것도 바꾸지 않았습니다\n" : "정리 완료\n");
my $완 = $r->{'완료'} || [];
my $불 = $r->{'불발'} || [];
print "  진행완료 → 진행완료 탭 : ", (@$완 ? join(', ', @$완) : '없음'), "\n";
print "  불발 → 불발 탭         : ", (@$불 ? join(', ', @$불) : '없음'), "\n";
print "  남은 업체              : ", ($r->{'남음'} // 0), "개\n";
print "  열 정렬                : ", ($r->{'정렬'} // 0), "번 이동\n";
print "\n실제로 옮기려면 미리보기 없이 다시 돌리세요.\n" if $r->{'미리보기'};
PERLEOF
perl "$TMP/show.pl" "$TMP/res.json"
