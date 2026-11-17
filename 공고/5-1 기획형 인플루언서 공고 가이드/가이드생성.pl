use utf8;
use Encode qw(encode decode);
@ARGV = map { decode("UTF-8", $_) } @ARGV;
binmode(STDOUT, ":encoding(UTF-8)");

my $CSV  = shift;   # 5-0 응답 시트 CSV
my $TPL  = shift;   # 가이드_양식.html
my $OUTD = shift;   # 작업 폴더
my $SUP  = shift;   # 보완내용.tsv

my $NL = chr(10);

# ── 5-0 응답 CSV 파싱 ──
# ★ CSV 를 여러 개 받는다. `|` 로 이어 붙이면 폼 여러 개를 한 번에 처리한다.
#   폼마다 문항이 달라 머리글도 다르므로, 파일별로 머리글을 따로 들고 간다.
#   한 폼만 넘기면 나머지 폼 업체가 통째로 빠진다. 실제로 인디언이 그렇게 빠져 있었다.
sub CSV파싱 {
  my ($path) = @_;
  local $/;
  open(my $F, "<:encoding(UTF-8)", encode("UTF-8", $path)) or die "CSV($path): $!";
  my $raw = <$F>; close $F;
  my (@rows, @cur); my $fld = ''; my $q = 0;
  for my $ch (split //, $raw) {
    if ($q) { if ($ch eq chr(34)) { $q = 0 } else { $fld .= $ch } }
    else {
      if    ($ch eq chr(34)) { $q = 1 }
      elsif ($ch eq ',')     { push @cur, $fld; $fld = '' }
      elsif ($ch eq "\n")    { push @cur, $fld; push @rows, [@cur]; @cur = (); $fld = '' }
      elsif ($ch eq "\r")    { }
      else { $fld .= $ch }
    }
  }
  push @cur, $fld if $fld ne ''; push @rows, [@cur] if @cur;
  return \@rows;
}

