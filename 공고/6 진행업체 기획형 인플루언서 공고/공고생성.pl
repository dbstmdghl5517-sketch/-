use utf8;
use strict;
use warnings;
use Encode qw(encode decode);
use JSON::PP;
@ARGV = map { decode("UTF-8", $_) } @ARGV;
binmode(STDOUT, ":encoding(UTF-8)");

# 6 진행업체 기획형 인플루언서 공고 생성기
#
#   perl 공고생성.pl <5-1 데이터.json> <공고_양식.txt> <출력폴더> <방향.tsv> <모집.tsv>
#
# 왜 5-1 데이터를 쓰는가
#   5-1 은 광고주 확인용(원문 검정 + 보완 빨강)이고, 6 은 인플루언서가 보는 실제 공고다.
#   내용이 갈라지면 광고주가 승인한 것과 다른 것이 인플루언서에게 간다.
#   그래서 6 은 5-1 의 **확정본만** 뽑아 쓴다. 따로 입력하지 않는다.
#
# 확정본 규칙 (5-1 의 구분별)
#   원문 → 광고주 원문 그대로
#   제안 → 포포몬비즈가 새로 쓴 것 (원문이 없다)
#   정리 → 정리본만 (원문을 다시 쓴 것이므로 원문은 버린다)
#   보완 → 원문 + 보완 (원문에도 정보가 있어 둘 다 필요하다)
#
# 출력은 표 없는 텍스트다. 실제 공고 업로드 화면에서 표를 못 쓰기 때문이다.
#   ##  → 큰 제목 / ### → 작은 제목 / - → 불릿 / 1. → 번호 / --- → 구분선
#   도구/노션올리기.sh 가 이 형식을 노션 블록으로 바꾼다.

my $JSON = shift;
my $TPL  = shift;
my $OUTD = shift;
my $DIR  = shift;   # 방향.tsv
my $REC  = shift;   # 모집.tsv

my $NL = chr(10);

sub 읽기 {
  my ($p) = @_;
  local $/;
  open(my $F, "<:encoding(UTF-8)", encode("UTF-8", $p)) or die "$p: $!";
  my $s = <$F>; close $F;
  return $s;
}

# ── 브랜드 → 항목 → 값 (3열 TSV) ──
sub 표읽기 {
  my ($p) = @_;
  my %h;
  return \%h unless defined $p && $p ne '' && -f encode("UTF-8", $p);
  open(my $F, "<:encoding(UTF-8)", encode("UTF-8", $p)) or die "$p: $!";
  my $ln = 0;
  while (my $l = <$F>) {
    $ln++;
    $l =~ s/[\r\n]+$//;
    next if $ln == 1 || $l =~ /^\s*$/;
    my ($b, $k, $v) = split /\t/, $l;
    next unless defined $v;
    $v =~ s/\\n/$NL/g;
    $h{$b}{$k} = $v;
  }
  close $F;
  return \%h;
}

my $방향 = 표읽기($DIR);
my $모집 = 표읽기($REC);
my $tpl  = 읽기($TPL);
my $자료 = decode_json(encode("UTF-8", 읽기($JSON)));

# 내용이 없는 답변. 5-1(광고주 확인용)에서는 원문이라 남기지만,
# 인플루언서가 보는 공고에 「2차 활용: 아직 미정」, 「참고 콘텐츠: 별도 전달」 이 뜨면
# 읽는 사람에게 아무 정보가 없다. 여기서는 버리고, 그 줄·문단을 통째로 지운다.
sub 무의미 {
  my ($s) = @_;
  return 1 unless defined $s;
  $s =~ s/^\s+//; $s =~ s/\s+$//;
  $s =~ s/[.!~\s]+$//;                 # 「없음.」 처럼 마침표가 붙어 오는 경우가 있다
  return 1 if $s eq '';
  return 1 if $s =~ /^(없음|없습니다|없어요|해당\s*없음|무|미정|아직\s*미정|-)$/;
  return 1 if $s =~ /^(별도\s*전달|별도\s*안내|별도\s*협의|추후\s*(전달|안내|협의))$/;
  return 0;
}

