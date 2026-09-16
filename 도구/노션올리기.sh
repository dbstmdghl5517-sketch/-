#!/usr/bin/env bash
# 공고 텍스트 → 노션 페이지 (브랜드별 새 프로젝트)
#
# 사용법:  bash "도구/노션올리기.sh" "<공고txt>" "<페이지 제목>" [올리기|확인만] [기획형|체험단]
#          bash "도구/노션올리기.sh" "<txt>" "<제목>"                    ← 6번 기획형 (기본)
#          bash "도구/노션올리기.sh" "<txt>" "<제목>" 올리기 체험단      ← 4번 체험단
#          bash "도구/노션올리기.sh" "<txt>" "<제목>" 확인만            ← 변환 결과만 본다
#
# 종류에 따라 상위 페이지가 다르다. 기획형과 체험단을 한 페이지에 섞지 않는다.
#   기획형 → 연동/.env 의 노션_상위페이지
#   체험단 → 연동/.env 의 노션_체험단페이지
# 발행 이력에도 종류로 구분해 기록된다. 한 업체가 둘 다 진행하는 경우가 있다.
#
# 준비 (한 번만):
#   1) notion.so/my-integrations → 새 통합 만들기 → 이름 아무거나 → 내부 통합 시크릿 복사
#   2) 노션에서 대상 페이지 열기 → 우측 상단 ··· → 연결 → 만든 통합 선택
#      ↳ 이걸 안 하면 토큰이 맞아도 object_not_found 가 난다. 통합은 공유된 페이지만 본다
#   3) 연동/.env 에 두 줄
#        노션_토큰=ntn_...
#        노션_상위페이지=3d44b47aa36f807083fdc50dd54cad2a
#
# ─── 입력 텍스트 형식 ───────────────────────────────────────
#   ## 카테고리           → 노션 heading_2
#   ### 작은 제목          → 노션 heading_3
#   - 항목                 → 노션 불릿
#   1. 항목                → 노션 번호 목록
#   ---                    → 구분선
#   | 가 | 나 |            → 노션 표 (바로 다음 줄이 |---|---| 이면 첫 줄을 머리글로 본다)
#   | --- | --- |
#   | 1  | 2  |
#   그 외 한 줄            → 문단 (빈 줄은 무시)
#
#   ※ 4번·6번 공고에는 표를 쓰지 않는다. 업로드 화면에서 표를 못 쓴다.
#      표는 사람이 읽는 정리 문서에만 쓴다.
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. **셸 변수명에 한글을 쓸 수 없다.** `모드=` 는 command not found 로 죽는다.
# 2. **perl 한 줄 명령에 한글 패턴을 쓸 때는 -Mutf8 이 필요하다.** 없으면 조용히 안 맞는다.
#    그래서 이 스크립트는 변환 로직을 별도 .pl 파일로 만들어 쓴다.
# 3. 상위 페이지가 **데이터베이스**면 parent 를 database_id 로, **일반 페이지**면
#    page_id 로 보내야 한다. 틀리면 validation_error 다. 아래에서 자동으로 판별한다.
# 4. 통합을 페이지에 연결하지 않으면 object_not_found. 토큰 문제로 착각하기 쉽다.
# 5. children 은 한 번에 100개까지다. 넘으면 나눠 append 해야 한다 (아래에서 처리).
# 6. Notion-Version 헤더가 없으면 400 이다.
# 7. 토큰은 암호다. 저장소가 공개이므로 .env 를 커밋하면 안 된다.

set -euo pipefail

SRC="${1:-}"
TITLE="${2:-}"
MODE="${3:-올리기}"
KIND="${4:-기획형}"     # 기획형(6번) | 체험단(4번). 상위 페이지와 이력 기록 종류가 갈린다
REC="${5:-기록}"        # 기록 | 기록없음. 웹앱이 아직 새 코드로 배포되지 않았을 때 건너뛴다

if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "오류: 공고 텍스트 파일 경로를 넘겨주세요." >&2
  echo "  예) bash '도구/노션올리기.sh' '공고/6 .../_작업/비엘르 카페.txt' '비엘르 카페'" >&2
  exit 1
