/**
 * 광고주 관리 워크북 한 곳에서 전부 보이게 모으는 스크립트
 *
 * ★ 왜 필요한가
 *   지금은 자료가 세 곳에 흩어져 있다.
 *     · 광고주 관리 워크북 — 문의·CS·진행상태 (사장님이 손으로 관리)
 *     · 5-0 응답 시트      — 광고주가 낸 신청서
 *     · 0_가이드 관리 시트 — 5-1 발행 현황
 *   업체 하나의 상황을 보려면 세 군데를 열어야 한다. 이걸 한 워크북으로 모은다.
 *
 * ★ 만드는 것 (광고주 관리 워크북 안)
 *   [기존] 아임웹 문의 탭  ← 맨 아래에 진행 행을 덧붙인다
 *            5-0 브랜드명 : ← 짝을 맞추는 열쇠. 이 값이 없으면 진행 상황이 안 붙는다
 *            5-1 가이드   : 구글 문서 링크
 *            6 공고       : 노션 링크
 *            보완 필요    : 포포몬비즈가 채운 항목
 *            진행 갱신    : 시각
 *   [신설] 발행 이력  ← 원본 기록. 문의 탭은 이걸 보고 채운다
 *   [신설] 5-0 응답   ← 신청서 원본 사본
 *
 * ★ 왜 「5-0 브랜드명」 행이 필요한가
 *   업체명이 두 시스템에서 다르다. 광고주 관리 시트는 「비엘르」, 신청서는 「비엘르 카페」다.
 *   게다가 같은 업체명이 여러 열에 있다 (호텔스토리(프라임)/트레블로지스, 비엘르 각 2열).
 *   업체명으로 짝을 맞추면 어느 열에 써야 할지 알 수 없다.
 *   그래서 열마다 「이 열은 신청서의 어느 브랜드인가」 를 한 번 적어 두고, 그걸로 찾는다.
 *   [초기_브랜드명채우기] 가 헷갈리지 않는 열만 미리 채운다. 중복된 업체명은 비워 두니
 *   사장님이 맞는 열에 직접 적어 주셔야 한다.
 *
 * ★ 행 번호를 고정하지 않는다
 *   A열 라벨로 찾아 쓴다. 중간에 행을 끼워 넣어도 깨지지 않는다.
 *   진행상태·1차cs 처럼 손으로 관리하는 행은 건드리지 않는다.
 *
 * 사용법
 *   1) [초기_탭만들기]        — 발행 이력 · 5-0 응답 탭을 만든다
 *   2) [초기_진행행만들기]    — 문의 탭 맨 아래에 진행 행 5개를 만든다
 *   3) [초기_브랜드명채우기]  — 짝이 분명한 열의 5-0 브랜드명을 채운다
 *   4) 비어 있는 5-0 브랜드명 칸을 사장님이 직접 채운다
 *   5) [전체갱신]             — 이후로는 이것만 실행하면 된다 (또는 트리거)
 */

// ═══════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════

var 통합시트_ID = '14n42XJQ0QzTqzeFkaAHua-SMVQVtJjRQ5OQcpQ9ssl4';
var 문의탭_GID  = 928374615;

var 이력탭명 = '발행 이력';
var 응답탭명 = '기획형 응답';   // 시트에 실제로 있는 탭 이름. 바꾸면 여기도 같이 고친다

// 문의 탭 맨 아래에 덧붙일 행. 순서대로 만든다.
//
// 기획형(5-1·6)과 체험단(3-1·4)을 **따로** 둔다.
// 한 업체가 둘 다 진행하는 경우가 있다(예: 트레블로지 스위트 부산 센텀).
// 행을 하나로 쓰면 나중에 만든 쪽이 앞의 것을 덮어써 링크가 사라진다.
// `5-0 브랜드명` 은 두 종류가 함께 쓰는 열쇠다. 업체 열 하나에 브랜드명 하나면 된다.
var 진행행 = ['5-0 브랜드명',
              '5-1 가이드', '6 공고', '보완 필요',
              '3-1 가이드', '4 공고', '3-1 보완 필요',
              '견적금액', '견적서',
              '진행 갱신'];

// ── 견적 이력 ─────────────────────────────────────────────
// 견적서는 파일로만 남고 시트에 아무 기록이 없었다. 공고와 달리 연동이 없었다.
// 업체·금액·PDF 를 한곳에 쌓아 두면 나중에 「얼마에 보냈더라」를 찾을 수 있다.
var 견적탭명 = '견적 이력';
var 견적머리글 = ['견적일', '업체명', '브랜드', '견적명', '품명', '수량', '단가',
                  '공급가액', '세액', '견적금액(VAT포함)', '견적서', '갱신'];
var 견적폴더명 = '견적서';

// 종류별 행 이름. 이력의 어느 칸을 어느 행에 쓸지 정한다.
var 종류행 = {
  '기획형': { 가이드: '5-1 가이드', 공고: '6 공고',  보완: '보완 필요' },
  '체험단': { 가이드: '3-1 가이드', 공고: '4 공고',  보완: '3-1 보완 필요' }
};

// 이력은 (종류, 채널, 브랜드) 로 찾는다.
// 브랜드명만으로는 기획형과 체험단이 구분되지 않고,
// 체험단은 블로그·인스타·릴스가 각각 따로 올라가는 공고라 채널까지 갈라야 한다.
// 채널을 안 넣으면 나중에 올린 채널이 앞의 것을 덮어쓴다.
var 이력머리글 = ['종류', '채널', '브랜드', '최초작성일', '가이드 문서', '가이드 갱신',
                  '공고 링크', '공고 갱신', '포포몬비즈 보완 항목'];

// 채널 표기. 광고주 관리 탭 한 칸에 여러 채널을 모아 쓸 때 앞에 붙인다.
var 채널표시 = { '블로그': '📝 블로그', '피드': '📷 인스타', '릴스': '🎬 릴스' };

// 업체명이 한 열뿐이어서 헷갈리지 않는 것만 적는다.
// 같은 업체명이 여러 열에 있는 경우(호텔스토리(프라임)/트레블로지스, 비엘르)는
// 어느 열인지 알 수 없으므로 일부러 넣지 않는다.
var 초기짝 = {
  '하나돈까스 일광': '하나돈까스 일광신도시점',
  '국제장여관':      '국제장여관',
  '노쉬프로젝트':    '자갈치오지매'
};

// ═══════════════════════════════════════════════════════════
// 초기 설치
// ═══════════════════════════════════════════════════════════

function 초기_탭만들기() {
  var ss = SpreadsheetApp.openById(통합시트_ID);

  var 이력 = 탭확보(ss, 이력탭명);
  if (이력.getLastRow() === 0) {
    이력.getRange(1, 1, 1, 이력머리글.length).setValues([이력머리글])
        .setFontWeight('bold').setBackground('#F2F4F8');
    이력.setFrozenRows(1);
    [22, 12, 46, 16, 46, 16, 40].forEach(function (w, i) { 이력.setColumnWidth(i + 1, w * 8); });
  }

  탭확보(ss, 응답탭명);
  Logger.log('탭 확인: ' + 이력탭명 + ', ' + 응답탭명);
  Logger.log(ss.getUrl());
}

function 초기_진행행만들기() {
  var sh = 문의탭();
  진행행.forEach(function (라벨) {
    var r = 행확보(sh, 라벨);
    sh.getRange(r, 1).setFontWeight('bold').setBackground('#F2F4F8');
    Logger.log(라벨 + ' → ' + r + '행');
  });
  Logger.log('\n5-0 브랜드명 칸을 채워야 진행 상황이 붙습니다.');
}

function 초기_브랜드명채우기() {
  var sh = 문의탭();
  var 업체행 = 행찾기(sh, '기업명(소속)');
  var 짝행   = 행확보(sh, '5-0 브랜드명');
  if (!업체행) { Logger.log('기업명(소속) 행을 찾지 못했습니다.'); return; }

  var 끝열 = sh.getLastColumn();
  var 업체 = sh.getRange(업체행, 1, 1, 끝열).getValues()[0];
  var 기존 = sh.getRange(짝행, 1, 1, 끝열).getValues()[0];

  // 업체명이 몇 번 나오는지 센다. 두 번 이상이면 어느 열인지 알 수 없어 건너뛴다.
  var 횟수 = {};
  for (var c = 2; c <= 끝열; c++) {
    var n = 첫줄(업체[c - 1]);
    if (n !== '') 횟수[n] = (횟수[n] || 0) + 1;
  }

  var 채움 = 0, 건너뜀 = [];
  for (var c = 2; c <= 끝열; c++) {
    var 이름 = 첫줄(업체[c - 1]);
    if (이름 === '' || 기존[c - 1] !== '') continue;
    if (!초기짝[이름]) continue;
    if (횟수[이름] > 1) { 건너뜀.push(이름 + '(' + c + '열)'); continue; }
    sh.getRange(짝행, c).setValue(초기짝[이름]);
    채움++;
  }

  Logger.log('채운 열: ' + 채움 + '개');
  if (건너뜀.length) {
    Logger.log('\n같은 업체명이 여러 열에 있어 건너뛴 것 — 직접 채워 주세요:');
    건너뜀.forEach(function (s) { Logger.log('  ' + s); });
  }
  Logger.log('\n5-0 브랜드명 행: ' + 짝행 + '행');
}

// ═══════════════════════════════════════════════════════════
// 갱신
// ═══════════════════════════════════════════════════════════

function 전체갱신() {
  var n1 = 응답미러();
  var n2 = 문의탭반영();
  Logger.log('5-0 응답 사본: ' + n1 + '행');
  Logger.log('문의 탭 반영: ' + n2 + '개 업체');
  Logger.log(SpreadsheetApp.openById(통합시트_ID).getUrl());
}

