use utf8;
use strict;
use warnings;
use Encode qw(encode decode);
use JSON::PP;
@ARGV = map { decode("UTF-8", $_) } @ARGV;
binmode(STDOUT, ":encoding(UTF-8)");

# 4 진행업체 체험단 공고 가이드 (모집용) 생성기
#
#   perl 공고생성.pl <3-1 데이터.json> <공고_양식.txt> <출력폴더> <공고내용.tsv>
#
# ★ 실제 운영 공고 양식을 따른다
#   포포몬에 올라간 공고(오헬라 사쉐 방향제, 위캔필라테스 무거점)를 그대로 본떴다.
#     이렇게 홍보해 주세요! → 제공 안내 → 방문/체험 진행 안내 → 링크
#     → 콘텐츠 작성 안내 → 꼭 소개해 주세요 → 제목·키워드 → 추가키워드
#     → 사진 촬영 안내 → 필수 해시태그 → 유의사항
#
# ★ 블로그는 키워드(검색) 중심이다
#   메인 키워드를 제목에 넣고 본문에 3회 이상, 추가 키워드는 3~4개 이상 쓰게 한다.
#   피드·릴스에는 키워드 구간이 없다. 해시태그로만 간다.
#   그래서 키워드는 `브랜드@블로그` 로만 넣는다.
#
# ★ 표를 쓰지 않는다
#   공고 업로드 화면에서 표를 못 쓴다. 제목·문단·불릿·번호 목록만 쓴다.
#
# ★ 내용은 3-1 확정본에서 가져온다
#   3-1 이 기업 확인을 받은 내용이다. 여기서 따로 쓰면 승인받은 것과 갈라진다.
#   공고에만 필요한 것(모집 소개 문구, 키워드, 방문 안내 번호 목록)만 공고내용.tsv 에 쓴다.

my $JSON = shift;
my $TPL  = shift;
my $OUTD = shift;
my $SUP  = shift;

my $NL = chr(10);

sub 읽기 {
  my ($p) = @_;
  local $/;
  open(my $F, "<:encoding(UTF-8)", encode("UTF-8", $p)) or die "$p: $!";
  my $s = <$F>; close $F;
  return $s;
}

# ── 브랜드(또는 브랜드@채널) → 항목 → 값 ──
my %보완;
if (defined $SUP && $SUP ne '' && -f encode("UTF-8", $SUP)) {
  open(my $S, "<:encoding(UTF-8)", encode("UTF-8", $SUP)) or die "$SUP: $!";
  my $ln = 0;
  while (my $l = <$S>) {
    $ln++;
    $l =~ s/[\r\n]+$//;
    next if $ln == 1 || $l =~ /^\s*$/;
    my ($b, $k, $v) = split /\t/, $l;
    next unless defined $v;
    $v =~ s/\\n/$NL/g;
    $보완{$b}{$k} = $v;
  }
  close $S;
}

my $tpl  = 읽기($TPL);
my $자료 = decode_json(encode("UTF-8", 읽기($JSON)));

# 내용 없는 답변. 공고에 그대로 나가면 읽는 사람에게 아무 정보가 없다.
sub 무의미 {
  my ($s) = @_;
  return 1 unless defined $s;
  $s =~ s/^\s+//; $s =~ s/\s+$//;
  $s =~ s/[.!~\s]+$//;
  return 1 if $s eq '';
  return 1 if $s =~ /^(없음|없습니다|없어요|해당\s*없음|무|미정|아직\s*미정|-)$/;
  return 1 if $s =~ /^(별도\s*전달|별도\s*안내|별도\s*협의|추후\s*(전달|안내|협의))$/;
  return 0;
}

# 3-1 의 구분별 확정본
sub 확정 {
  my ($d, $k) = @_;
  my $it = $d->{'항목'}{$k};
  return '' unless $it;
  my $g = $it->{'구분'} // '원문';
  my $o = $it->{'원문'} // '';
  my $s = $it->{'보완'} // '';
  $o = '' if 무의미($o);
  return $o                            if $g eq '원문';
  return $s                            if $g eq '제안' || $g eq '정리';
  return ($o eq '' ? $s : "$o$NL$s");  # 보완
}

sub 값 {
  my ($b, $ch, $k) = @_;
  for my $src ($b . '@' . $ch, $b, '*@' . $ch, '*') {
    return $보완{$src}{$k} if exists $보완{$src} && defined $보완{$src}{$k};
  }
  return '';
}

# 모든 줄을 불릿으로
sub 불릿 {
  my ($v) = @_;
  return '' if !defined $v || $v =~ /^\s*$/;
  my @out;
  for my $line (split /\n/, $v) {
    $line =~ s/^\s+//; $line =~ s/\s+$//;
    next if $line eq '';
    next if 무의미($line);
    $line =~ s/^[·*\-]\s*//;
    push @out, "- $line";
  }
  return join($NL, @out);
}

# 번호 목록 (방문 안내처럼 순서가 있는 것)
sub 번호 {
  my ($v) = @_;
  return '' if !defined $v || $v =~ /^\s*$/;
  my @out; my $i = 0;
  for my $line (split /\n/, $v) {
    $line =~ s/^\s+//; $line =~ s/\s+$//;
    next if $line eq '';
    $line =~ s/^\d+[.)]\s*//;
    $line =~ s/^[·*\-]\s*//;
    $i++;
    push @out, "$i. $line";
  }
  return join($NL, @out);
}