# 값이 없으면 항목째로 빼는 항목. ❗확인 필요 를 붙이지 않는다.
my %선택항목 = map { $_ => 1 }
  ('레퍼런스링크', '일정', '업로드시점', '2차활용', '필수해시태그');

# ── 확정본 ──
sub 확정 {
  my ($d, $k) = @_;
  my $it = $d->{'항목'}{$k};
  return '' unless $it;
  my $g = $it->{'구분'} // '원문';
  my $o = $it->{'원문'} // '';
  my $s = $it->{'보완'} // '';
  $o = '' if 무의미($o);
  if    ($g eq '원문')                  { return $o }
  elsif ($g eq '제안' || $g eq '정리')  { return $s }
  else                                  { return ($o eq '' ? $s : "$o$NL$s") }  # 보완
}

# 여러 줄 값을 불릿 목록으로. 이미 · 나 - 로 시작하는 줄은 기호를 바꿔 준다.
sub 불릿 {
  my ($v) = @_;
  return '- ❗확인 필요' if !defined $v || $v =~ /^\s*$/;
  my @out;
  for my $line (split /\n/, $v) {
    $line =~ s/^\s+//; $line =~ s/\s+$//;
    next if $line eq '';
    if ($line =~ s/^[·*\-]\s*//)          { push @out, "- $line" }
    elsif ($line =~ /^\d+[.)]\s/)         { push @out, $line }
    elsif ($line =~ /^\s*-\s/)            { push @out, $line }
    else                                   { push @out, $line }   # 설명 문장은 문단으로 둔다
  }
  return join($NL, @out);
}

# 모든 줄을 불릿으로. 항목만 들어 있는 값(지원조건·콘텐츠 방향 항목)에 쓴다.
sub 강제불릿 {
  my ($v) = @_;
  return '- ❗확인 필요' if !defined $v || $v =~ /^\s*$/;
  my @out;
  for my $line (split /\n/, $v) {
    $line =~ s/^\s+//; $line =~ s/\s+$//;
    next if $line eq '';
    $line =~ s/^[·*\-]\s*//;
    push @out, "- $line";
  }
  return join($NL, @out);
}