/**
 * 5-0 응답 시트를 통합 워크북의 탭으로 그대로 복사한다.
 *
 * ★ 폼이 여러 개다. 자동알림.gs 의 폼목록 을 그대로 따라간다.
 *   전에는 19문항 폼 하나만 복사해서, 16문항 폼으로 들어온 접수가
 *   광고주 관리 시트에 아예 나타나지 않았다.
 *   폼목록 에 폼을 추가하면 여기도 자동으로 따라온다. 두 곳을 따로 고치지 않는다.
 */
// 합친 응답 탭의 열 순서. 두 폼의 문항을 하나로 모은 것이다.
var 응답열 = ['접수일', '폼', '브랜드명', '담당자', '링크', '홍보제품', '제공혜택',
              '진행방식', '브랜드소개', '강조포인트', '캠페인목적', '콘텐츠스타일',
              '분위기', '필수장면', '게시글필수항목', '사람태그', '레퍼런스링크',
              '일정', '업로드시점', '금지사항', '2차활용',
              '영상길이', '콘텐츠제출일', '인사이트기한', '필수해시태그'];

function 응답미러() {
  if (typeof 폼목록 === 'undefined') {
    Logger.log('자동알림.gs 가 프로젝트에 없습니다. 폼목록 을 찾을 수 없습니다.');
    return 0;
  }
  var ss = SpreadsheetApp.openById(통합시트_ID);

  // ★ 폼이 달라도 **한 탭에 모은다.**
  //   전에는 폼마다 탭을 따로 만들었다. 그러면 새 폼으로 들어온 업체가
  //   늘 보던 탭에 안 나타나 «없다»고 보인다. 실제로 인디언이 그렇게 묻혔다.
  //   문항 수가 달라 열을 그대로는 못 붙이므로, 항목 이름으로 맞춰 넣는다.
  //   그 폼에 없는 문항은 빈 칸으로 둔다.
  var 줄들 = [];
  폼목록.forEach(function (폼) {
    var sh;
    try { sh = 시트(폼); } catch (e) { Logger.log(폼.이름 + ': ' + e); return; }
    var 끝 = sh.getLastRow();
    if (끝 < 2) return;
    var 머리글 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var 값 = sh.getRange(2, 1, 끝 - 1, sh.getLastColumn()).getValues();

    값.forEach(function (행) {
      var 브랜드 = 칸읽기(행, 머리글, 폼.항목.브랜드명);
      if (브랜드 === '') return;
      var 줄 = 응답열.map(function (k) {
        if (k === '폼') return 폼.이름;
        // 접수일은 날짜 값 그대로 넘겨야 한다. 글자로 바꾸면 시:분을 월·일로 읽는다.
        if (k === '접수일') return 날짜문자(칸원본(행, 머리글, 폼.항목.타임스탬프));
        return 칸읽기(행, 머리글, 폼.항목[k]);
      });
      줄들.push(줄);
    });
  });

  var sh2 = 탭확보(ss, 응답탭명);
  sh2.clear();
  sh2.getRange(1, 1, 1, 응답열.length).setValues([응답열])
     .setFontWeight('bold').setBackground('#F2F4F8');
  if (줄들.length) {
    sh2.getRange(2, 1, 줄들.length, 응답열.length).setValues(줄들);
  }
  sh2.setFrozenRows(1);
  sh2.setFrozenColumns(3);

  // 폼마다 따로 만들었던 옛 탭은 치운다. 두 군데를 보면 헷갈린다.
  폼목록.forEach(function (폼) {
    var 옛 = ss.getSheetByName(응답탭명 + ' (' + 폼.이름 + ')');
    if (옛) { ss.deleteSheet(옛); Logger.log('  옛 탭 삭제: ' + 옛.getName()); }
  });

  Logger.log('  ' + 응답탭명 + ': ' + 줄들.length + '건 (폼 ' + 폼목록.length + '개 합침)');
  return 줄들.length;
}

/**
 * 발행 이력 → 문의 탭의 진행 행에 반영.
 * 5-0 브랜드명 행에 적힌 값으로 짝을 찾는다.
 */
function 문의탭반영() {
  var sh = 문의탭();
  var 짝행 = 행찾기(sh, '5-0 브랜드명');
  if (!짝행) { Logger.log('5-0 브랜드명 행이 없습니다. [초기_진행행만들기] 를 먼저 실행하세요.'); return 0; }

  var 이력 = 이력읽기();
  var 끝열 = sh.getLastColumn();
  var 브랜드들 = sh.getRange(짝행, 1, 1, 끝열).getValues()[0];

  // 종류별로 행 번호를 미리 잡아 둔다
  var 행 = {};
  for (var 종류 in 종류행) {
    행[종류] = {
      가이드: 행확보(sh, 종류행[종류].가이드),
      공고:   행확보(sh, 종류행[종류].공고),
      보완:   행확보(sh, 종류행[종류].보완)
    };
  }
  var 갱신행 = 행확보(sh, '진행 갱신');

  var 지금 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  var 붙인수 = 0;

  for (var c = 2; c <= 끝열; c++) {
    // 한 칸에 브랜드를 여럿 적을 수 있다. 쉼표나 줄바꿈으로 나눈다.
    // 업체 열은 하나인데 지점이 둘인 경우(위캔필라테스 반여점·무거점) 때문이다.
    var 브랜드들C = String(브랜드들[c - 1] || '').split(/[,\n]/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; });
    if (!브랜드들C.length) continue;
    var 여럿 = 브랜드들C.length > 1;

    var 하나라도 = false;
    for (var t in 종류행) {
      var 목록 = [];
      브랜드들C.forEach(function (b) {
        var m = 이력.묶음[t + '|' + b];
        if (m) 목록 = 목록.concat(m);
      });
      if (!목록.length) continue;

      // 체험단은 채널마다 공고가 따로 있다. 한 칸에 표기를 붙여 모아 쓴다.
      sh.getRange(행[t].가이드, c).setValue(모아쓰기(목록, '가이드 문서', 여럿)).setWrap(true);
      sh.getRange(행[t].공고,   c).setValue(모아쓰기(목록, '공고 링크', 여럿)).setWrap(true);
      sh.getRange(행[t].보완,   c).setValue(모아쓰기(목록, '포포몬비즈 보완 항목', 여럿))
        .setFontColor('#d40000').setWrap(true);
      하나라도 = true;
    }
    if (하나라도) { sh.getRange(갱신행, c).setValue(지금); 붙인수++; }
  }
  return 붙인수;
}

/**
 * 채널별 값을 한 칸에 모아 쓴다.
 * 채널이 하나뿐이거나 채널 칸이 비어 있으면(기획형) 값만 쓴다.
 *   📝 블로그 https://…
 *   📷 인스타 https://…
 *
 * 한 열에 브랜드가 여럿일 때(위캔필라테스 반여점·무거점)는 브랜드명도 앞에 붙인다.
 * 업체 열은 하나인데 지점이 둘인 경우가 있어, 열을 새로 만들지 않고 한 칸에 모은다.
 */
function 모아쓰기(목록, 칸, 브랜드표시) {
  var 줄 = [];
  목록.forEach(function (o) {
    var v = String(o[칸] == null ? '' : o[칸]).trim();
    if (v === '') return;
    var 앞 = [];
    if (브랜드표시 && o['_브랜드']) 앞.push(o['_브랜드']);
    var ch = o['_채널'] || '';
    if (ch !== '') 앞.push(채널표시[ch] || ch);
    줄.push(앞.length ? (앞.join(' ') + ' ' + v) : v);
  });
  return 줄.join('\n');
}

// ═══════════════════════════════════════════════════════════
// 발행 이력
// ═══════════════════════════════════════════════════════════

/**
 * 이력을 읽어 두 가지로 돌려준다.
 *   낱개: "종류|채널|브랜드" → 행
 *   묶음: "종류|브랜드"      → 채널별 행 목록. 광고주 관리 탭 한 칸에 모아 쓸 때 쓴다
 */
function 이력읽기() {
  var sh = 탭확보(SpreadsheetApp.openById(통합시트_ID), 이력탭명);
  var 낱개 = {}, 묶음 = {};
  if (sh.getLastRow() < 2) return { 낱개: 낱개, 묶음: 묶음 };

  var 값 = sh.getDataRange().getValues();
  var 머리 = 값[0];
  for (var r = 1; r < 값.length; r++) {
    var 종류 = String(값[r][0] || '').trim();
    var 채널 = String(값[r][1] || '').trim();
    var b    = String(값[r][2] || '').trim();
    if (b === '') continue;
    var o = {};
    for (var c = 0; c < 머리.length; c++) o[머리[c]] = 값[r][c];
    o['_채널'] = 채널;
    o['_브랜드'] = b;
    낱개[종류 + '|' + 채널 + '|' + b] = o;
    var k = 종류 + '|' + b;
    if (!묶음[k]) 묶음[k] = [];
    묶음[k].push(o);
  }
  return { 낱개: 낱개, 묶음: 묶음 };
}

// ═══════════════════════════════════════════════════════════
// 매시간 점검 — 조용히 멈춘 자동화를 찾아낸다
// ═══════════════════════════════════════════════════════════
//
// ★ 왜 만들었나
//   아임웹 문의 적재가 멈췄는데 아무도 몰랐다. 트리거는 1시간마다 성실히 돌았지만
//   함수가 없어 실패했고, 그 사실이 어디에도 안 남았다.
//   사용자가 「문의 두 건이 왜 안 들어왔냐」고 물어서야 알았다.
//
//   전에 쓰던 `업데이트` 보고는 **트리거가 걸려 있는지만** 셌다.
//   걸려 있는 것과 잘 도는 것은 다르다. 이제 실제로 돌려 보고 판단한다.
//
// ★ 알림은 상태가 바뀔 때만 보낸다.
//   매시간 같은 실패를 보내면 곧 안 읽게 된다. 처음 실패할 때 한 번,
//   그리고 복구됐을 때 한 번 보낸다.

