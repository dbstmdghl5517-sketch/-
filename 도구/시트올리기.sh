#!/usr/bin/env bash
# 가이드 데이터(JSON) → Apps Script 웹앱 → 구글 문서 + 관리 시트
#
# 사용법:  bash "도구/시트올리기.sh" "공고/5-1 기획형 인플루언서 공고 가이드/_작업/데이터.json"
#          bash "도구/시트올리기.sh" "<json>" 유지        ← 기존 문서를 건너뛴다 (기본은 덮어쓰기)
#
# 준비 (한 번만):
#   1) Apps Script 프로젝트에서 [비밀키만들기] 실행 → 로그의 값 복사
#   2) 배포 → 새 배포 → 웹 앱 / 실행 계정: 나 / 액세스: 모든 사용자 → …/exec URL 복사
#   3) 연동/.env 에 두 줄을 넣는다 (이 파일은 .gitignore 로 제외돼 있다)
#        공고가이드_웹앱=https://script.google.com/macros/s/…/exec
#        공고가이드_비밀키=1단계에서 복사한 값
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. **셸 변수명에 한글을 쓸 수 없다.** `모드="..."` 는 command not found 로 죽는다.
#    변수명은 ASCII 로, 한글은 주석과 출력 메시지에만 쓴다.
# 2. 웹앱은 200 이 아니라 302 로 응답을 돌려준다. `-L` 없이 부르면 본문이 비어 보인다.
# 3. `-X POST` 와 `-L` 을 같이 쓰면 리다이렉트에서 POST 가 재전송돼 **두 번 실행된다.**
#    그래서 여기서는 `--data-binary` 로만 POST 하고 `-X` 는 절대 쓰지 않는다.
#    그래도 안전하도록 실행키를 붙여 보내고, 스크립트가 중복 호출을 걸러낸다.
# 4. 응답이 JSON 이 아니라 HTML 이면 배포 설정 문제다.
#    「액세스 권한: 모든 사용자」 가 아니면 구글 로그인 페이지가 돌아온다.
# 5. 코드를 고쳤는데 결과가 그대로면, 배포를 새 버전으로 올리지 않은 것이다.
#    Apps Script 는 배포된 버전을 실행한다. 편집기 저장만으로는 웹앱에 반영되지 않는다.
# 6. Apps Script 실행 제한은 6분이다. 브랜드가 15건을 넘어가면 나눠 보내야 한다.
# 7. 비밀키와 배포 URL 은 사실상 암호다. 저장소가 공개이므로 .env 를 커밋하면 안 된다.
# 8. 한글 경로·본문이 있으니 curl 에는 파일로 넘긴다. 명령줄에 직접 붙이면 깨진다.

set -euo pipefail

DATA="${1:-}"
MODE="${2:-덮어쓰기}"

if [[ -z "$DATA" || ! -f "$DATA" ]]; then
  echo "오류: 데이터 JSON 경로를 넘겨주세요." >&2
  echo "  예) bash '도구/시트올리기.sh' '공고/5-1 기획형 인플루언서 공고 가이드/_작업/데이터.json'" >&2
  exit 1
fi

ENVFILE="연동/.env"
if [[ ! -f "$ENVFILE" ]]; then
  echo "오류: $ENVFILE 이 없습니다. 아래 두 줄을 만들어 주세요." >&2
  echo "  공고가이드_웹앱=https://script.google.com/macros/s/…/exec" >&2
  echo "  공고가이드_비밀키=Apps Script 의 [비밀키만들기] 로 받은 값" >&2
  exit 1
fi

URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2-)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2-)"

[[ -n "$URL" ]] || { echo "오류: $ENVFILE 에 공고가이드_웹앱 이 없습니다." >&2; exit 1; }
[[ -n "$KEY" ]] || { echo "오류: $ENVFILE 에 공고가이드_비밀키 가 없습니다." >&2; exit 1; }

case "$URL" in
  https://script.google.com/macros/s/*/exec) ;;
  *) echo "오류: 배포 URL 은 …/exec 로 끝나야 합니다." >&2; exit 1 ;;
esac

RUNKEY="$(date +%s)-$$-$RANDOM"
TMP="$(mktemp -d)"
BODY="$TMP/body.json"
trap 'rm -rf "$TMP"' EXIT