my @묶음;   # { 머리글 => [...], 행들 => [...] }
for my $p (split /\|/, $CSV) {
  $p =~ s/^\s+|\s+$//g;
  next if $p eq '';
  my $rows = CSV파싱($p);
  next unless @$rows;
  push @묶음, { 머리글 => $rows->[0], 행들 => [ @{$rows}[1 .. $#$rows] ] };
}
die "읽을 CSV 가 없습니다.\n" unless @묶음;

# ── 템플릿 ──
my $tpl;
{
  local $/;
  open(my $T, "<:encoding(UTF-8)", encode("UTF-8", $TPL)) or die "TPL: $!";
  $tpl = <$T>; close $T;
  $tpl =~ s{<!--\n.*?-->\n}{}s;
}

# ── 기본 제작 안내 (모든 캠페인 공통) ──
# 양식에서 뽑아 데이터로 함께 넘긴다. 그래야 문구를 고쳐도
# Apps Script 를 다시 배포하지 않아도 구글 문서에 반영된다.
my @기본안내;
{
  my ($블록) = $tpl =~ m{기본 제작 안내</h2>.*?<ul>(.*?)</ul>}s;
  if (defined $블록) {
    while ($블록 =~ m{<li>(.*?)</li>}gs) {
      my $s = $1;
      $s =~ s{<[^>]+>}{}g;                    # 혹시 들어간 태그 제거
      $s =~ s/^\s+//; $s =~ s/\s+$//;
      push @기본안내, $s if $s ne '';
    }
  }
  die "양식에서 기본 제작 안내를 찾지 못했습니다.\n" unless @기본안내;
}

# ── 보완내용: 브랜드 → 항목 → {구분, 값} ──
# 브랜드가 '*' 이면 전 캠페인 공통 기본값
my %보완;
if (defined $SUP && $SUP ne '') {
  open(my $S, "<:encoding(UTF-8)", encode("UTF-8", $SUP)) or die "SUP: $!";
  my $ln = 0;
  while (my $l = <$S>) {
    $ln++;
    $l =~ s/[\r\n]+$//;
    next if $ln == 1 || $l =~ /^\s*$/;
    my ($b, $k, $g, $v) = split /\t/, $l;
    next unless defined $v;
    $v =~ s/\\n/$NL/g;
    $보완{$b}{$k} = { 구분 => ($g // '신규'), 값 => $v };
  }
  close $S;
}

# ── 열 찾기: 번호가 아니라 머리글 글자로 ──────────────────────
#
# ★ 폼이 둘이고 문항이 서로 다르다. **열 번호를 박아 두면 안 된다.**
#   19문항 폼은 열 20개, 16문항 폼은 열 17개이고 순서도 내용도 다르다.
#   번호로 읽으면 16문항 폼의 엉뚱한 칸을 브랜드명으로 집는다.
#   (자동알림.gs 도 같은 이유로 머리글 방식으로 바꿨다. 두 곳의 방식을 맞춰 둔다)
#
# 비교할 때 공백을 모두 지운다. 머리글에 줄바꿈과 두 칸 띄어쓰기가 섞여 있다.

my %키워드19 = (
  '브랜드명'   => '브랜드명',        '링크'         => '플레이스',
  '홍보제품'   => '홍보할 제품',      '제공혜택'     => '제공되는 제품',
  '진행방식'   => '배송형',          '브랜드소개'   => '소개를 작성',
  '강조포인트' => '강조하고 싶은',    '캠페인목적'   => '가장 중요한 목적',
  '콘텐츠스타일' => '콘텐츠 스타일',  '분위기'       => '전체적인 분위기',
  '필수장면'   => '포함되어야 하는 장면', '게시글필수항목' => '게시글에 반드시',
  '사람태그'   => '사람태그',        '레퍼런스링크' => '참고하고 싶은',
  '일정'       => '방문/발송 일정',   '업로드시점'   => '반드시 업로드',
  '금지사항'   => '사용하면 안 되는', '2차활용'      => '2차 활용이 필요',
);

# 16문항 폼. 브랜드명·담당자가 한 칸에 `/` 로 붙어 오므로 조각을 지정한다.
my %키워드16 = (
  '브랜드명'   => ['브랜드명', '/', 0],
  '링크'       => '홈페이지 / 구매 링크',
  '홍보제품'   => '주요 촬영 제품',   '브랜드소개'   => '브랜드 소개',
  '캠페인목적' => '이번 미션 핵심',   '콘텐츠스타일' => '콘텐츠 방향',
  '필수장면'   => '콘텐츠 필수 포인트', '영상길이'   => '영상 길이',
  '레퍼런스링크' => '제작 레퍼런스',  '일정'         => '진행 및 방문 일정',
  '콘텐츠제출일' => '콘텐츠 제출일',  '인사이트기한' => '인사이트 제출 기한',
  '게시글필수항목' => '게시글 필수 포함', '사람태그'  => '사람(계정) 태그',
  '필수해시태그' => '장소 태그',
);

sub 공백뺀 { my $s = defined $_[0] ? $_[0] : ''; $s =~ s/\s+//g; return $s }

sub 열찾기 {
  my ($머리글, $kw) = @_;
  my $k = 공백뺀($kw);
  return -1 if $k eq '';
  for my $i (0 .. $#$머리글) {
    return $i if index(공백뺀($머리글->[$i]), $k) >= 0;
  }
  return -1;
}

# 머리글을 보고 어느 폼인지 고른다. 사람이 지정하지 않아도 알아서 갈린다.
sub 폼고르기 {
  my ($머리글) = @_;
  return \%키워드16 if 열찾기($머리글, '이번 미션 핵심') >= 0;
  return \%키워드19;
}

sub 칸읽기 {
  my ($행, $머리글, $규칙) = @_;
  return '' unless defined $규칙;
  my ($kw, $sep, $idx) = ref($규칙) eq 'ARRAY' ? @$규칙 : ($규칙, undef, undef);
  my $i = 열찾기($머리글, $kw);
  return '' if $i < 0;
  my $v = defined $행->[$i] ? $행->[$i] : '';
  if (defined $sep) {
    my @p = split /\Q$sep\E/, $v;
    $v = defined $p[$idx] ? $p[$idx] : '';
  }
  $v =~ s/^\s+|\s+$//g;
  return $v;
}

# 폼에 없는 항목 — 보완내용의 공통 기본값으로만 채워진다
my @추가항목 = ('영상길이', '콘텐츠제출일', '인사이트기한', '필수해시태그',
                '저작권', '파트너십광고');

# ── 브랜드별 최초 작성일 ──
# 산출물 이름 앞에 붙는 날짜다. **최초 작성일로 고정한다.**
# 내용을 고쳐 다시 만들어도 날짜가 바뀌면 안 된다. 같은 건의 파일이 날짜별로
# 흩어지고, 광고주·인플루언서에게 이미 전달한 이름과 어긋나기 때문이다.
# 그래서 오늘 날짜를 쓰지 않고, 작성일.tsv 에 적힌 값을 쓴다. 없는 브랜드만 오늘로 새로 적는다.
my @오늘 = localtime;
my $오늘날짜 = sprintf("%04d-%02d-%02d", $오늘[5]+1900, $오늘[4]+1, $오늘[3]);

my $작성일파일 = $SUP;
$작성일파일 =~ s{[^/\\]+$}{작성일.tsv};      # 보완내용.tsv 와 같은 폴더에 둔다

my %작성일;
if (-f encode("UTF-8", $작성일파일)) {
  open(my $A, "<:encoding(UTF-8)", encode("UTF-8", $작성일파일)) or die "작성일: $!";
  my $ln = 0;
  while (my $l = <$A>) {
    $ln++;
    $l =~ s/[\r\n]+$//;
    next if $ln == 1 || $l =~ /^\s*$/;
    my ($b, $dt) = split /\t/, $l;
    $작성일{$b} = $dt if defined $dt && $dt ne '';
  }
  close $A;
}
my $작성일추가 = 0;

sub 작성일 {
  my ($b) = @_;
  return $작성일{$b} if exists $작성일{$b};
  $작성일{$b} = $오늘날짜;
  $작성일추가++;
  return $오늘날짜;
}

my $ZWSP = chr(0x200B);

# 긴 URL 처럼 공백 없이 이어진 문자열은 워드에서 줄바꿈되지 않아 표가 페이지를 넘긴다.
# 구분자 뒤에 폭 없는 공백(U+200B)을 넣어 줄바꿈 지점을 만든다. 보이는 글자는 변하지 않는다.
sub 줄바꿈지점 {
  my ($v) = @_;
  my @out;
  for my $tok (split /(\s+)/, $v) {
    if ($tok =~ /\S/ && length($tok) >= 60) {
      $tok =~ s{([/?&=%._~-])}{$1 . $ZWSP}ge;
      $tok =~ s{([^\s$ZWSP]{40})}{$1 . $ZWSP}ge;   # 구분자가 없어 여전히 길면 강제로 끊는다
    }
    push @out, $tok;
  }
  return join('', @out);
}

sub esc {
  my ($v) = @_;
  $v = '' unless defined $v;
  $v =~ s/\r//g;
  $v =~ s/^\s+//; $v =~ s/\s+$//;
  $v = 줄바꿈지점($v);
  $v =~ s/&/&amp;/g; $v =~ s/</&lt;/g; $v =~ s/>/&gt;/g;
  return $v;
}

# 광고주 원문 → 검정
sub 원문 { my ($v) = @_; return '<span class="pp-orig">' . esc($v) . '</span>'; }

# 포포몬비즈 신규 기입 → 빨강
sub 신규 {
  my ($v) = @_;
  return '<span class="tag tag-new">제안</span><span class="pp-new">' . esc($v) . '</span>';
}

# 정리(수정) → 원본 검정 + 정리본 빨강 을 함께
sub 정리본 {
  my ($orig, $new) = @_;
  return '<span class="tag tag-orig">원문</span><span class="pp-orig">' . esc($orig) . '</span><br>'
       . '<span class="tag tag-new">정리</span><span class="pp-new">' . esc($new) . '</span>';
}

# 추가 → 광고주 원문(검정) 아래에 포포몬비즈 보완(빨강) 을 덧붙인다
sub 추가본 {
  my ($orig, $add) = @_;
  return '<span class="tag tag-orig">원문</span><span class="pp-orig">' . esc($orig) . '</span><br><br>'
       . '<span class="tag tag-new">보완</span><span class="pp-new">' . esc($add) . '</span>';
}

sub 파일명 {
  my ($s) = @_;
  $s =~ s{[\\/:*?"<>|]}{}g;
  $s =~ s/\s+/ /g;
  return $s;
}

# Apps Script 로 넘길 데이터용 문자열 인코더.
# 한글은 그대로 둔다 (.gs 파일은 UTF-8). 제어문자와 인용부호만 처리한다.
sub js {
  my ($v) = @_;
  $v = '' unless defined $v;
  $v =~ s/\\/\\\\/g;
  $v =~ s/"/\\"/g;
  $v =~ s/\r//g;
  $v =~ s/\n/\\n/g;
  $v =~ s/\t/\\t/g;
  return '"' . $v . '"';
}

my (@만든것, @기록, @데이터);
my %발행날짜;   # 파일명 → 최초 작성일. 파일명과 브랜드명이 다를 수 있어 따로 들고 간다

# 가이드에 들어가는 전체 항목. 폼에 문항이 없어도 자리를 비워 둔다.
# 자리가 아예 없으면 보완내용.tsv 로도 못 채운다.
my @전체항목 = ('브랜드명', '링크', '홍보제품', '제공혜택', '진행방식', '브랜드소개',
                '강조포인트', '캠페인목적', '콘텐츠스타일', '분위기', '필수장면',
                '게시글필수항목', '사람태그', '레퍼런스링크', '일정', '업로드시점',
                '금지사항', '2차활용', @추가항목);

my @모든행;   # [ 행, 머리글, 키워드 ]
for my $묶 (@묶음) {
  my $kw = 폼고르기($묶->{머리글});
  push @모든행, [ $_, $묶->{머리글}, $kw ] for @{ $묶->{행들} };
}

for my $쌍 (@모든행) {
  my ($r, $머리글, $키워드) = @$쌍;
  my $브랜드raw = 칸읽기($r, $머리글, $키워드->{'브랜드명'});
  next if $브랜드raw eq '';

  my %v;

  # 1) 폼 응답 (검정)
  for my $k (@전체항목) {
    my $raw = 칸읽기($r, $머리글, $키워드->{$k});
    $v{$k} = { 원본 => $raw, 보완 => '', 구분 => '원문',
               html => ($raw eq '' ? '' : 원문($raw)) };
  }

  # 2) 보완 적용 — 브랜드 전용이 공통보다 우선
  for my $src ('*', $브랜드raw) {
    my $h = $보완{$src} || {};
    for my $k (sort keys %$h) {
      my $구분 = $h->{$k}{구분};
      my $값   = $h->{$k}{값};
      my $원본 = $v{$k} ? $v{$k}{원본} : '';

      if ($구분 eq '대체') {
        # 광고주가 원문 자체를 바꿔 달라고 한 경우 (예: 레일큐브 결제·쇼핑백 장면 삭제, 2026-10-02).
        # 새 값을 광고주 원문(검정)으로 보여 준다. 원래 폼 원문은 근거 칸에만 남긴다.
        $v{$k}{원본} = $값;
        $v{$k}{html} = ($값 eq '' ? '' : 원문($값));
        $v{$k}{구분} = '원문';
        push @기록, "$브랜드raw / $k / 대체";
      } elsif ($구분 eq '정리') {
        next if $원본 eq '';                       # 원본이 없으면 정리할 게 없다
        $v{$k}{html} = 정리본($원본, $값);
        $v{$k}{구분} = '정리';
        $v{$k}{보완} = $값;
        push @기록, "$브랜드raw / $k / 정리";
      } elsif ($구분 eq '추가') {
        # 광고주 원문이 있으면 그 아래에 보완을 덧붙이고, 없으면 신규로 처리한다
        if ($원본 eq '') { $v{$k}{html} = 신규($값);        $v{$k}{구분} = '제안'; }
        else             { $v{$k}{html} = 추가본($원본, $값); $v{$k}{구분} = '보완'; }
        $v{$k}{보완} = $값;
        push @기록, "$브랜드raw / $k / 추가";
      } else {
        next if $원본 ne '';                       # 광고주 원문이 있으면 건드리지 않는다
        $v{$k}{html} = 신규($값);
        $v{$k}{구분} = '제안';
        $v{$k}{보완} = $값;
        push @기록, "$브랜드raw / $k / 신규";
      }
    }
  }

  # 3) 그래도 빈 항목
  my @미작성;
  for my $k (keys %v) {
    if ($v{$k}{html} eq '') {
      $v{$k}{html} = 신규('❗작성 필요');
      $v{$k}{구분} = '제안';
      $v{$k}{보완} = '❗작성 필요';
      push @미작성, $k;
    }
  }

  my %치환 = map { $_ => $v{$_}{html} } keys %v;
  $치환{'브랜드명'}   = esc($브랜드raw);
  $치환{'프로젝트명'} = esc($브랜드raw) . ' 기획형 인플루언서 콘텐츠 제작';

  my $out = $tpl;
  for my $k (keys %치환) {
    my $ph = '{{' . $k . '}}';
    my $val = $치환{$k};
    $out =~ s/\Q$ph\E/$val/g;
  }
  $out =~ s{src="이미지/}{src="../이미지/}g;
  $out =~ s{url\("이미지/}{url("../이미지/}g;

  my $남은 = () = $out =~ /\{\{/g;
  my $name = 파일명($브랜드raw);
  open(my $O, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/$name.html")) or die "$name: $!";
  print $O $out; close $O;

  # ── 구글 문서용 데이터 ──
  my $접수일 = $r->[0]; $접수일 = '' unless defined $접수일;
  $접수일 =~ s/^\s+//; $접수일 =~ s/\s+$//;
  # 구글 폼 타임스탬프 「2026. 9. 10 오후 1:53:22」 → 2026-09-10
  if ($접수일 =~ /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/) {
    $접수일 = sprintf("%04d-%02d-%02d", $1, $2, $3);
  }
  # 키까지 인용부호로 감싼다 — 그래야 JSON 으로도, 자바스크립트로도 그대로 읽힌다
  my @항목;
  push @항목, '      ' . js('기본제작안내') . ': {' . js('구분') . ': ' . js('원문')
            . ', ' . js('원문') . ': ' . js(join("\n", @기본안내))
            . ', ' . js('보완') . ': ' . js('') . '}';
  for my $k (sort keys %v) {
    next if $k eq '브랜드명';
    push @항목, '      ' . js($k) . ': {' . js('구분') . ': ' . js($v{$k}{구분})
              . ', ' . js('원문') . ': ' . js($v{$k}{원본})
              . ', ' . js('보완') . ': ' . js($v{$k}{보완}) . '}';
  }
  push @데이터,
      "  {\n    " . js('브랜드') . ': ' . js($브랜드raw) . ",\n"
    . "    " . js('접수일') . ': ' . js($접수일) . ",\n"
    . "    " . js('날짜') . ': ' . js(작성일($브랜드raw)) . ",\n"
    . "    " . js('항목') . ": {\n" . join(",\n", @항목) . "\n    }\n  }";

  printf("%-26s %s  남은변수 %d  작성필요 %s\n", $브랜드raw, 작성일($브랜드raw), $남은,
         (@미작성 ? join(',', @미작성) : '없음'));
  push @만든것, $name;
  $발행날짜{$name} = 작성일($브랜드raw);
}

open(my $L, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/_목록.txt")) or die $!;
print $L join("\n", @만든것), "\n";
close $L;

# 발행 이름표 — 작업 HTML 이름 <TAB> 발행 파일명(날짜 접두)
# 변환할 때 이 파일을 읽으면 날짜를 손으로 붙이지 않아도 된다.
open(my $P, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/_발행.tsv")) or die $!;
print $P "$_\t$발행날짜{$_} $_ 콘텐츠 제작 가이드\n" for @만든것;
close $P;

# 최초 작성일 기록을 되저장한다. 이 파일은 저장소에 커밋해 이력을 남긴다.
{
  open(my $A, ">:encoding(UTF-8)", encode("UTF-8", $작성일파일)) or die "작성일 쓰기: $!";
  print $A "브랜드\t최초작성일\n";
  print $A "$_\t$작성일{$_}\n" for sort keys %작성일;
  close $A;
}

# ── 구글 문서·시트용 데이터 ──
# 구글 쪽 내용이 DOCX·PDF 와 어긋나지 않도록 출처를 하나로 둔다.
#   데이터.json → 도구/시트올리기.sh 가 웹앱으로 보낸다 (기본 경로)
#   데이터.gs   → 웹앱을 못 쓸 때 Apps Script 에 직접 붙여 넣는 대비용
my $본문 = join(",\n", @데이터);

open(my $J, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/데이터.json")) or die $!;
print $J "[\n", $본문, "\n]\n";
close $J;

my @t = localtime;
my $지금 = sprintf("%04d-%02d-%02d %02d:%02d",
                   $t[5]+1900, $t[4]+1, $t[3], $t[2], $t[1]);
open(my $G, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/데이터.gs")) or die $!;
print $G <<"GS";
// 자동 생성 파일 — 손으로 고치지 않는다.
// 만든 것 : 가이드생성.pl  (5-0 응답 CSV + 보완내용.tsv)
// 생성 시각 : $지금
//
// 평소에는 이 파일을 쓸 일이 없다. 도구/시트올리기.sh 가 데이터.json 을 웹앱으로 보낸다.
// 웹앱을 못 쓸 때만 Apps Script 프로젝트에 「데이터.gs」 로 붙여 넣고 [전체생성_덮어쓰기] 를 실행한다.
//
// 구분 : 원문 = 광고주 제출(검정) / 제안 = 포포몬비즈 신규(빨강)
//        정리 = 원문 정리(검정+빨강) / 보완 = 원문에 덧붙임(검정+빨강)

var 가이드데이터 = [
GS
print $G $본문, "\n];\n";
close $G;

print "\n보완 적용 ", scalar(@기록), "건\n";
print "  · $_\n" for @기록;
print "\n생성 ", scalar(@만든것), "건  (+ 데이터.json, 데이터.gs)\n";