var 점검상태_속성 = '점검_직전상태';

function 점검항목() {
  return [
    {
      이름: '아임웹 문의 적재',
      설명: '홈페이지 문의를 광고주 관리 시트로 가져온다',
      확인: function () {
        if (typeof 단계3_시트에적재 !== 'function') {
          return { 정상: false, 사유: '단계3_시트에적재 함수가 프로젝트에 없습니다' };
        }
        if (typeof 토큰 !== 'function') return { 정상: false, 사유: '토큰 함수가 없습니다' };

        // ★ 값이 「있는지」가 아니라 「뭔지」를 본다.
        //   자리표시자가 저장돼 있어도 있는 것으로 보여 원인을 놓친 적이 있다.
        var pp = PropertiesService.getScriptProperties();
        var 빈것 = [];
        ['IMWEB_CLIENT_ID', 'IMWEB_CLIENT_SECRET', 'IMWEB_REFRESH_TOKEN'].forEach(function (k) {
          var v = pp.getProperty(k) || '';
          if (!v) 빈것.push(k + ' 없음');
          else if (v.indexOf('여기에') === 0) 빈것.push(k + ' 가 자리표시자입니다');
        });
        if (빈것.length) return { 정상: false, 사유: 빈것.join(' / ') };

        토큰();                                   // 실제로 갱신되는지 본다
        return { 정상: true };
      },
      조치: 'Client ID·Secret 이 자리표시자면 실제 값을 넣으세요(아임웹 개발자센터).'
          + ' 토큰이 만료됐으면 [단계1_승인링크] 실행 → 아임웹 로그인·승인 →'
          + ' 돌아온 주소의 code 값을 담당자에게 전달하세요.'
    },
    {
      이름: '폼 응답 미러',
      설명: '기획형 인플루언서 폼 응답을 시트로 복사한다',
      확인: function () {
        if (typeof 폼목록 === 'undefined') return { 정상: false, 사유: '자동알림.gs 가 없습니다' };
        for (var i = 0; i < 폼목록.length; i++) 시트(폼목록[i]).getLastRow();
        return { 정상: true };
      },
      조치: '폼 시트를 열 수 없습니다. 시트 ID·탭 gid 를 확인하세요.'
    },
    {
      이름: '체험단 폼',
      설명: '체험단 양식폼 2종(A·B)을 읽을 수 있는지',
      확인: function () {
        if (typeof 체험단폼목록 === 'undefined') {
          return { 정상: false, 사유: '자동알림.gs 에 체험단폼목록이 없습니다' };
        }
        var 못연것 = [];
        체험단폼목록.forEach(function (폼) {
          try { 시트(폼).getLastRow(); }
          catch (e) { 못연것.push(폼.이름); }
        });
        if (못연것.length) return { 정상: false, 사유: 못연것.join(', ') + ' 를 못 엽니다' };
        return { 정상: true };
      },
      조치: '체험단 폼 시트 ID 를 확인하세요. 시트가 삭제됐거나 권한이 바뀌었을 수 있습니다.'
    },
    {
      이름: '폼 제출 트리거',
      설명: '새 접수가 들어오면 초안·메일을 만든다',
      확인: function () {
        var n = 0;
        ScriptApp.getProjectTriggers().forEach(function (t) {
          if (t.getHandlerFunction() === '새응답처리') n++;
        });
        var 필요 = (typeof 폼목록 !== 'undefined') ? 폼목록.length : 1;
        if (n < 필요) return { 정상: false, 사유: '폼 ' + 필요 + '개인데 트리거가 ' + n + '개입니다' };
        return { 정상: true };
      },
      조치: '[트리거설치] 를 실행하거나 담당자에게 알리세요.'
    },
    {
      이름: '광고주 관리 시트',
      설명: '업체 현황이 모이는 곳',
      확인: function () {
        var sh = 문의탭();
        if (!행찾기(sh, '기업명(소속)')) return { 정상: false, 사유: '기업명(소속) 행이 없습니다' };
        return { 정상: true };
      },
      조치: '[초기_진행행만들기] 를 실행하세요.'
    }
  ];
}

/** 매시간 도는 점검. 상태가 바뀐 항목만 메일로 알린다. */
function 점검() {
  var 항목들 = 점검항목();
  var 지금 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  var 결과 = [], 나쁨 = {};

  항목들.forEach(function (it) {
    var r;
    try { r = it.확인(); }
    catch (e) { r = { 정상: false, 사유: String(e).replace(/^Error:\s*/, '') }; }
    r.이름 = it.이름; r.조치 = it.조치; r.설명 = it.설명;
    결과.push(r);
    if (!r.정상) 나쁨[it.이름] = r.사유;
  });

  // ★ 열 정렬을 매시간 같이 돌린다.
  //   사용자가 진행상태를 「제안중」으로 바꾸면 그 업체가 왼쪽으로 와야 한다.
  //   전에는 매일 6시에만 정렬돼서, 낮에 바꾸면 다음 날 아침까지 제자리였다.
  //
  //   ※ 정렬만 한다. 진행완료·불발을 **다른 탭으로 옮기는 것은 매일 6시 그대로** 둔다.
  //     옮기는 건 되돌리기 어려워 자주 돌릴 일이 아니다. 정렬은 순서만 바꾸므로 안전하다.
  var 정렬 = 0;
  try {
    var sh0 = 문의탭();
    var 업체행 = 행찾기(sh0, '기업명(소속)');
    var 상태행 = 행찾기(sh0, '진행상태');
    if (업체행 && 상태행) 정렬 = 열정렬(sh0, 업체행, 상태행);
  } catch (e) { Logger.log('열 정렬 실패: ' + e); }

  var p = PropertiesService.getScriptProperties();
  var 직전 = {};
  try { 직전 = JSON.parse(p.getProperty(점검상태_속성) || '{}'); } catch (e) {}

  // 새로 고장난 것 / 새로 고쳐진 것만 추린다
  var 새고장 = [], 복구 = [];
  결과.forEach(function (r) {
    var 전에나빴나 = !!직전[r.이름];
    if (!r.정상 && !전에나빴나) 새고장.push(r);
    if (r.정상 && 전에나빴나)  복구.push(r);
  });

  p.setProperty(점검상태_속성, JSON.stringify(나쁨));
  p.setProperty('점검_마지막시각', 지금);

  if (새고장.length || 복구.length) 점검메일(새고장, 복구, 결과, 지금);

  결과.forEach(function (r) { Logger.log((r.정상 ? '정상 ' : '❗실패 ') + r.이름 + (r.사유 ? ' — ' + r.사유 : '')); });
  Logger.log("열 정렬 " + 정렬 + "번 이동");
  return { 성공: true, 시각: 지금, 결과: 결과, 정렬: 정렬,
           새고장: 새고장.length, 복구: 복구.length };
}

function 점검메일(새고장, 복구, 전체, 지금) {
  var 주소 = PropertiesService.getScriptProperties().getProperty('알림주소');
  if (!주소) { Logger.log('알림주소가 없어 메일을 못 보냅니다.'); return; }

  var 제목 = 새고장.length
    ? '[포포몬비즈] ❗자동화 멈춤 — ' + 새고장.map(function (r) { return r.이름; }).join(', ')
    : '[포포몬비즈] ✅자동화 복구 — ' + 복구.map(function (r) { return r.이름; }).join(', ');

  var 줄 = ['점검 시각 : ' + 지금, ''];
  if (새고장.length) {
    줄.push('■ 멈춘 것');
    새고장.forEach(function (r) {
      줄.push('   · ' + r.이름 + ' — ' + r.설명);
      줄.push('     원인 : ' + r.사유);
      줄.push('     조치 : ' + r.조치);
      줄.push('');
    });
  }
  if (복구.length) {
    줄.push('■ 다시 도는 것');
    복구.forEach(function (r) { 줄.push('   · ' + r.이름); });
    줄.push('');
  }
  줄.push('■ 전체 상태');
  전체.forEach(function (r) { 줄.push('   ' + (r.정상 ? '정상  ' : '❗실패 ') + r.이름); });
  줄.push('');
  줄.push('※ 같은 고장으로 매시간 보내지 않습니다. 상태가 바뀔 때만 옵니다.');

  try { MailApp.sendEmail({ to: 주소, subject: 제목, body: 줄.join('\n') }); }
  catch (e) { Logger.log('점검 메일 실패: ' + e); }
}

/**
 * 견적서 한 건을 기록한다.
 *   1) PDF 를 드라이브 `견적서` 폴더에 올린다 (시트에서 바로 열린다)
 *   2) `견적 이력` 탭에 한 줄 쌓는다 — 같은 (업체, 견적명) 이면 그 줄을 갱신
 *   3) `광고주 관리` 탭의 업체 열에 견적금액·견적서 링크를 넣는다
 *
 * ★ 업체명과 브랜드명은 다르다.
 *   광고주 관리 열은 **업체명**으로 찾는다 (예: 프라임매니지먼트).
 *   브랜드명(예: 트레블로지 스위트 부산 센텀)으로 찾으면 열을 못 찾는다.
 *
 * 인자: { 견적일, 업체명, 브랜드, 견적명, 품명, 수량, 단가,
 *         공급가액, 세액, 견적금액, 파일명, pdf(base64) }
 */