# 덮어쓰기 여부
OVER=true
[[ "$MODE" == "유지" ]] && OVER=false

# 본문 조립. 한글·따옴표가 섞인 JSON 을 셸 문자열로 이어 붙이면 깨지므로 perl 로 만든다.
cat > "$TMP/wrap.pl" <<'PERLEOF'
use strict; use warnings;
my ($src, $key, $run, $over, $out) = @ARGV;
local $/;
open(my $F, '<:raw', $src) or die "데이터: $!";
my $data = <$F>; close $F;
$key =~ s/[^A-Za-z0-9_-]//g;              # 비밀키는 영문·숫자뿐이다. 나머지는 버린다
$run =~ s/[^A-Za-z0-9_-]//g;
open(my $O, '>:raw', $out) or die "본문: $!";
print $O '{"비밀키":"' . $key . '","실행키":"' . $run . '","덮어쓰기":' . $over
       . ',"데이터":' . $data . '}';
close $O;
PERLEOF
perl "$TMP/wrap.pl" "$DATA" "$KEY" "$RUNKEY" "$OVER" "$BODY"

COUNT=$(grep -c '"브랜드"' "$DATA" || true)
echo "보내는 중 … 브랜드 ${COUNT}건 / 모드 $MODE"

CODE=$(curl -sS -L --max-time 540 \
  -H 'Content-Type: application/json' \
  --data-binary "@$BODY" \
  -o "$TMP/res.txt" -w '%{http_code}' \
  "$URL") || { echo "오류: 호출 실패. 네트워크 또는 배포 URL 을 확인하세요." >&2; exit 1; }

if [[ "$CODE" != "200" ]]; then
  echo "오류: HTTP $CODE" >&2
  head -c 400 "$TMP/res.txt" >&2; echo >&2
  exit 1
fi

# HTML 이 오면 배포 접근 권한 문제다
if grep -qi '<html' "$TMP/res.txt"; then
  echo "오류: JSON 대신 HTML 이 돌아왔습니다." >&2
  echo "  배포 설정에서 「액세스 권한」 을 '모든 사용자' 로 바꾸고 새 버전으로 다시 배포하세요." >&2
  exit 1
fi

cat > "$TMP/report.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;                # 없으면 소스의 한글 패턴이 바이트로 남아 매칭되지 않는다
binmode(STDOUT, ':encoding(UTF-8)');
local $/;
open(my $F, '<:encoding(UTF-8)', $ARGV[0]) or die $!;
my $r = <$F>; close $F;

if ($r =~ /"성공"\s*:\s*false/) {
  my ($e) = $r =~ /"오류"\s*:\s*"((?:[^"\\]|\\.)*)"/;
  $e = '(내용 없음)' unless defined $e;
  $e =~ s/\\n/\n  /g; $e =~ s/\\"/"/g;
  print "실패: $e\n";
  exit 2;
}

print "재사용: 같은 실행키로 이미 처리된 결과입니다 (중복 호출 차단)\n" if $r =~ /"재사용"\s*:\s*true/;

my ($n)  = $r =~ /"건수"\s*:\s*(\d+)/;
my ($ms) = $r =~ /"관리시트"\s*:\s*"((?:[^"\\]|\\.)*)"/;
my ($fo) = $r =~ /"폴더"\s*:\s*"((?:[^"\\]|\\.)*)"/;
for ($ms, $fo) { next unless defined $_; s/\\\//\//g; s/\\"/"/g; }

print "완료 ", ($n // '?'), "건\n";
while ($r =~ /\{"브랜드":"((?:[^"\\]|\\.)*)","상태":"((?:[^"\\]|\\.)*)","링크":"((?:[^"\\]|\\.)*)"\}/g) {
  my ($b, $s, $l) = ($1, $2, $3);
  for ($b, $s, $l) { s/\\\//\//g; s/\\"/"/g; }
  print "  [$s] $b\n        $l\n";
}
print "\n관리 시트 : $ms\n" if defined $ms;
print "폴더      : $fo\n" if defined $fo;
PERLEOF
perl "$TMP/report.pl" "$TMP/res.txt"
