use utf8;
use strict;
use warnings;
use Encode qw(encode decode);
@ARGV = map { decode("UTF-8", $_) } @ARGV;
binmode(STDOUT, ":encoding(UTF-8)");

# 3-1 체험단 공고 가이드 (기업용) 생성기
#
#   perl 가이드생성.pl <응답.tsv> <가이드_양식.html> <출력폴더> <보완내용.tsv>
#
# ★ 채널마다 따로 만든다
#   블로그·인스타 피드·인스타 릴스는 **각각 따로 공고를 올린다.**
#   그래서 가이드도 (브랜드 × 채널) 조합마다 한 건씩 나온다.
#   기업이 요청한 채널만 만든다. 요청하지 않은 채널은 만들지 않는다.
#
# 5-1(기획형)과 다른 점
#   · 입력이 구글 시트 CSV 가 아니라 정규화한 응답.tsv 다.
#     3-0 폼이 두 종류이고, B폼은 한 칸에 여러 정보를 묶어 받는다.
#     기계로 정확히 나눌 수 없어 사람이 확인해 응답.tsv 로 옮긴다.
#   · 담당자 연락처는 응답.tsv 에 담지 않는다. 산출물에 쓸 일이 없고 새어 나가면 안 된다.
#   · 보완내용.tsv 의 브랜드 칸에 `브랜드@채널` 을 쓰면 그 채널에만 적용된다.
#     블로그는 글이 길고 릴스는 짧아, 같은 항목을 채널별로 달리 써야 할 때가 있다.
#     적용 순서: `*` → `*@채널` → `브랜드` → `브랜드@채널`

my $TSV  = shift;
my $TPL  = shift;
my $OUTD = shift;
my $SUP  = shift;

my $NL = chr(10);

# 채널 정의. 키는 양식의 {{?블로그}} 블록 이름과 같아야 한다.
my @채널정의 = (
  { 키 => '블로그', 라벨 => '블로그 게시글',     찾기 => qr/블로그/,      짧게 => '블로그' },
  { 키 => '피드',   라벨 => '인스타그램 피드',   찾기 => qr/피드/,        짧게 => '피드' },
  { 키 => '릴스',   라벨 => '인스타그램 릴스',   찾기 => qr/릴스|리일스/, 짧게 => '릴스' },
);

sub 읽기 {
  my ($p) = @_;
  local $/;
  open(my $F, "<:encoding(UTF-8)", encode("UTF-8", $p)) or die "$p: $!";
  my $s = <$F>; close $F;
  return $s;
}

# ── 응답.tsv ──
my (@머리, @행들);
{
  open(my $F, "<:encoding(UTF-8)", encode("UTF-8", $TSV)) or die "응답: $!";
  my $ln = 0;
  while (my $l = <$F>) {
    $ln++;
    $l =~ s/[\r\n]+$//;
    next if $l =~ /^\s*$/;
    my @f = split /\t/, $l, -1;
    for (@f) { s/\\n/$NL/g }
    if ($ln == 1) { @머리 = @f; next }
    push @행들, \@f;
  }
  close $F;
}
die "응답.tsv 에 머리글이 없습니다.\n" unless @머리;

my $tpl = 읽기($TPL);
$tpl =~ s{<!--\n.*?-->\n}{}s;