function 견적기록(d) {
  d = d || {};
  var 업체 = String(d.업체명 || '').trim();
  if (업체 === '') return { 성공: false, 오류: '업체명이 비어 있습니다.' };

  // 1) PDF 업로드 — 같은 이름이 있으면 휴지통으로 보내고 새로 올린다
  var 링크 = '';
  if (d.pdf && d.파일명) {
    try {
      var 폴더 = 폴더확보(견적폴더명);
      var it = 폴더.getFilesByName(d.파일명);
      while (it.hasNext()) it.next().setTrashed(true);
      var blob = Utilities.newBlob(Utilities.base64Decode(d.pdf),
                                   'application/pdf', d.파일명);
      링크 = 폴더.createFile(blob).getUrl();
    } catch (e) { Logger.log('PDF 업로드 실패: ' + e); }
  }

  var ss = SpreadsheetApp.openById(통합시트_ID);
  var 지금 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');

  // 2) 견적 이력 탭
  var sh = 탭확보(ss, 견적탭명);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 견적머리글.length).setValues([견적머리글])
      .setFontWeight('bold').setBackground('#F2F4F8');
    sh.setFrozenRows(1);
    [12, 18, 24, 30, 34, 7, 12, 14, 12, 16, 30, 16]
      .forEach(function (w, i) { sh.setColumnWidth(i + 1, w * 8); });
  }
  var 줄 = [d.견적일 || 지금.slice(0, 10), 업체, d.브랜드 || '', d.견적명 || '',
            d.품명 || '', d.수량 || '', d.단가 || '', d.공급가액 || '',
            d.세액 || '', d.견적금액 || '', 링크, 지금];

  // 같은 (업체, 견적명) 이면 덮어쓴다. 다시 뽑을 때마다 줄이 쌓이면 안 된다.
  var 행 = 0;
  if (sh.getLastRow() > 1) {
    var 기존 = sh.getRange(2, 2, sh.getLastRow() - 1, 3).getValues();
    for (var i = 0; i < 기존.length; i++) {
      if (String(기존[i][0]).trim() === 업체 &&
          String(기존[i][2]).trim() === String(d.견적명 || '').trim()) { 행 = i + 2; break; }
    }
  }
  if (!행) 행 = sh.getLastRow() + 1;
  sh.getRange(행, 1, 1, 줄.length).setValues([줄]);

  // 3) 광고주 관리 탭 — 업체 열에 금액과 링크
  // 열 번호를 주면 그 열에 쓴다. 시트 기업명과 실제 상호가 다를 때 쓴다.
  var 반영 = [];
  try {
    var 칸 = d.열 ? { 열: d.열 } : { 기업명: 업체 };
    var r1 = 칸쓰기('견적금액', [{ 기업명: 칸.기업명, 열: 칸.열, 값: d.견적금액 || '' }]);
    var r2 = 칸쓰기('견적서',   [{ 기업명: 칸.기업명, 열: 칸.열, 값: 링크 }]);
    반영 = (r1.쓴것 || []).concat(r2.쓴것 || []);
    if ((r1.건너뜀 || []).length) 반영.push('건너뜀: ' + r1.건너뜀.join(', '));
  } catch (e) { Logger.log('광고주 관리 반영 실패: ' + e); }

  Logger.log('견적 기록: ' + 업체 + ' / ' + (d.견적명 || '') + ' / ' + (d.견적금액 || ''));
  return { 성공: true, 탭: 견적탭명, 행: 행, 링크: 링크, 광고주관리: 반영 };
}

/**
 * 발행 이력에서 잘못 쌓인 줄을 지운다.
 *
 * ★ 왜 필요한가
 *   도구 쪽 변수 이름이 겹쳐 종류가 `page` 로 기록되고, 제목의 이모지를 못 떼어
 *   브랜드명에 「🎬 2026-09-16 …」 이 통째로 들어간 줄이 쌓였다.
 *   도구는 고쳤지만 이미 쌓인 줄은 사람이 지워야 해서 여기에 둔다.
 *
 * ★ 지우는 기준 (둘 중 하나라도 걸리면 잘못된 줄)
 *   · 종류가 기획형·체험단 이 아니다
 *   · 브랜드명이 날짜로 시작한다
 *
 * ★ 지우는 것은 되돌리기 어렵다. 먼저 미리보기로 확인한다.
 */
function 이력정리(미리보기) {
  var sh = 탭확보(SpreadsheetApp.openById(통합시트_ID), 이력탭명);
  var 끝 = sh.getLastRow();
  if (끝 < 2) return { 성공: true, 지움: [], 남음: 0 };

  var 값 = sh.getRange(2, 1, 끝 - 1, 3).getValues();
  var 지울행 = [], 지움 = [];

  for (var i = 0; i < 값.length; i++) {
    var 종류 = String(값[i][0] || '').trim();
    var 브랜드 = String(값[i][2] || '').trim();
    var 나쁨 = (종류 !== '기획형' && 종류 !== '체험단') ||
               /^\s*\d{4}-\d{2}-\d{2}/.test(브랜드);
    if (!나쁨) continue;
    지울행.push(i + 2);
    지움.push('행 ' + (i + 2) + ' · ' + 종류 + ' · ' + 브랜드);
  }

  // 아래쪽부터 지운다. 위부터 지우면 행 번호가 밀려 엉뚱한 줄이 지워진다.
  if (!미리보기) {
    for (var j = 지울행.length - 1; j >= 0; j--) sh.deleteRow(지울행[j]);
  }

  Logger.log((미리보기 ? '[미리보기] ' : '') + '잘못된 줄 ' + 지움.length + '개');
  지움.forEach(function (s) { Logger.log('  🗑 ' + s); });
  return { 성공: true, 미리보기: !!미리보기, 지움: 지움,
           남음: Math.max(0, sh.getLastRow() - 1) };
}

function 이력정리_미리보기() { return 이력정리(true); }

/**
 * 발행 이력에 한 줄 기록(있으면 갱신).
 * 넘기지 않은 칸은 기존 값을 지우지 않는다. 5-1 과 6 이 따로 기록하기 때문이다.
 */
function 이력기록(종류, 채널, 브랜드, 변경) {
  종류   = String(종류   == null ? '' : 종류).trim();
  채널   = String(채널   == null ? '' : 채널).trim();
  브랜드 = String(브랜드 == null ? '' : 브랜드).trim();
  // 빈 브랜드로 들어오면 빈 줄만 쌓인다. 시험 호출에서 실제로 그런 일이 있었다.
  if (브랜드 === '') return 0;
  if (종류 === '') 종류 = '기획형';

  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sh = 탭확보(ss, 이력탭명);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 이력머리글.length).setValues([이력머리글])
      .setFontWeight('bold').setBackground('#F2F4F8');
    sh.setFrozenRows(1);
  }

  var 머리 = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 이력머리글.length)).getValues()[0];
  var 줄 = 0;
  if (sh.getLastRow() > 1) {
    var 값 = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
    for (var i = 0; i < 값.length; i++) {
      if (String(값[i][0]).trim() === 종류 &&
          String(값[i][1]).trim() === 채널 &&
          String(값[i][2]).trim() === 브랜드) { 줄 = i + 2; break; }
    }
  }
  if (!줄) {
    줄 = sh.getLastRow() + 1;
    sh.getRange(줄, 1).setValue(종류);
    sh.getRange(줄, 2).setValue(채널);
    sh.getRange(줄, 3).setValue(브랜드);
  }

  for (var k in 변경) {
    var c = 머리.indexOf(k);
    if (c < 0) continue;
    sh.getRange(줄, c + 1).setValue(변경[k]);
  }
  return 줄;
}

/** 가이드 발행 직후 (5-1 또는 3-1) */
function 이력기록_가이드(종류, 채널, 브랜드, 날짜, 문서url, 보완항목) {
  var 변경 = {};
  변경['최초작성일']          = 날짜 || '';
  변경['가이드 문서']         = 문서url || '';
  변경['가이드 갱신']         = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  변경['포포몬비즈 보완 항목'] = 보완항목 || '';
  return 이력기록(종류, 채널, 브랜드, 변경);
}

/** 공고 업로드 직후 (6 또는 4) */
function 이력기록_공고(종류, 채널, 브랜드, 링크) {
  var 변경 = {};
  변경['공고 링크'] = 링크 || '';
  변경['공고 갱신'] = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return 이력기록(종류, 채널, 브랜드, 변경);
}

// 예전 이름. 구글문서생성.gs 의 5-1 발행 경로가 부른다.
// 기획형은 채널이 하나(릴스)라 채널 칸을 비워 둔다.
function 이력기록_5_1(브랜드, 날짜, 문서url, 보완항목) {
  return 이력기록_가이드('기획형', '', 브랜드, 날짜, 문서url, 보완항목);
}
function 이력기록_6(브랜드, 노션url) {
  return 이력기록_공고('기획형', '', 브랜드, 노션url);
}

/**
 * 이력 탭 머리글을 새 구성(종류·채널 열)으로 바꾼다. 한 번만 실행한다.
 * 옛 행은 전부 기획형으로 보고 칸을 밀어 준다. 기획형은 채널 칸을 비운다.
 * 옛 구성이 두 가지 있을 수 있다.
 *   ① 브랜드로 시작 (종류·채널 없음)
 *   ② 종류로 시작하고 채널만 없음
 */
