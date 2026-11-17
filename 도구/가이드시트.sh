#!/usr/bin/env bash
# 가이드 내용 → 광고주 관리 워크북의 시트 탭 (검정/빨강 색 구분 유지)
#
# 사용법:  bash "도구/가이드시트.sh" <데이터.json> <탭명> [제목]
#          bash "도구/가이드시트.sh" \
#            "공고/3-1 체험단 공고 가이드 (기업용)/_작업/데이터.json" \
#            "3-1 체험단 가이드" "3-1 체험단 공고 가이드 (기업용)"
#
# 왜 있는가
#   PDF·구글문서보다 시트가 한눈에 비교하기 편할 때가 있다. 브랜드를 가로로 놓고
#   항목을 세로로 늘어놓으면 업체별 차이가 바로 보인다. 기존 관리 시트와 같은 배치다.
#   한 칸 안에서 기업 원문은 검정, 포포몬비즈가 쓴 것은 빨강으로 나뉜다.
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. 셸 변수명에 한글을 쓸 수 없다. 변수명은 ASCII 로 둔다.
# 2. perl 한 줄 명령에 한글 패턴을 쓸 때는 -Mutf8 이 필요하다. 그래서 .pl 로 뺀다.
# 3. 웹앱은 302 로 응답하므로 -L 이 필요하다. `-X POST` 와 같이 쓰면 두 번 실행된다.
# 4. `.gs` 를 고치면 「배포 관리 → 편집 → 새 버전」 으로 다시 배포해야 반영된다.
# 5. 탭을 지우고 다시 쓴다. 그 탭에 손으로 적은 내용이 있으면 사라진다.
#    관리용으로 손으로 쓰는 탭 이름을 넘기지 않는다.

set -euo pipefail

DATA="${1:-}"
TAB="${2:-}"
TITLE="${3:-$TAB}"

if [[ -z "$DATA" || ! -f "$DATA" ]]; then
  echo "오류: 데이터.json 경로를 넘겨주세요." >&2
  exit 1
fi
[[ -n "$TAB" ]] || { echo "오류: 탭명을 넘겨주세요." >&2; exit 1; }

ENVFILE="연동/.env"
[[ -f "$ENVFILE" ]] || { echo "오류: $ENVFILE 이 없습니다." >&2; exit 1; }
URL="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
[[ -n "${URL:-}" && -n "${KEY:-}" ]] || {
  echo "오류: $ENVFILE 에 공고가이드_웹앱 / 공고가이드_비밀키 가 필요합니다." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 항목 순서는 데이터에서 뽑는다. 사람이 읽기 좋은 순서로 앞쪽을 고정한다.
cat > "$TMP/wrap.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;
use JSON::PP;
use Encode qw(decode);
my ($src, $key, $tab, $title, $out) = @ARGV;
# 인자는 바이트로 들어온다. 풀지 않으면 encode_json 이 한 번 더 인코딩해 탭 이름이 깨진다
# (2026-10-02 「3-1 ì²´íë¨…」 으로 깨진 채 만들어졌다)
$tab = decode('UTF-8', $tab); $title = decode('UTF-8', $title);
$key =~ s/[^A-Za-z0-9_-]//g;

local $/;
open(my $F, '<:raw', $src) or die "데이터: $!";
my $데이터 = decode_json(<$F>); close $F;
die "데이터가 비어 있습니다.\n" unless ref $데이터 eq 'ARRAY' && @$데이터;

# 읽기 좋은 순서. 여기 없는 항목은 뒤에 가나다순으로 붙는다.
my @앞 = ('캠페인형태', '콘텐츠형태', '모집인원', '제공내역',
          '모집마감', '체험기간', '체험시간', '방문주소',
          '핵심내용', '필수장면', '게시글필수항목', '사람태그', '필수해시태그',
          '금지사항', '영상길이', '콘텐츠제출일', '유지기간', '추가전달',
          '브랜드소개', '강조포인트', '콘텐츠스타일', '분위기',
          '진행방식', '홍보제품', '제공혜택', '캠페인목적', '일정',
          '업로드시점', '인사이트기한', '레퍼런스링크', '2차활용',
          '저작권', '파트너십광고');

my %있음;
for my $d (@$데이터) { $있음{$_} = 1 for keys %{ $d->{'항목'} || {} } }

my @순서;
my %넣음;
for my $k (@앞) { if ($있음{$k}) { push @순서, $k; $넣음{$k} = 1 } }
for my $k (sort keys %있음) {
  next if $넣음{$k};
  next if $k eq '기본제작안내';          # 모든 캠페인 공통이라 시트에서는 뺀다
  push @순서, $k;
}

# encode_json 은 이미 UTF-8 바이트를 돌려준다.
# 핸들에 :utf8 을 걸면 두 번 인코딩돼 「Wide character」 경고와 함께 본문이 깨진다.
open(my $O, '>:raw', $out) or die $!;
print $O encode_json({
  '비밀키'   => $key,
  '동작'     => '가이드시트',
  '탭'       => $tab,
  '제목'     => $title,
  '항목순서' => \@순서,
  '데이터'   => $데이터,
});
close $O;
print STDERR "항목 " . scalar(@순서) . "개 / 브랜드 " . scalar(@$데이터) . "개\n";
PERLEOF
perl "$TMP/wrap.pl" "$DATA" "$KEY" "$TAB" "$TITLE" "$TMP/req.json"

CODE=$(curl -sS -L --max-time 300 -H 'Content-Type: application/json' \
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
my $d = decode_json(<$F>); close $F;
if (!$d->{'성공'}) { print "실패: ", ($d->{'오류'} // ''), "\n"; exit 2 }
print "완료: $d->{'탭'}  (브랜드 $d->{'브랜드수'}개 / $d->{'행'}행)\n";
print "  $d->{'링크'}\n";
PERLEOF
perl "$TMP/show.pl" "$TMP/res.json"