# ── 보완내용 ──
my %보완;
if (defined $SUP && $SUP ne '' && -f encode("UTF-8", $SUP)) {
  open(my $S, "<:encoding(UTF-8)", encode("UTF-8", $SUP)) or die "보완: $!";
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

# 폼에 문항이 아예 없는 항목. 항상 포포몬비즈가 만든다.
my @추가항목 = ('게시글필수항목', '필수해시태그', '금지사항',
                '영상길이', '콘텐츠제출일', '유지기간',
                # 블로그는 검색이 핵심이라 키워드를 따로 확인받는다.
                # 기업이 준 표현 + 포포몬비즈가 조사한 연관 표현을 합쳐 쓴다.
                # 실제 검색량은 네이버 키워드도구로만 확인되므로, 추천값임을 밝혀야 한다.
                '메인키워드', '추가키워드');

# ── 최초 작성일 ──
# 산출물 이름 앞에 붙는다. 내용을 고쳐 다시 만들어도 바뀌지 않아야 한다.
# 채널마다 따로 만들지만 날짜는 브랜드 단위로 하나를 쓴다. 같은 요청에서 나온 것이다.
my @오늘 = localtime;
my $오늘날짜 = sprintf("%04d-%02d-%02d", $오늘[5]+1900, $오늘[4]+1, $오늘[3]);
my $작성일파일 = $SUP;
$작성일파일 =~ s{[^/\\]+$}{작성일.tsv};

my %작성일;
if (-f encode("UTF-8", $작성일파일)) {
  open(my $A, "<:encoding(UTF-8)", encode("UTF-8", $작성일파일)) or die $!;
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
sub 작성일 {
  my ($b) = @_;
  $작성일{$b} = $오늘날짜 unless exists $작성일{$b};
  return $작성일{$b};
}

my $ZWSP = chr(0x200B);

# 긴 URL·주소는 워드에서 줄바꿈되지 않아 표가 페이지를 넘긴다.
sub 줄바꿈지점 {
  my ($v) = @_;
  my @out;
  for my $tok (split /(\s+)/, $v) {
    if ($tok =~ /\S/ && length($tok) >= 60) {
      $tok =~ s{([/?&=%._~-])}{$1 . $ZWSP}ge;
      $tok =~ s{([^\s$ZWSP]{40})}{$1 . $ZWSP}ge;
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

sub 원문 { my ($v) = @_; return '<span class="pp-orig">' . esc($v) . '</span>'; }

sub 신규 {
  my ($v) = @_;
  return '<span class="tag tag-new">제안</span><span class="pp-new">' . esc($v) . '</span>';
}

sub 정리본 {
  my ($o, $n) = @_;
  return '<span class="tag tag-orig">원문</span><span class="pp-orig">' . esc($o) . '</span><br>'
       . '<span class="tag tag-new">정리</span><span class="pp-new">' . esc($n) . '</span>';
}

sub 추가본 {
  my ($o, $a) = @_;
  return '<span class="tag tag-orig">원문</span><span class="pp-orig">' . esc($o) . '</span><br><br>'
       . '<span class="tag tag-new">보완</span><span class="pp-new">' . esc($a) . '</span>';
}

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

sub 파일명 {
  my ($s) = @_;
  $s =~ s{[\\/:*?"<>|]}{}g;
  $s =~ s/\s+/ /g;
  return $s;
}

my (@만든것, @기록, @데이터, @경고);
my %발행명;

for my $r (@행들) {
  my %응답;
  for my $i (0 .. $#머리) {
    my $v = defined $r->[$i] ? $r->[$i] : '';
    $v =~ s/^\s+//; $v =~ s/\s+$//;
    $응답{$머리[$i]} = $v;
  }

  my $브랜드 = $응답{'브랜드명'};
  next if !defined $브랜드 || $브랜드 eq '';

  # 기업이 요청한 채널만 고른다
  my $요청 = $응답{'콘텐츠형태'} // '';
  my @채널 = grep { $요청 =~ $_->{찾기} } @채널정의;
  unless (@채널) {
    push @경고, "$브랜드: 요청 채널을 못 찾았습니다 (콘텐츠형태: $요청). 가이드를 만들지 않았습니다";
    next;
  }

  for my $ch (@채널) {
    # 1) 기업 원문 (검정)
    my %v;
    for my $k (@머리) {
      next if $k eq '브랜드명' || $k eq '접수일' || $k eq '폼' || $k eq '콘텐츠형태';
      my $raw = $응답{$k};
      $raw = '' unless defined $raw;
      $v{$k} = { 원본 => $raw, 보완 => '', 구분 => '원문',
                 html => ($raw eq '' ? '' : 원문($raw)) };
    }
    for my $k (@추가항목) {
      $v{$k} = { 원본 => '', 보완 => '', 구분 => '원문', html => '' };
    }

    # 2) 보완 적용 — 뒤에 오는 것이 앞을 덮는다
    #    `*` → `*@채널` → `브랜드` → `브랜드@채널`
    for my $src ('*', '*@' . $ch->{키}, $브랜드, $브랜드 . '@' . $ch->{키}) {
      my $h = $보완{$src} || {};
      for my $k (sort keys %$h) {
        my $구분 = $h->{$k}{구분};
        my $값   = $h->{$k}{값};
        next unless exists $v{$k};
        my $원본 = $v{$k}{원본};

        if ($구분 eq '정리') {
          next if $원본 eq '';
          $v{$k}{html} = 정리본($원본, $값);
          $v{$k}{구분} = '정리';
          $v{$k}{보완} = $값;
          push @기록, "$브랜드 ($ch->{짧게}) / $k / 정리";
        } elsif ($구분 eq '추가') {
          # 원문이 없고 공통 기본값이 이미 들어와 있으면 그 뒤에 이어 붙인다.
          # 덮어쓰면 공통 주의사항 같은 것이 브랜드 항목에 밀려 사라진다.
          my $앞 = $v{$k}{보완};
          if ($원본 ne '') {
            $v{$k}{html} = 추가본($원본, $값);
            $v{$k}{구분} = '보완';
            $v{$k}{보완} = $값;
          } elsif ($앞 ne '') {
            my $합 = "$앞$NL$값";
            $v{$k}{html} = 신규($합);
            $v{$k}{구분} = '제안';
            $v{$k}{보완} = $합;
          } else {
            $v{$k}{html} = 신규($값);
            $v{$k}{구분} = '제안';
            $v{$k}{보완} = $값;
          }
          push @기록, "$브랜드 ($ch->{짧게}) / $k / 추가";
        } else {
          next if $원본 ne '';
          $v{$k}{html} = 신규($값);
          $v{$k}{구분} = '제안';
          $v{$k}{보완} = $값;
          push @기록, "$브랜드 ($ch->{짧게}) / $k / 신규";
        }
      }
    }

    # 3) 그래도 빈 항목
    # 선택 항목은 값이 없으면 양식에서 블록째로 빠지므로 ❗ 를 붙이지 않는다.
    my %선택항목 = map { $_ => 1 } ('추가전달');
    my @미작성;
    for my $k (sort keys %v) {
      next unless $v{$k}{html} eq '';
      next if $선택항목{$k};
      $v{$k}{html} = 신규('❗작성 필요');
      $v{$k}{구분} = '제안';
      $v{$k}{보완} = '❗작성 필요';
      push @미작성, $k;
    }

    # 4) 이 채널 블록만 남긴다
    my $out = $tpl;
    $out =~ s{\{\{\?(.+?)\}\}\n(.*?)\{\{/\1\}\}\n}{
      my ($k, $body) = ($1, $2);
      my $채널블록 = 0;
      $채널블록 = 1 for grep { $_->{키} eq $k } @채널정의;
      my $켜기 = $채널블록 ? ($k eq $ch->{키} ? 1 : 0)
               : (exists $v{$k} && $v{$k}{원본} ne '' ? 1 : 0);
      $켜기 ? $body : '';
    }gse;

    # 5) 치환
    my %치환 = map { $_ => $v{$_}{html} } keys %v;
    $치환{'브랜드명'} = esc($브랜드);
    $치환{'채널'}     = esc($ch->{라벨});
    for my $k (keys %치환) {
      my $ph = '{{' . $k . '}}';
      my $val = $치환{$k};
      $out =~ s/\Q$ph\E/$val/g;
    }

    my $남은 = () = $out =~ /\{\{/g;
    push @경고, "$브랜드 ($ch->{짧게}): 치환되지 않은 변수 ${남은}개" if $남은;

    my $name = 파일명("$브랜드 ($ch->{짧게})");
    open(my $O, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/$name.html")) or die "$name: $!";
    print $O $out; close $O;

    # 6) 시트·4번 공고용 데이터
    my @항목;
    for my $k (sort keys %v) {
      push @항목, '      ' . js($k) . ': {' . js('구분') . ': ' . js($v{$k}{구분})
                . ', ' . js('원문') . ': ' . js($v{$k}{원본})
                . ', ' . js('보완') . ': ' . js($v{$k}{보완}) . '}';
    }
    push @데이터,
        "  {\n    " . js('브랜드') . ': ' . js($브랜드) . ",\n"
      . "    " . js('접수일') . ': ' . js($응답{'접수일'} // '') . ",\n"
      . "    " . js('날짜') . ': ' . js(작성일($브랜드)) . ",\n"
      . "    " . js('폼') . ': ' . js($응답{'폼'} // '') . ",\n"
      . "    " . js('채널') . ': ' . js($ch->{라벨}) . ",\n"
      . "    " . js('채널키') . ': ' . js($ch->{짧게}) . ",\n"
      . "    " . js('항목') . ": {\n" . join(",\n", @항목) . "\n    }\n  }";

    printf("%-34s %s  남은변수 %d  작성필요 %s\n",
           $name, 작성일($브랜드), $남은,
           (@미작성 ? join(',', @미작성) : '없음'));
    push @만든것, $name;
    $발행명{$name} = 작성일($브랜드) . " $브랜드 체험단 진행 가이드 ($ch->{짧게})";
  }
}

open(my $L, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/_목록.txt")) or die $!;
print $L join("\n", @만든것), "\n";
close $L;

open(my $P, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/_발행.tsv")) or die $!;
print $P "$_\t$발행명{$_}\n" for @만든것;
close $P;

open(my $J, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/데이터.json")) or die $!;
print $J "[\n", join(",\n", @데이터), "\n]\n";
close $J;

open(my $A2, ">:encoding(UTF-8)", encode("UTF-8", $작성일파일)) or die "작성일 쓰기: $!";
print $A2 "브랜드\t최초작성일\n";
print $A2 "$_\t$작성일{$_}\n" for sort keys %작성일;
close $A2;

print "\n보완 적용 ", scalar(@기록), "건\n";
print "\n생성 ", scalar(@만든것), "건  (+ 데이터.json)\n";
if (@경고) {
  print "\n경고\n";
  print "  · $_\n" for @경고;
}