function 초기_이력탭재구성() {
  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sh = 탭확보(ss, 이력탭명);
  var 값 = sh.getDataRange().getValues();

  if (!값.length) { Logger.log('이력 탭이 비어 있습니다.'); return; }
  var 첫 = String(값[0][0]).trim(), 둘 = String(값[0][1] || '').trim();
  if (첫 === '종류' && 둘 === '채널') { Logger.log('이미 새 구성입니다.'); return; }

  var 종류있음 = (첫 === '종류');
  var 새행 = [이력머리글];
  for (var r = 1; r < 값.length; r++) {
    var 행 = 값[r];
    var 종류 = 종류있음 ? String(행[0] || '기획형').trim() : '기획형';
    var 뒤   = 종류있음 ? 행.slice(1) : 행;            // 브랜드부터
    var b    = String(뒤[0] || '').trim();
    if (b === '' || b === '연결시험') continue;         // 빈 줄·시험 줄은 버린다
    새행.push([종류, '', b, 뒤[1], 뒤[2], 뒤[3], 뒤[4], 뒤[5], 뒤[6]]);
  }

  sh.clear();
  sh.getRange(1, 1, 새행.length, 이력머리글.length).setValues(새행);
  sh.getRange(1, 1, 1, 이력머리글.length).setFontWeight('bold').setBackground('#F2F4F8');
  sh.setFrozenRows(1);
  [10, 10, 22, 12, 46, 16, 46, 16, 40].forEach(function (w, i) { sh.setColumnWidth(i + 1, w * 8); });

  Logger.log('이력 탭 재구성 완료: ' + (새행.length - 1) + '건 (빈 줄·시험 줄 제거)');
}

// ═══════════════════════════════════════════════════════════
// 체험단 가이드 구글 문서 (3-1)
// ═══════════════════════════════════════════════════════════
/**
 * 3-1 체험단 가이드를 브랜드·채널마다 구글 문서로 만든다.
 * 기획형(5-1)은 구글문서생성.gs 가 만든다. 구성이 달라 따로 둔다.
 *
 * 채널별 제작 기준과 기본 제작 안내 문구는 **데이터로 받는다.**
 * 양식(가이드_양식.html)이 유일한 기준이어야 하는데, 여기에 또 적어 두면 두 곳이 갈라진다.
 *
 * 색 구분은 5-1 과 같다. 검정 = 기업 원문, 빨강 = 포포몬비즈 신규·정리.
 */
var 체험단폴더명 = '체험단 공고 가이드';
var 체험단문서접미 = ' 체험단 진행 가이드';

function 체험단문서만들기(데이터) {
  if (!데이터 || !데이터.length) return { 성공: false, 오류: '데이터가 비어 있습니다.' };

  var 폴더 = 폴더확보(체험단폴더명);
  var 결과 = [];

  데이터.forEach(function (d) {
    var 브랜드 = String(d.브랜드 || '').trim();
    var 채널키 = String(d.채널키 || '').trim();
    if (브랜드 === '') return;

    var 꼬리 = 브랜드 + 체험단문서접미 + (채널키 ? ' (' + 채널키 + ')' : '');
    var 문서명 = (d.날짜 ? d.날짜 + ' ' : '') + 꼬리;

    // 같은 브랜드·채널의 옛 문서는 휴지통으로. 이름 앞에 날짜가 붙어 접미로 찾는다.
    var it = 폴더.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      var n = f.getName();
      if (n === 꼬리 || n.slice(-꼬리.length) === 꼬리) f.setTrashed(true);
    }

    var url = '';
    try { url = 체험단문서한건(폴더, 문서명, d); }
    catch (err) { Logger.log('문서 실패 ' + 문서명 + ': ' + err); }

    if (url) {
      이력기록_가이드('체험단', 채널키, 브랜드, d.날짜 || '', url, 보완요약(d));
    }
    결과.push({ 브랜드: 브랜드, 채널: 채널키, 링크: url, 상태: url ? '생성' : '실패' });
  });

  try { 문의탭반영(); } catch (e) {}

  return {
    성공: true,
    건수: 결과.length,
    폴더: 폴더.getUrl(),
    문서: 결과,
    시각: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
  };
}

function 체험단문서한건(폴더, 문서명, d) {
  var doc = DocumentApp.create(문서명);
  var body = doc.getBody();
  body.clear();

  var 브랜드 = String(d.브랜드);
  var 채널   = String(d.채널 || d.채널키 || '');

  body.appendParagraph(브랜드 + ' 체험단 진행 가이드')
      .setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(채널 + ' · 체험단 모집·제작 가이드')
      .setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  body.appendParagraph('체험단 가이드 제작 → 참여자 모집 → 방문·체험 → 콘텐츠 제작 → 검수 → 업로드');

  체험단범례(body);

  제목(body, '캠페인 개요');
  표(body, d, [
    ['브랜드 · 매장', null, 브랜드],
    ['캠페인 형태',   '캠페인형태'],
    ['제작 콘텐츠',   null, 채널],
    ['모집 인원',     '모집인원'],
    ['제공 내역',     '제공내역']
  ]);

  제목(body, '일정');
  표(body, d, [
    ['모집 마감',      '모집마감'],
    ['체험 가능 기간', '체험기간'],
    ['체험 가능 시간', '체험시간'],
    ['방문 주소',      '방문주소']
  ]);

  제목(body, '브랜드가 알리고 싶은 것');
  항목문단(body, d, '핵심내용');

  제목(body, '반드시 촬영해야 하는 장면');
  항목문단(body, d, '필수장면');

  제목(body, '게시글에 포함해 주세요');
  항목문단(body, d, '게시글필수항목');
  소제목(body, '태그 정보');
  표(body, d, [
    ['인스타그램 사람 태그', '사람태그'],
    ['필수 해시태그',        '필수해시태그']
  ]);

  제목(body, '사용하면 안 되는 표현 · 촬영 방식');
  항목문단(body, d, '금지사항');

  제목(body, 채널 + ' 제작 기준');
  목록(body, 줄나누기(항목(d, '채널기준').원문));
  if (채널키_블로그(d)) {
    표(body, d, [
      ['메인 키워드', '메인키워드'],
      ['추가 키워드', '추가키워드']
    ]);
  }

  제목(body, '기본 제작 안내');
  표(body, d, [
    ['콘텐츠 제출일',    '콘텐츠제출일'],
    ['게시물 유지 기간', '유지기간']
  ]);
  목록(body, 줄나누기(항목(d, '기본제작안내').원문));

  var 추가 = 항목(d, '추가전달');
  if (추가 && (추가.원문 || (추가.보완 && 추가.보완.indexOf('작성 필요') < 0))) {
    제목(body, '추가 전달사항');
    항목문단(body, d, '추가전달');
  }

  doc.saveAndClose();

  var file = DriveApp.getFileById(doc.getId());
  폴더.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  return doc.getUrl();
}

function 채널키_블로그(d) { return String(d.채널키 || '') === '블로그'; }

function 줄나누기(s) {
  return String(s == null ? '' : s).split('\n').filter(function (x) { return x !== ''; });
}

function 체험단범례(body) {
  var p = body.appendParagraph('');
  var t = p.editAsText();
  넣기(t, '이 문서는 ', 검정, true);
  넣기(t, '위 내용으로 체험단에게 제작을 요청하기 전, 기업 담당자님께 확인받기 위한 가이드입니다.\n', 검정, false);
  넣기(t, '검정 글씨는 담당자님이 제출해 주신 내용입니다.\n', 검정, false);
  넣기(t, '빨간 글씨는 포포몬비즈가 새로 기입하거나 정리한 내용입니다. 확인 후 수정 요청해 주세요.', 빨강, true);
}

// ═══════════════════════════════════════════════════════════
// 가이드 내용 미리보기 탭
// ═══════════════════════════════════════════════════════════
/**
 * 가이드 내용을 시트 탭으로 내보낸다. 문서(PDF)보다 시트가 보기 편할 때 쓴다.
 *
 * 기존 탭들과 같은 **가로 배치**다. 행이 항목, 열이 브랜드.
 * 한 칸 안에서 기업 원문은 검정, 포포몬비즈가 쓴 것은 빨강으로 색을 나눈다.
 * 그래서 값을 그냥 넣지 않고 RichTextValue 로 넣는다.
 *
 * 5-1·3-1 어느 쪽이든 같은 모양의 데이터를 넘기면 된다.
 * 웹앱 동작 '가이드시트' 로 로컬에서 보낸다.
 */
function 가이드시트쓰기(탭명, 제목, 항목순서, 데이터) {
  if (!탭명 || !데이터 || !데이터.length) {
    return { 성공: false, 오류: '탭명과 데이터가 필요합니다.' };
  }

  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sh = 탭확보(ss, 탭명);
  sh.clear();

  var 검정스타일 = SpreadsheetApp.newTextStyle().setForegroundColor('#222222').build();
  var 빨강스타일 = SpreadsheetApp.newTextStyle().setForegroundColor('#d40000').build();
  var 굵게 = SpreadsheetApp.newTextStyle().setForegroundColor('#1F3864').setBold(true).build();

  var 열수 = 데이터.length + 1;

  // 1행 제목
  sh.getRange(1, 1).setValue(제목).setFontWeight('bold').setFontSize(12)
    .setFontColor('#1F3864');

  // 2행 브랜드, 3행 접수일, 4행 채널
  var 고정 = [
    ['브랜드', function (d) { return d.브랜드 || ''; }],
    ['접수일', function (d) { return d.접수일 || ''; }],
    ['최초작성일', function (d) { return d.날짜 || ''; }],
    ['채널', function (d) { return (d.채널 || []).join(' · '); }]
  ];

  var 행 = 2;
  고정.forEach(function (pair) {
    sh.getRange(행, 1).setValue(pair[0]);
    데이터.forEach(function (d, i) { sh.getRange(행, i + 2).setValue(pair[1](d)); });
    행++;
  });
  sh.getRange(2, 2, 1, 데이터.length).setFontWeight('bold');

  // 항목별 행 — 한 칸에 원문(검정) + 보완(빨강)
  항목순서.forEach(function (이름) {
    sh.getRange(행, 1).setValue(이름);
    데이터.forEach(function (d, i) {
      var it = (d.항목 || {})[이름];
      if (!it) return;
      sh.getRange(행, i + 2).setRichTextValue(칸만들기(it, 검정스타일, 빨강스타일));
    });
    행++;
  });

  // 서식
  var 끝행 = 행 - 1;
  sh.getRange(2, 1, 끝행 - 1, 1).setFontWeight('bold').setBackground('#F2F4F8');
  sh.getRange(1, 1, 끝행, 열수).setVerticalAlignment('top').setWrap(true);
  sh.setColumnWidth(1, 150);
  for (var c = 2; c <= 열수; c++) sh.setColumnWidth(c, 320);
  sh.setFrozenRows(2);
  sh.setFrozenColumns(1);

  return {
    성공: true,
    탭: 탭명,
    브랜드수: 데이터.length,
    행: 끝행,
    링크: ss.getUrl() + '#gid=' + sh.getSheetId()
  };
}