sub 파일명 {
  my ($s) = @_;
  $s =~ s{[\\/:*?"<>|]}{}g;
  $s =~ s/\s+/ /g;
  return $s;
}

my (@만든것, @경고);
my %발행명;

for my $d (@$자료) {
  my $b  = $d->{'브랜드'};
  my $ch = $d->{'채널키'} // '';
  next if !defined $b || $b eq '';

  my %v;
  $v{'브랜드명'} = $b;
  $v{'채널짧게'} = ($ch eq '블로그' ? '블로그' : ($ch eq '피드' ? '인스타그램' : '인스타그램 릴스'));
  $v{'채널'}     = $d->{'채널'} // $ch;

  # 방문형 / 배송형
  my $형태 = 확정($d, '캠페인형태');
  my $방문 = ($형태 =~ /방문/) ? 1 : 0;
  my $배송 = ($형태 =~ /배송|제품|발송/) ? 1 : 0;
  $배송 = 1 if !$방문 && !$배송;              # 알 수 없으면 배송형으로 둔다
  $v{'방문형'} = $방문 ? '있음' : '';
  $v{'배송형'} = (!$방문 && $배송) ? '있음' : '';

  # 3-1 확정본에서 오는 것
  $v{'체험시간'} = 확정($d, '체험시간');
  $v{'체험기간'} = 확정($d, '체험기간');
  $v{'방문주소'} = 확정($d, '방문주소');
  $v{'필수해시태그'} = 확정($d, '필수해시태그');

  # 공고에만 필요한 것
  for my $k ('모집소개', '제공안내', '제공인원', '체험장소', '업로드기한',
             '방문안내', '브랜드링크', '링크라벨', '작성안내', '소개항목',
             '메인키워드', '추가키워드', '촬영안내', '촬영매수안내') {
    $v{$k} = 값($b, $ch, $k);
  }

  # 비어 있으면 3-1 내용으로 메운다
  $v{'소개항목'} = 확정($d, '핵심내용') if $v{'소개항목'} eq '';
  $v{'촬영안내'} = 확정($d, '필수장면') if $v{'촬영안내'} eq '';
  $v{'업로드기한'} = 확정($d, '콘텐츠제출일') if $v{'업로드기한'} eq '';
  $v{'체험장소'} = $b if $v{'체험장소'} eq '' && $방문;

  # 목록 모양으로
  $v{'제공안내'}   = 불릿($v{'제공안내'});
  $v{'소개항목'}   = 불릿($v{'소개항목'});
  $v{'촬영안내'}   = 불릿($v{'촬영안내'});
  $v{'작성안내'}   = 불릿($v{'작성안내'});
  $v{'메인키워드'} = 불릿($v{'메인키워드'});
  $v{'추가키워드'} = 불릿($v{'추가키워드'});
  $v{'방문안내'}   = 번호($v{'방문안내'});

  for my $k ('제공인원', '업로드기한', '체험시간', '체험기간', '방문주소', '체험장소') {
    $v{$k} = '❗확인 필요' if 무의미($v{$k});
  }

  # 한 줄 항목(`- 방문 가능 시간: …`)에 들어가는 값은 줄바꿈을 지운다.
  # 그대로 두면 둘째 줄이 불릿 밖으로 튀어나가 목록이 끊긴다.
  for my $k ('체험시간', '체험기간', '방문주소', '체험장소', '제공인원', '업로드기한') {
    $v{$k} =~ s/\s*\n\s*/ \/ /g;
  }

  # 선택 블록 처리 — 값이 없으면 그 줄·문단을 통째로 지운다
  my $out = $tpl;
  $out =~ s{\{\{\?(.+?)\}\}\n(.*?)\{\{/\1\}\}\n}{
    my ($k, $body) = ($1, $2);
    (defined $v{$k} && $v{$k} ne '') ? $body : '';
  }gse;

  for my $k (sort { length($b) <=> length($a) } keys %v) {
    my $ph = '{{' . $k . '}}';
    my $val = defined $v{$k} ? $v{$k} : '';
    $out =~ s/\Q$ph\E/$val/g;
  }

  my $남은   = () = $out =~ /\{\{/g;
  my $미확인 = () = $out =~ /❗확인 필요/g;
  push @경고, "$b ($ch): 치환되지 않은 변수 ${남은}개" if $남은;

  my $날짜 = $d->{'날짜'} // '';
  my $name = 파일명(($날짜 ne '' ? "$날짜 " : '') . "$b ($ch)");
  open(my $O, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/$name.txt")) or die "$name: $!";
  print $O $out; close $O;

  printf("%-40s %-6s 남은변수 %d  확인필요 %d\n",
         $name, ($방문 ? '방문형' : '배송형'), $남은, $미확인);
  push @만든것, $name;
  $발행명{$name} = "$날짜 $b 체험단 공고 ($ch)";
}

open(my $L, ">:encoding(UTF-8)", encode("UTF-8", "$OUTD/_목록.txt")) or die $!;
print $L join("\n", @만든것), "\n";
close $L;

print "\n생성 ", scalar(@만든것), "건\n";
if (@경고) {
  print "\n경고\n";
  print "  · $_\n" for @경고;
}
