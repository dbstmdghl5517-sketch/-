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
my @rows;
{
  local $/;
  open(my $F, "<:encoding(UTF-8)", encode("UTF-8", $CSV)) or die "CSV: $!";
  my $raw = <$F>; close $F;
  my @cur; my $fld = ''; my $q = 0;
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
}

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

my %col = (
  '브랜드명'       => 1,  '링크'         => 3,  '홍보제품'     => 4,
  '제공혜택'       => 5,  '진행방식'     => 6,  '브랜드소개'   => 7,
  '강조포인트'     => 8,  '캠페인목적'   => 9,  '콘텐츠스타일' => 10,
  '분위기'         => 11, '필수장면'     => 12, '게시글필수항목' => 13,
  '사람태그'       => 14, '레퍼런스링크' => 15, '일정'         => 16,
  '업로드시점'     => 17, '금지사항'     => 18, '2차활용'      => 19,
);

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

for my $i (1 .. $#rows) {
  my $r = $rows[$i];
  my $브랜드raw = $r->[1]; $브랜드raw = '' unless defined $브랜드raw;
  $브랜드raw =~ s/^\s+//; $브랜드raw =~ s/\s+$//;
  next if $브랜드raw eq '';

  my %v;

  # 1) 폼 응답 (검정)
  for my $k (keys %col) {
    my $raw = $r->[$col{$k}];
    $raw = '' unless defined $raw;
    $raw =~ s/^\s+//; $raw =~ s/\s+$//;
    $v{$k} = { 원본 => $raw, 보완 => '', 구분 => '원문',
               html => ($raw eq '' ? '' : 원문($raw)) };
  }
  for my $k (@추가항목) {
    $v{$k} = { 원본 => '', 보완 => '', 구분 => '원문', html => '' };
  }

  # 2) 보완 적용 — 브랜드 전용이 공통보다 우선
  for my $src ('*', $브랜드raw) {
    my $h = $보완{$src} || {};
    for my $k (sort keys %$h) {
      my $구분 = $h->{$k}{구분};
      my $값   = $h->{$k}{값};
      my $원본 = $v{$k} ? $v{$k}{원본} : '';

      if ($구분 eq '정리') {
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