/** 항목 하나를 한 칸에 담는다. 구분에 따라 색을 나눈다. */
function 칸만들기(it, 검정스타일, 빨강스타일) {
  var 구분 = it.구분 || '원문';
  var 원문 = String(it.원문 == null ? '' : it.원문);
  var 보완 = String(it.보완 == null ? '' : it.보완);
  var b = SpreadsheetApp.newRichTextValue();

  if (구분 === '원문') {
    return b.setText(원문 === '' ? '—' : 원문)
            .setTextStyle(검정스타일).build();
  }
  if (구분 === '제안') {
    var t1 = '[제안] ' + 보완;
    return b.setText(t1).setTextStyle(빨강스타일).build();
  }
  // 정리 · 보완 — 위에 원문(검정), 아래에 포포몬비즈(빨강)
  var 라벨 = (구분 === '정리') ? '[정리] ' : '[보완] ';
  var 앞 = '[원문] ' + 원문 + '\n';
  var 전체 = 앞 + 라벨 + 보완;
  return b.setText(전체)
          .setTextStyle(0, 앞.length, 검정스타일)
          .setTextStyle(앞.length, 전체.length, 빨강스타일)
          .build();
}

// ═══════════════════════════════════════════════════════════
// 칸 쓰기 (로컬에서 시트를 채울 때)
// ═══════════════════════════════════════════════════════════
/**
 * 문의 탭의 한 행에, 기업명으로 찾은 열에 값을 쓴다.
 *
 * 왜 있는가
 *   `5-0 브랜드명` 같은 열쇠 칸을 사용자가 손으로 타이핑하게 만들 이유가 없다.
 *   시트를 비공개로 닫은 뒤 로컬에서 쓸 길이 없어 부탁드렸던 것인데, 이걸로 해결한다.
 *
 * 항목: [{기업명: '위캔', 값: '위캔필라테스 반여점, 위캔필라테스 무거점'}, …]
 *   기업명은 2행에서 찾는다. 첫 줄만 비교한다(셀에 여러 줄이 들어오는 경우가 있다).
 *   같은 기업명이 여러 열에 있으면 **쓰지 않고 건너뛴다.** 엉뚱한 열에 쓰면
 *   다른 업체 자리에 링크가 붙는다. 어느 열인지는 사람이 정해야 한다.
 */
function 칸쓰기(행라벨, 항목) {
  if (!행라벨 || !항목 || !항목.length) {
    return { 성공: false, 오류: '행라벨과 항목이 필요합니다.' };
  }
  var sh = 문의탭();
  var 업체행 = 행찾기(sh, '기업명(소속)');
  if (!업체행) return { 성공: false, 오류: '기업명(소속) 행을 찾지 못했습니다.' };
  var 대상행 = 행확보(sh, 행라벨);

  var 끝열 = sh.getLastColumn();
  var 업체 = sh.getRange(업체행, 1, 1, 끝열).getValues()[0];

  // 기업명이 몇 번 나오는지 센다
  var 횟수 = {};
  for (var c = 2; c <= 끝열; c++) {
    var n = 첫줄(업체[c - 1]);
    if (n !== '') 횟수[n] = (횟수[n] || 0) + 1;
  }

  var 쓴것 = [], 건너뜀 = [];
  항목.forEach(function (it) {
    var 이름 = String(it.기업명 || '').trim();
    var 값   = String(it.값 || '').trim();
    if (값 === '') return;

    // ★ 열 번호를 직접 준 경우. 기업명이 여러 열에 겹치거나
    //   시트에 적힌 이름과 실제 상호가 다를 때 쓴다.
    //   (견적서는 「프라임매니지먼트」인데 시트 기업명은 「호텔스토리(프라임)」이었다)
    if (it.열) {
      var c0 = Number(it.열);
      if (!(c0 >= 2 && c0 <= 끝열)) { 건너뜀.push('열 ' + it.열 + ' — 범위를 벗어났습니다'); return; }
      sh.getRange(대상행, c0).setValue(값).setWrap(true);
      쓴것.push((첫줄(업체[c0 - 1]) || '이름없음') + ' (' + c0 + '열, 지정) → ' + 값);
      return;
    }

    if (이름 === '') return;
    if (!횟수[이름])      { 건너뜀.push(이름 + ' — 기업명을 찾지 못했습니다'); return; }
    if (횟수[이름] > 1)   { 건너뜀.push(이름 + ' — ' + 횟수[이름] + '개 열에 있어 어느 열인지 알 수 없습니다'); return; }
    for (var c = 2; c <= 끝열; c++) {
      if (첫줄(업체[c - 1]) !== 이름) continue;
      sh.getRange(대상행, c).setValue(값).setWrap(true);
      쓴것.push(이름 + ' (' + c + '열) → ' + 값);
      break;
    }
  });

  var n = 0;
  try { n = 문의탭반영(); } catch (e) {}

  return { 성공: true, 행: 대상행, 쓴것: 쓴것, 건너뜀: 건너뜀, 반영: n };
}

// ═══════════════════════════════════════════════════════════
// 상태 정리 — 열 정렬 · 진행완료 이동 · 불발 이동
// ═══════════════════════════════════════════════════════════
/**
 * 매일 한 번 돌면서 문의 탭을 정리한다.
 *   1) 진행완료 업체 → `진행완료` 탭으로 옮긴다
 *   2) 제안중·진행대기 업체가 3주간 아무 변화가 없으면 → `불발` 탭으로 옮긴다
 *   3) 남은 열을 제안중 → 진행중 → 진행대기 → 그 외 순서로 왼쪽부터 배치한다
 *
 * ★ 구글 시트에는 「열별 수정 시각」 이 없다
 *   그래서 매일 열 내용의 지문(해시)을 `_상태추적` 탭에 적어 두고 비교한다.
 *   지문이 바뀌면 그날을 마지막 변화일로 갱신한다. 3주는 그 날짜부터 센다.
 *   **설치한 날부터 세기 시작한다.** 전에 언제 고쳤는지는 알 수 없다.
 *
 * ★ 옮긴다 = 대상 탭에 복사한 뒤 원본 열을 지운다
 *   되돌리기 어려우므로 **복사가 확인된 뒤에만** 지운다.
 *   무엇을 옮겼는지 `_상태추적` 탭 아래에 기록을 남긴다.
 *   먼저 [상태정리_미리보기] 로 무엇이 옮겨질지 확인하는 것을 권한다.
 */
var 추적탭명   = '_상태추적';
var 완료탭명   = '진행완료';
var 불발탭명   = '불발';
var 불발기준일 = 21;                    // 3주

// 왼쪽부터 이 순서로 배치한다. 목록에 없는 상태는 뒤로 보낸다.
var 상태순서 = ['제안중', '진행중', '진행대기'];

// 이 상태만 3주 무변화로 불발 처리한다
var 불발대상 = { '제안중': 1, '진행대기': 1 };

function 상태정리()          { return 상태정리실행(false); }
function 상태정리_미리보기() { return 상태정리실행(true); }