fi
[[ -n "$TITLE" ]] || { echo "오류: 페이지 제목을 넘겨주세요." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── 텍스트 → 노션 블록 JSON ──
cat > "$TMP/blocks.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;
use Encode qw(encode decode);
binmode(STDOUT, ':encoding(UTF-8)');

my $path = decode('UTF-8', $ARGV[0]);
open(my $F, '<:encoding(UTF-8)', encode('UTF-8', $path)) or die "입력: $!";

sub esc {
  my ($s) = @_;
  $s =~ s/\\/\\\\/g;
  $s =~ s/"/\\"/g;
  $s =~ s/\r//g;
  $s =~ s/\t/ /g;
  return $s;
}

# 노션 한 블록의 텍스트 길이 상한은 2000자다. 넘으면 잘라 나눈다.
sub rich {
  my ($s) = @_;
  my @out;
  while (length($s) > 2000) {
    push @out, '{"type":"text","text":{"content":"' . esc(substr($s, 0, 2000)) . '"}}';
    $s = substr($s, 2000);
  }
  push @out, '{"type":"text","text":{"content":"' . esc($s) . '"}}';
  return join(',', @out);
}

sub block {
  my ($type, $text) = @_;
  return '{"object":"block","type":"' . $type . '","' . $type
       . '":{"rich_text":[' . rich($text) . ']}}';
}

sub 칸 {
  my ($s) = @_;
  $s = '' unless defined $s;
  $s =~ s/^\s+//; $s =~ s/\s+$//;
  return '[{"type":"text","text":{"content":"' . esc($s) . '"}}]';
}

# 표 한 덩어리를 노션 table 블록으로. 행은 children 으로 함께 넣어야 한다.
sub 표블록 {
  my ($줄들, $머리글있음) = @_;
  return () unless @$줄들;
  my @행;
  my $폭 = 0;
  for my $r (@$줄들) {
    my $t = $r;
    $t =~ s/^\s*\|//; $t =~ s/\|\s*$//;
    my @c = split /\|/, $t, -1;
    $폭 = scalar(@c) if scalar(@c) > $폭;
    push @행, \@c;
  }
  my @행블록;
  for my $c (@행) {
    my @칸들 = map { 칸($_) } @$c;
    push @칸들, 칸('') while scalar(@칸들) < $폭;    # 칸 수가 모자라면 채운다
    push @행블록, '{"object":"block","type":"table_row","table_row":{"cells":['
                . join(',', @칸들) . ']}}';
  }
  return '{"object":"block","type":"table","table":{"table_width":' . $폭
       . ',"has_column_header":' . ($머리글있음 ? 'true' : 'false')
       . ',"has_row_header":false,"children":[' . join(',', @행블록) . ']}}';
}

my @줄 = <$F>;
close $F;
for (@줄) { s/[\r\n]+$// }

my @blocks;
for (my $i = 0; $i <= $#줄; $i++) {
  my $l = $줄[$i];
  next if $l =~ /^\s*$/;

  # 표 — 연속된 | 줄을 모은다
  if ($l =~ /^\s*\|.*\|\s*$/) {
    my @모음;
    my $머리 = 0;
    while ($i <= $#줄 && $줄[$i] =~ /^\s*\|.*\|\s*$/) {
      if ($줄[$i] =~ /^\s*\|[\s|:-]+\|\s*$/) { $머리 = 1; $i++; next }   # |---|---| 구분선
      push @모음, $줄[$i];
      $i++;
    }
    $i--;
    push @blocks, 표블록(\@모음, $머리) if @모음;
    next;
  }

  if    ($l =~ /^###\s+(.*)$/)      { push @blocks, block('heading_3', $1) }
  elsif ($l =~ /^##\s+(.*)$/)       { push @blocks, block('heading_2', $1) }
  elsif ($l =~ /^#\s+(.*)$/)        { push @blocks, block('heading_1', $1) }
  elsif ($l =~ /^-{3,}\s*$/)        { push @blocks, '{"object":"block","type":"divider","divider":{}}' }
  elsif ($l =~ /^\s*[-·*]\s+(.*)$/) { push @blocks, block('bulleted_list_item', $1) }
  elsif ($l =~ /^\s*\d+[.)]\s+(.*)$/) { push @blocks, block('numbered_list_item', $1) }
  else                              { push @blocks, block('paragraph', $l) }
}

die "변환할 내용이 없습니다.\n" unless @blocks;
print '[', join(",\n", @blocks), ']';
PERLEOF

perl "$TMP/blocks.pl" "$SRC" > "$TMP/blocks.json"
NBLOCKS=$(grep -c '"object":"block"' "$TMP/blocks.json" || true)
echo "블록 ${NBLOCKS}개로 변환했습니다."

if [[ "$MODE" == "확인만" ]]; then
  echo "--- 앞부분 ---"
  head -c 600 "$TMP/blocks.json"; echo
  exit 0
fi

ENVFILE="연동/.env"
[[ -f "$ENVFILE" ]] || { echo "오류: $ENVFILE 이 없습니다." >&2; exit 1; }

TOKEN="$(grep -m1 '^노션_토큰=' "$ENVFILE" | cut -d= -f2- || true)"
# 기획형과 체험단을 한 페이지에 섞지 않는다. 종류에 따라 상위 페이지가 다르다.
if [[ "$KIND" == "체험단" ]]; then
  PARENT="$(grep -m1 '^노션_체험단페이지=' "$ENVFILE" | cut -d= -f2- || true)"
else
  PARENT="$(grep -m1 '^노션_상위페이지=' "$ENVFILE" | cut -d= -f2- || true)"
fi

if [[ -z "${TOKEN:-}" || -z "${PARENT:-}" ]]; then
  echo "오류: $ENVFILE 에 아래 두 줄이 필요합니다." >&2
  echo "  노션_토큰=ntn_..." >&2
  echo "  노션_상위페이지=3d44b47aa36f807083fdc50dd54cad2a" >&2
  echo >&2
  echo "토큰은 notion.so/my-integrations 에서 만들고," >&2
  echo "노션 페이지 ··· → 연결 에서 그 통합을 연결해야 합니다." >&2
  exit 1
fi

API=https://api.notion.com/v1
NV='Notion-Version: 2022-06-28'
AUTH="Authorization: Bearer $TOKEN"

# ── 상위가 데이터베이스인지 일반 페이지인지 판별 ──
# 틀리면 validation_error 가 나므로 먼저 확인한다.
KIND=page
if curl -sS -m 30 -H "$AUTH" -H "$NV" "$API/databases/$PARENT" \
     | grep -q '"object":"database"'; then
  KIND=database
elif ! curl -sS -m 30 -H "$AUTH" -H "$NV" "$API/pages/$PARENT" \
       | grep -q '"object":"page"'; then
  echo "오류: 상위 페이지를 찾을 수 없습니다." >&2
  echo "  노션에서 해당 페이지 ··· → 연결 → 통합을 연결했는지 확인하세요." >&2
  echo "  (토큰이 맞아도 연결하지 않으면 object_not_found 입니다)" >&2
  exit 1
fi
echo "상위: $KIND"

# ── 페이지 만들기 (children 은 처음 100개만) ──
cat > "$TMP/req.pl" <<'PERLEOF'
use strict; use warnings;
use utf8;
use Encode qw(encode decode);
my ($blockfile, $title, $parent, $kind, $out) = @ARGV;
$title = decode('UTF-8', $title);
local $/;
open(my $B, '<:encoding(UTF-8)', $blockfile) or die $!;
my $blocks = <$B>; close $B;

# 블록 배열을 100개 단위로 쪼갠다 — 노션 children 상한
my @items;
my $depth = 0; my $cur = ''; my $instr = 0; my $esc = 0;
for my $ch (split //, substr($blocks, 1, length($blocks) - 2)) {
  if ($esc)              { $cur .= $ch; $esc = 0; next }
  if ($ch eq '\\')       { $cur .= $ch; $esc = 1; next }
  if ($ch eq '"')        { $instr = !$instr; $cur .= $ch; next }
  if (!$instr && $ch eq '{') { $depth++ }
  if (!$instr && $ch eq '}') { $depth-- }
  if (!$instr && $ch eq ',' && $depth == 0) { push @items, $cur; $cur = ''; next }
  $cur .= $ch;
}
push @items, $cur if $cur =~ /\S/;
for (@items) { s/^\s+//; s/\s+$// }

my $first = join(',', @items[0 .. ($#items < 99 ? $#items : 99)]);
my @rest  = $#items > 99 ? @items[100 .. $#items] : ();

my $t = $title; $t =~ s/\\/\\\\/g; $t =~ s/"/\\"/g;
my $pkey = $kind eq 'database' ? 'database_id' : 'page_id';
my $props = $kind eq 'database'
  ? '{"title":{"title":[{"type":"text","text":{"content":"' . $t . '"}}]}}'
  : '{"title":{"title":[{"type":"text","text":{"content":"' . $t . '"}}]}}';

open(my $O, '>:encoding(UTF-8)', $out) or die $!;
print $O '{"parent":{"' . $pkey . '":"' . $parent . '"},"properties":'
       . $props . ',"children":[' . $first . ']}';
close $O;

# 100개를 넘긴 나머지는 따로 저장해 append 한다
if (@rest) {
  my $i = 0;
  while (@rest) {
    my @chunk = splice(@rest, 0, 100);
    $i++;
    open(my $R, '>:encoding(UTF-8)', "$out.rest$i") or die $!;
    print $R '{"children":[' . join(',', @chunk) . ']}';
    close $R;
  }
  print STDERR "나머지 블록 ${i}묶음을 이어서 올립니다.\n";
}
PERLEOF

perl "$TMP/req.pl" "$TMP/blocks.json" "$TITLE" "$PARENT" "$KIND" "$TMP/create.json"

CODE=$(curl -sS -m 90 -X POST "$API/pages" \
  -H "$AUTH" -H "$NV" -H 'Content-Type: application/json' \
  --data-binary "@$TMP/create.json" \
  -o "$TMP/res.json" -w '%{http_code}')

if [[ "$CODE" != "200" ]]; then
  echo "오류: 페이지 생성 실패 (HTTP $CODE)" >&2
  head -c 500 "$TMP/res.json" >&2; echo >&2
  exit 1
fi

PAGEID=$(grep -o '"id":"[0-9a-f-]*"' "$TMP/res.json" | head -1 | cut -d'"' -f4)
PAGEURL=$(grep -o '"url":"[^"]*"' "$TMP/res.json" | head -1 | cut -d'"' -f4)

# 100개 초과분 이어 붙이기
for f in "$TMP/create.json".rest*; do
  [[ -f "$f" ]] || continue
  RC=$(curl -sS -m 90 -X PATCH "$API/blocks/$PAGEID/children" \
    -H "$AUTH" -H "$NV" -H 'Content-Type: application/json' \
    --data-binary "@$f" -o "$TMP/app.json" -w '%{http_code}')
  if [[ "$RC" != "200" ]]; then
    echo "경고: 추가 블록 올리기 실패 (HTTP $RC). 페이지는 만들어졌습니다." >&2
    head -c 300 "$TMP/app.json" >&2; echo >&2
  fi
done

echo "완료: $TITLE"
echo "  $PAGEURL"

# ── 광고주 관리 워크북에 기록 ──
# 어느 업체 공고를 언제 올렸는지 한 곳에서 보이게 한다.
# 웹앱이 설정돼 있지 않으면 조용히 넘어간다 (노션 업로드 자체는 이미 끝났다).
WEBAPP="$(grep -m1 '^공고가이드_웹앱=' "$ENVFILE" | cut -d= -f2- || true)"
KEY2="$(grep -m1 '^공고가이드_비밀키=' "$ENVFILE" | cut -d= -f2- || true)"
if [[ "$REC" == "기록없음" ]]; then
  echo "  (시트 기록은 건너뜁니다)"
  WEBAPP=""
fi
if [[ -n "${WEBAPP:-}" && -n "${KEY2:-}" ]]; then
  # 제목 앞의 날짜를 떼어 브랜드명만 남긴다. 이력은 브랜드명으로 짝을 맞춘다.
  BRAND="$(printf '%s' "$TITLE" | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2} //')"
  # 제목에서 채널을 뽑아내고 브랜드명만 남긴다.
  # 이력은 (종류, 채널, 브랜드) 로 쌓인다. 체험단은 채널마다 공고가 따로다.
  CH=""
  case "$TITLE" in
    *블로그*) CH="블로그" ;;
    *인스타*|*피드*) CH="피드" ;;
    *릴스*)   CH="릴스" ;;
  esac
  BRAND="$(printf '%s' "$BRAND" | sed -E 's/ *\((블로그|피드|릴스)\) *$//; s/ *(블로그|인스타|릴스) ?체험단 *$//')"
  cat > "$TMP/rec.pl" <<'PERLEOF'
use strict; use warnings;
my ($key, $kind, $ch, $brand, $url, $out) = @ARGV;
$key =~ s/[^A-Za-z0-9_-]//g;
for ($kind, $ch, $brand, $url) { s/"/\\"/g }
open(my $O, '>:raw', $out) or die $!;
print $O '{"비밀키":"' . $key . '","동작":"공고기록","종류":"' . $kind
       . '","채널":"' . $ch . '","브랜드":"' . $brand . '","링크":"' . $url . '"}';
close $O;
PERLEOF
  perl "$TMP/rec.pl" "$KEY2" "$KIND" "$CH" "$BRAND" "$PAGEURL" "$TMP/rec.json"
  RC2=$(curl -sS -L --max-time 120 -H 'Content-Type: application/json' \
        --data-binary "@$TMP/rec.json" -o "$TMP/rec_res.json" -w '%{http_code}' "$WEBAPP" || echo 000)
  if [[ "$RC2" == "200" ]] && grep -q '"성공":true' "$TMP/rec_res.json"; then
    echo "  광고주 관리 시트에 기록했습니다."
  else
    echo "  (알림: 광고주 관리 시트 기록은 실패했습니다. 노션 업로드는 정상입니다)" >&2
    head -c 200 "$TMP/rec_res.json" >&2; echo >&2
  fi
fi