# 게시글 항목은 참고 공고처럼 번호 목록으로 낸다
sub 번호목록 {
  my ($v) = @_;
  return '❗확인 필요' if !defined $v || $v =~ /^\s*$/;
  my @out; my $i = 0;
  for my $line (split /\n/, $v) {
    $line =~ s/^\s+//; $line =~ s/\s+$//;
    next if $line eq '';
    if ($line =~ s/^[·*\-]\s*//) { $i++; push @out, "$i. $line" }
    elsif ($line =~ s/^(\d+)[.)]\s*//) { $i++; push @out, "$i. $line" }
    else { push @out, $line }                                     # 여는 문장
  }
  return join($NL, @out);
}

sub 값 {
  my ($h, $b, $k) = @_;
  return $h->{$b}{$k} if exists $h->{$b} && defined $h->{$b}{$k};
  return $h->{'*'}{$k} if exists $h->{'*'} && defined $h->{'*'}{$k};
  return '';
}

sub 파일명 {
  my ($s) = @_;
  $s =~ s{[\\/:*?"<>|]}{}g;
  $s =~ s/\s+/ /g;
  return $s;
}

my (@만든것, @경고);

for my $d (@$자료) {
  my $b = $d->{'브랜드'};
  next unless defined $b && $b ne '';

  my %v;
  $v{'브랜드'} = $b;

  # 5-1 확정본에서 그대로 오는 것
  for my $k ('브랜드소개', '레퍼런스링크', '콘텐츠제출일', '일정', '영상길이',
             '인사이트기한', '업로드시점', '사람태그', '저작권', '2차활용',
             '파트너십광고', '진행방식', '제공혜택', '금지사항') {
    my $s = 확정($d, $k);
    $s = '' if 무의미($s);
    $v{$k} = ($s ne '' ? $s : ($선택항목{$k} ? '' : '❗확인 필요'));
  }
  $v{'제공내역'} = $v{'제공혜택'};
  $v{'제공내역'} =~ s/\n/ · /g;
  $v{'제공내역목록'} = 강제불릿(확정($d, '제공혜택'));

  $v{'필수장면'}       = 불릿(확정($d, '필수장면'));
  $v{'게시글필수항목'} = 번호목록(확정($d, '게시글필수항목'));

  # 금지사항이 비면 공통 안내만 남긴다. 「없음」 을 그대로 내보내지 않는다.
  my $해시 = 확정($d, '필수해시태그');
  $v{'필수해시태그'} = 무의미($해시) ? '' : $해시;

  my $금지 = 확정($d, '금지사항');
  $v{'금지사항'} = 무의미($금지)
    ? 강제불릿("다른 손님 얼굴이 보이지 않도록 주의해 주세요\n"
             . "같은 업종의 다른 브랜드가 영상에 보이지 않도록 조심해 주세요\n"
             . "실제와 달라 보일 정도로 심하게 보정하지 말아 주세요")
    : 불릿($금지);

  # 모집 개요
  for my $k ('모집인원', '모집기간', '선정발표') {
    my $s = 값($모집, $b, $k);
    $v{$k} = ($s eq '' ? '❗확인 필요' : $s);
  }
  $v{'지원조건'} = 강제불릿(값($모집, $b, '지원조건'));

  # 미션 핵심 · 콘텐츠 방향
  $v{'미션핵심'}   = 값($방향, $b, '미션핵심');
  $v{'마무리문단'} = 값($방향, $b, '마무리문단');
  $v{'미션핵심'}   =~ s/\{\{브랜드\}\}/$b/g;

  my @방향블록;
  for my $n (1, 2) {
    my $t = 값($방향, $b, "방향${n}제목");
    next if $t eq '';
    my $e = 값($방향, $b, "방향${n}설명");
    my $i = 값($방향, $b, "방향${n}항목");
    my $블록 = "### ⏱ $t";
    $블록 .= $NL . $e if $e ne '';
    $블록 .= $NL . 강제불릿($i) if $i ne '';
    push @방향블록, $블록;
  }
  push @경고, "$b: 콘텐츠 방향이 없습니다 (방향.tsv 확인)" unless @방향블록;
  $v{'콘텐츠방향'} = join($NL . $NL, @방향블록);

  # ── 선택 블록 처리 ──
  # 양식의 {{?항목}} … {{/항목}} 은 값이 있을 때만 남긴다.
  # 값이 없으면 그 줄·문단을 통째로 지워, 공고에 빈말이 남지 않게 한다.
  my $out = $tpl;
  $out =~ s{\{\{\?(.+?)\}\}\n(.*?)\{\{/\1\}\}\n}{
    my ($k, $body) = ($1, $2);
    (defined $v{$k} && $v{$k} ne '') ? $body : '';
  }gse;

  # ── 치환 ──
  for my $k (sort { length($b) <=> length($a) } keys %v) {
    my $ph = '{{' . $k . '}}';
    my $val = defined $v{$k} ? $v{$k} : '';
    $out =~ s/\Q$ph\E/$val/g;
  }

  my $남은 = () = $out =~ /\{\{/g;
  my $미확인 = () = $out =~ /❗확인 필요/g;
  push @경고, "$b: 치환되지 않은 변수 ${남은}개" if $남은;

  # 산출물 이름 앞에 만든 날짜를 붙인다. 날짜는 5-1 데이터에서 받아 두 곳이 같은 값을 쓴다.
  my $날짜 = $d->{'날짜'} // '';
  my $name = 파일명(($날짜 ne '' ? "$날짜 " : '') . $b);
  open(my $O, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/$name.txt")) or die "$name: $!";
  print $O $out; close $O;

  printf("%-26s 남은변수 %d  확인필요 %d\n", $b, $남은, $미확인);
  push @만든것, $name;
}

open(my $L, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/_목록.txt")) or die $!;
print $L join("\n", @만든것), "\n";
close $L;

print "\n생성 ", scalar(@만든것), "건\n";
if (@경고) {
  print "\n경고\n";
  print "  · $_\n" for @경고;
}