function 상태정리실행(미리보기) {
  var sh = 문의탭();
  var 상태행 = 행찾기(sh, '진행상태');
  var 업체행 = 행찾기(sh, '기업명(소속)');
  if (!상태행 || !업체행) {
    Logger.log('진행상태 또는 기업명(소속) 행을 찾지 못했습니다.');
    return { 성공: false };
  }

  var 오늘 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var 변화 = 변화추적(sh, 업체행, 상태행, 미리보기);

  var 옮긴완료 = [], 옮긴불발 = [], 남김 = [];

  // 오른쪽부터 훑는다. 열을 지우면 왼쪽 번호는 그대로이므로 안전하다.
  var 끝열 = sh.getLastColumn();
  for (var c = 끝열; c >= 2; c--) {
    var 이름 = 첫줄(sh.getRange(업체행, c).getValue());
    if (이름 === '') continue;
    var 상태 = 첫줄(sh.getRange(상태행, c).getValue());

    if (상태 === 완료탭명) {
      옮긴완료.push(이름);
      if (!미리보기) 열이동(sh, c, 완료탭명, '진행완료', 오늘);
      continue;
    }

    // 진행상태를 직접 `불발` 로 적어 두면 3주를 기다리지 않고 바로 옮긴다.
    // 3주 무변화로 자동 판정되는 경우와 두 갈래 모두 불발 탭으로 모인다.
    if (상태 === 불발탭명) {
      옮긴불발.push(이름 + ' (직접 불발 처리)');
      if (!미리보기) 열이동(sh, c, 불발탭명, '직접 불발 처리', 오늘);
      continue;
    }

    if (불발대상[상태]) {
      var 정보 = 변화[이름];
      var 지난날 = 정보 ? 일수차(정보.마지막변화, 오늘) : 0;
      if (지난날 >= 불발기준일) {
        옮긴불발.push(이름 + ' (' + 상태 + ', ' + 지난날 + '일 무변화)');
        if (!미리보기) 열이동(sh, c, 불발탭명, 상태 + ' ' + 지난날 + '일 무변화', 오늘);
        continue;
      }
    }
    남김.push(이름);
  }

  var 정렬수 = 미리보기 ? 0 : 열정렬(sh, 업체행, 상태행);

  Logger.log((미리보기 ? '[미리보기] ' : '') + '상태 정리');
  Logger.log('  진행완료 이동: ' + (옮긴완료.length ? 옮긴완료.join(', ') : '없음'));
  Logger.log('  불발 이동    : ' + (옮긴불발.length ? 옮긴불발.join(', ') : '없음'));
  Logger.log('  남은 업체    : ' + 남김.length + '개');
  if (!미리보기) Logger.log('  열 정렬      : ' + 정렬수 + '번 이동');
  if (미리보기) Logger.log('\n실제로 옮기려면 [상태정리] 를 실행하세요.');

  var 결과 = { 성공: true, 완료: 옮긴완료, 불발: 옮긴불발, 남음: 남김.length, 정렬: 정렬수 };

  // 미리보기가 아닐 때만 메일로 보고한다. 매일 오전 6시 트리거가 이 경로로 온다.
  if (!미리보기) {
    try { 일일보고(결과, 변화, 오늘); } catch (err) { Logger.log('일일 보고 실패: ' + err); }
  }
  return 결과;
}

/**
 * 열 내용의 지문을 `_상태추적` 탭에 적어 두고, 바뀐 날을 기록한다.
 * 진행상태 행은 지문에서 뺀다. 상태만 바뀌어도 「변화」 로 보면
 * 제안중으로 되돌린 업체가 영원히 불발되지 않는다 — 그건 오히려 맞는 동작이라 넣는다.
 */
function 변화추적(sh, 업체행, 상태행, 미리보기) {
  var ss = sh.getParent();
  var 추적 = 탭확보(ss, 추적탭명);
  if (추적.getLastRow() === 0) {
    추적.getRange(1, 1, 1, 4).setValues([['기업명', '지문', '마지막변화', '상태']])
      .setFontWeight('bold').setBackground('#F2F4F8');
    추적.setFrozenRows(1);
  }
  // 프로그램이 쓰는 탭이라 사람이 볼 일이 없다. 탭 목록을 어지럽히지 않게 숨긴다.
  try { if (!추적.isSheetHidden()) 추적.hideSheet(); } catch (e) {}

  var 옛 = {};
  if (추적.getLastRow() > 1) {
    var 값 = 추적.getRange(2, 1, 추적.getLastRow() - 1, 4).getValues();
    값.forEach(function (r) {
      var n = String(r[0] || '').trim();
      if (n === '') return;
      옛[n] = { 지문: String(r[1] || ''), 마지막변화: 날짜문자2(r[2]), 상태: String(r[3] || '') };
    });
  }

  var 오늘 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var 끝행 = sh.getLastRow(), 끝열 = sh.getLastColumn();
  var 전체 = sh.getRange(1, 1, 끝행, 끝열).getDisplayValues();

  var 새 = {}, 행들 = [];
  for (var c = 2; c <= 끝열; c++) {
    var 이름 = 첫줄(전체[업체행 - 1][c - 1]);
    if (이름 === '') continue;
    var 조각 = [];
    for (var r = 1; r <= 끝행; r++) {
      if (r === 상태행) continue;                 // 상태는 지문에서 뺀다
      조각.push(전체[r - 1][c - 1]);
    }
    var 지문 = 해시(조각.join(''));
    var 상태 = 첫줄(전체[상태행 - 1][c - 1]);
    var 앞 = 옛[이름];
    var 마지막 = (앞 && 앞.지문 === 지문 && 앞.마지막변화) ? 앞.마지막변화 : 오늘;
    새[이름] = { 지문: 지문, 마지막변화: 마지막, 상태: 상태 };
    행들.push([이름, 지문, 마지막, 상태]);
  }

  if (!미리보기 && 행들.length) {
    if (추적.getLastRow() > 1) {
      추적.getRange(2, 1, 추적.getLastRow() - 1, 4).clearContent();
    }
    추적.getRange(2, 1, 행들.length, 4).setValues(행들);
  }
  return 새;
}

function 해시(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ((x & 0xFF) + 0x100).toString(16).slice(1); }).join('');
}

function 날짜문자2(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? (m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2)) : s;
}

function 일수차(앞, 뒤) {
  if (!앞 || !뒤) return 0;
  var a = new Date(앞 + 'T00:00:00+09:00'), b = new Date(뒤 + 'T00:00:00+09:00');
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

/**
 * 한 열을 대상 탭으로 옮긴다. 복사가 확인된 뒤에만 원본을 지운다.
 * 대상 탭은 같은 가로 배치다. A열 라벨을 처음 한 번 복사해 둔다.
 */
function 열이동(sh, c, 대상탭명, 사유, 오늘) {
  var ss = sh.getParent();
  var 대상 = 탭확보(ss, 대상탭명);
  var 끝행 = sh.getLastRow();

  if (대상.getLastRow() === 0 || 대상.getLastColumn() === 0) {
    var 라벨 = sh.getRange(1, 1, 끝행, 1).getValues();
    대상.getRange(1, 1, 끝행, 1).setValues(라벨);
    대상.getRange(1, 1, 끝행, 1).setFontWeight('bold').setBackground('#F2F4F8');
    대상.setColumnWidth(1, 150);
    // 옮긴 사유와 날짜를 적을 행을 아래에 만든다
    대상.getRange(끝행 + 2, 1).setValue('옮긴 사유').setFontWeight('bold');
    대상.getRange(끝행 + 3, 1).setValue('옮긴 날짜').setFontWeight('bold');
  }

  var 값   = sh.getRange(1, c, 끝행, 1).getValues();
  var 새열 = 대상.getLastColumn() + 1;
  if (새열 < 2) 새열 = 2;
  대상.getRange(1, 새열, 끝행, 1).setValues(값);
  대상.getRange(끝행 + 2, 새열).setValue(사유);
  대상.getRange(끝행 + 3, 새열).setValue(오늘);
  대상.setColumnWidth(새열, 240);
  SpreadsheetApp.flush();

  // 복사가 됐는지 확인한 뒤에만 지운다
  var 확인 = 대상.getRange(1, 새열, 끝행, 1).getValues();
  var 같음 = (확인.length === 값.length);
  for (var i = 0; 같음 && i < 값.length; i++) {
    if (String(확인[i][0]) !== String(값[i][0])) 같음 = false;
  }
  if (!같음) {
    Logger.log('복사 확인 실패 — 원본을 지우지 않았습니다: ' + 첫줄(값[1] ? 값[1][0] : ''));
    return false;
  }
  sh.deleteColumn(c);
  return true;
}

/**
 * 상태 순서대로 열을 왼쪽부터 배치한다.
 * 같은 상태끼리는 지금 순서를 지킨다(안정 정렬).
 */
function 열정렬(sh, 업체행, 상태행) {
  var 끝열 = sh.getLastColumn();
  if (끝열 < 3) return 0;

  var 목록 = [];
  for (var c = 2; c <= 끝열; c++) {
    var 이름 = 첫줄(sh.getRange(업체행, c).getValue());
    if (이름 === '') continue;
    var 상태 = 첫줄(sh.getRange(상태행, c).getValue());
    var 순위 = 상태순서.indexOf(상태);
    목록.push({ 열: c, 이름: 이름, 순위: (순위 < 0 ? 상태순서.length : 순위) });
  }
  목록.sort(function (a, b) { return (a.순위 - b.순위) || (a.열 - b.열); });

  // 왼쪽부터 자리를 정해 하나씩 끌어온다
  var 현재 = 목록.map(function (o) { return o.열; }).sort(function (a, b) { return a - b; });
  var 이동수 = 0;
  for (var i = 0; i < 목록.length; i++) {
    var 목표열 = 현재[i];
    var 지금열 = 목록[i].열;
    if (지금열 === 목표열) continue;
    sh.moveColumns(sh.getRange(1, 지금열, 1, 1), 목표열);
    이동수++;
    // 옮기면 사이 열들의 번호가 하나씩 밀린다
    for (var j = i + 1; j < 목록.length; j++) {
      if (목록[j].열 >= 목표열 && 목록[j].열 < 지금열) 목록[j].열++;
    }
    목록[i].열 = 목표열;
  }
  return 이동수;
}

// ═══════════════════════════════════════════════════════════
// 현황 요약 · 일일 보고
// ═══════════════════════════════════════════════════════════
/**
 * 지금 자동화가 어떤 상태인지 한 번에 모아 돌려준다.
 * 매일 오전 6시 메일 보고와, 로컬에서 「업데이트」 로 확인할 때 같은 함수를 쓴다.
 * 두 곳에서 다른 계산을 하면 숫자가 어긋난다.
 */
function 현황요약() {
  var ss = SpreadsheetApp.openById(통합시트_ID);
  var 요약 = { 시각: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') };

  // 1) 상태별 업체 수
  try {
    var sh = 문의탭();
    var 상태행 = 행찾기(sh, '진행상태'), 업체행 = 행찾기(sh, '기업명(소속)');
    var 끝열 = sh.getLastColumn();
    var 전체 = sh.getRange(1, 1, sh.getLastRow(), 끝열).getDisplayValues();
    var 셈 = {}, 짝없음 = [];
    var 짝행 = 행찾기(sh, '5-0 브랜드명');
    for (var c = 2; c <= 끝열; c++) {
      var 이름 = 첫줄(전체[업체행 - 1][c - 1]);
      if (이름 === '') continue;
      var 상태 = 첫줄(전체[상태행 - 1][c - 1]) || '(빈칸)';
      셈[상태] = (셈[상태] || 0) + 1;
      if (짝행) {
        var 짝 = String(전체[짝행 - 1][c - 1] || '').trim();
        if (짝 === '') 짝없음.push(이름);
      }
    }
    요약.상태별 = 셈;
    요약.브랜드명빈칸 = 짝없음;
  } catch (e) { 요약.상태별오류 = String(e); }

  // 2) 발행 이력 — 종류·채널별 건수, 공고 없는 건
  try {
    var 이력 = 이력읽기();
    var 종채 = {}, 공고없음 = [];
    for (var k in 이력.낱개) {
      var o = 이력.낱개[k];
      var p = k.split('|');
      var key = p[0] + (p[1] ? ' · ' + p[1] : '');
      종채[key] = (종채[key] || 0) + 1;
      if (!String(o['공고 링크'] || '').trim()) 공고없음.push(p[0] + ' ' + (p[1] || '') + ' ' + p[2]);
    }
    요약.발행이력 = 종채;
    요약.공고없음 = 공고없음;
  } catch (e) { 요약.이력오류 = String(e); }

  // 3) 3주 임박 (14일 이상 무변화, 제안중·진행대기)
  try {
    var 추적 = ss.getSheetByName(추적탭명);
    var 임박 = [];
    if (추적 && 추적.getLastRow() > 1) {
      var 오늘 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
      추적.getRange(2, 1, 추적.getLastRow() - 1, 4).getValues().forEach(function (r) {
        var 이름 = String(r[0] || '').trim();
        var 상태 = String(r[3] || '').trim();
        if (이름 === '' || !불발대상[상태]) return;
        var 지난 = 일수차(날짜문자2(r[2]), 오늘);
        if (지난 >= 14) 임박.push({ 업체: 이름, 상태: 상태, 무변화: 지난, 남은일: 불발기준일 - 지난 });
      });
      임박.sort(function (a, b) { return b.무변화 - a.무변화; });
    }
    요약.불발임박 = 임박;
  } catch (e) { 요약.추적오류 = String(e); }

  // 4) 옮겨진 것
  ['진행완료', '불발'].forEach(function (n) {
    var t = ss.getSheetByName(n);
    요약[n + '탭'] = t ? Math.max(0, t.getLastColumn() - 1) : 0;
  });

  // 5) 신규 접수 — 폼이 여러 개다. 탭을 전부 더한다.
  //    한 폼만 세면 다른 폼 접수가 보고에서 통째로 빠진다.
  try {
    var 합 = 0;
    ss.getSheets().forEach(function (t) {
      var n = t.getName();
      if (n === 응답탭명 || n.indexOf(응답탭명 + ' (') === 0) {
        합 += Math.max(0, t.getLastRow() - 1);
      }
    });
    요약['5-0응답'] = 합;
  } catch (e) {}

  // 6) 트리거
  try {
    var t = {};
    ScriptApp.getProjectTriggers().forEach(function (x) {
      var f = x.getHandlerFunction();
      t[f] = (t[f] || 0) + 1;
    });
    요약.트리거 = t;
  } catch (e) {}

  return 요약;
}

/** 매일 오전 6시 보고 메일 */
function 일일보고(결과, 변화, 오늘) {
  var 주소 = PropertiesService.getScriptProperties().getProperty('알림주소');
  if (!주소) { Logger.log('알림 주소가 없습니다. 보고를 건너뜁니다.'); return; }

  var s = 현황요약();
  var 줄 = [];
  줄.push('포포몬비즈 자동화 일일 보고 — ' + 오늘);
  줄.push('');

  줄.push('■ 오늘 정리한 것');
  줄.push('   진행완료 → 진행완료 탭 : ' + (결과.완료.length ? 결과.완료.join(', ') : '없음'));
  줄.push('   3주 무변화 → 불발 탭   : ' + (결과.불발.length ? 결과.불발.join(', ') : '없음'));
  줄.push('   열 정렬                : ' + 결과.정렬 + '번 이동 (제안중 → 진행중 → 진행대기)');
  줄.push('');

  줄.push('■ 업체 현황 (' + 결과.남음 + '개)');
  for (var k in (s.상태별 || {})) 줄.push('   ' + k + ' : ' + s.상태별[k] + '개');
  줄.push('   진행완료 탭 : ' + (s['진행완료탭'] || 0) + '개 / 불발 탭 : ' + (s['불발탭'] || 0) + '개');
  줄.push('');

  if ((s.불발임박 || []).length) {
    줄.push('■ 불발 임박 — 3주까지 남은 날');
    s.불발임박.forEach(function (x) {
      줄.push('   ' + x.업체 + ' (' + x.상태 + ') — ' + x.무변화 + '일 무변화, ' + x.남은일 + '일 남음');
    });
    줄.push('   ※ 내용을 고치면 시계가 다시 시작됩니다.');
    줄.push('');
  }

  줄.push('■ 발행 이력');
  for (var k2 in (s.발행이력 || {})) 줄.push('   ' + k2 + ' : ' + s.발행이력[k2] + '건');
  줄.push('   5-0 신청서 누적 : ' + (s['5-0응답'] || 0) + '건');
  줄.push('');

  if ((s.브랜드명빈칸 || []).length) {
    줄.push('■ 5-0 브랜드명이 비어 진행 현황이 안 붙는 업체');
    줄.push('   ' + s.브랜드명빈칸.join(', '));
    줄.push('');
  }

  if ((s.공고없음 || []).length) {
    줄.push('■ 가이드는 있고 공고는 아직 없는 건');
    s.공고없음.forEach(function (x) { 줄.push('   ' + x); });
    줄.push('');
  }

  줄.push('■ 돌고 있는 자동화');
  for (var f in (s.트리거 || {})) 줄.push('   ' + f + ' ×' + s.트리거[f]);
  줄.push('');
  줄.push('시트: ' + SpreadsheetApp.openById(통합시트_ID).getUrl());

  try {
    MailApp.sendEmail({
      to: 주소,
      subject: '[포포몬비즈] 자동화 일일 보고 — ' + 오늘,
      body: 줄.join('\n')
    });
    Logger.log('일일 보고 발송: ' + 주소);
  } catch (err) { Logger.log('메일 실패: ' + err); }
}

/** 지금 바로 보고 메일을 받아 본다 */
function 일일보고_시험() {
  var 오늘 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  일일보고({ 완료: [], 불발: [], 남음: 0, 정렬: 0 }, {}, 오늘);
}

/** 프로그램이 쓰는 탭을 숨긴다. 지우면 안 되지만 볼 일도 없다. */
function 초기_프로그램탭숨기기() {
  var ss = SpreadsheetApp.openById(통합시트_ID);
  var 숨길것 = [추적탭명];
  var 한것 = [];
  숨길것.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (!sh) return;
    try { if (!sh.isSheetHidden()) { sh.hideSheet(); 한것.push(n); } } catch (e) {}
  });
  Logger.log(한것.length ? ('숨김: ' + 한것.join(', ')) : '숨길 탭이 없습니다 (이미 숨겨져 있거나 없음).');
  Logger.log('다시 보려면 시트 하단 탭 목록 왼쪽의 메뉴에서 「숨겨진 시트」 를 누릅니다.');
}

function 상태정리_트리거설치() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '상태정리') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('상태정리').timeBased().everyDays(1).atHour(6).create();
  Logger.log('매일 오전 6시 상태 정리 트리거 설치');
}

function 상태정리_트리거삭제() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '상태정리') ScriptApp.deleteTrigger(t);
  });
  Logger.log('상태 정리 트리거 삭제');
}

// ═══════════════════════════════════════════════════════════
// 트리거
// ═══════════════════════════════════════════════════════════

function 통합_트리거설치() {
  통합_트리거삭제();
  ScriptApp.newTrigger('전체갱신').timeBased().everyHours(1).create();
  Logger.log('1시간 주기 갱신 트리거 설치');
}

function 통합_트리거삭제() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '전체갱신') ScriptApp.deleteTrigger(t);
  });
}

// ═══════════════════════════════════════════════════════════
// 보조
// ═══════════════════════════════════════════════════════════

function 문의탭() {
  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === 문의탭_GID) return sheets[i];
  }
  throw new Error('gid ' + 문의탭_GID + ' 탭을 찾지 못했습니다.');
}

function 탭확보(ss, 이름) {
  var sh = ss.getSheetByName(이름);
  return sh ? sh : ss.insertSheet(이름);
}

/** A열에서 라벨이 있는 행 번호. 없으면 0. */
function 행찾기(sh, 라벨) {
  if (sh.getLastRow() === 0) return 0;
  var 열A = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 0; i < 열A.length; i++) {
    if (String(열A[i][0]).trim() === 라벨) return i + 1;
  }
  return 0;
}

/** 라벨이 없으면 맨 아래에 만들고 그 행 번호를 준다. */
function 행확보(sh, 라벨) {
  var r = 행찾기(sh, 라벨);
  if (r) return r;
  r = sh.getLastRow() + 1;
  sh.getRange(r, 1).setValue(라벨);
  return r;
}

/** 셀에 여러 줄이 들어 있는 경우가 있어 첫 줄만 쓴다. */
function 첫줄(v) {
  return String(v === undefined || v === null ? '' : v).split('\n')[0].trim();
}
