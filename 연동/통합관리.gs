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
var 응답탭명 = '5-0 응답';

// 문의 탭 맨 아래에 덧붙일 행. 순서대로 만든다.
var 진행행 = ['5-0 브랜드명', '5-1 가이드', '6 공고', '보완 필요', '진행 갱신'];

var 이력머리글 = ['브랜드', '최초작성일', '5-1 가이드 문서', '5-1 갱신',
                  '6 공고(노션)', '6 갱신', '포포몬비즈 보완 항목'];

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

/** 5-0 응답 시트를 통합 워크북의 탭으로 그대로 복사한다. */
function 응답미러() {
  var 원본 = SpreadsheetApp.openById(응답시트_ID).getSheets()[0];
  var 값 = 원본.getDataRange().getValues();
  var sh = 탭확보(SpreadsheetApp.openById(통합시트_ID), 응답탭명);

  sh.clear();
  if (!값.length) return 0;
  sh.getRange(1, 1, 값.length, 값[0].length).setValues(값);
  sh.getRange(1, 1, 1, 값[0].length).setFontWeight('bold').setBackground('#F2F4F8');
  sh.setFrozenRows(1);
  return 값.length;
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

  var 행 = {
    '5-1 가이드': 행확보(sh, '5-1 가이드'),
    '6 공고':     행확보(sh, '6 공고'),
    '보완 필요':  행확보(sh, '보완 필요'),
    '진행 갱신':  행확보(sh, '진행 갱신')
  };

  var 지금 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  var 붙인수 = 0;

  for (var c = 2; c <= 끝열; c++) {
    var b = String(브랜드들[c - 1] || '').trim();
    if (b === '') continue;
    var it = 이력[b];
    if (!it) continue;

    sh.getRange(행['5-1 가이드'], c).setValue(it['5-1 가이드 문서'] || '');
    sh.getRange(행['6 공고'], c).setValue(it['6 공고(노션)'] || '');
    sh.getRange(행['보완 필요'], c).setValue(it['포포몬비즈 보완 항목'] || '')
      .setFontColor('#d40000').setWrap(true);
    sh.getRange(행['진행 갱신'], c).setValue(지금);
    붙인수++;
  }
  return 붙인수;
}

// ═══════════════════════════════════════════════════════════
// 발행 이력
// ═══════════════════════════════════════════════════════════

/** 브랜드 → {머리글: 값} */
function 이력읽기() {
  var sh = 탭확보(SpreadsheetApp.openById(통합시트_ID), 이력탭명);
  var out = {};
  if (sh.getLastRow() < 2) return out;

  var 값 = sh.getDataRange().getValues();
  var 머리 = 값[0];
  for (var r = 1; r < 값.length; r++) {
    var b = String(값[r][0] || '').trim();
    if (b === '') continue;
    var o = {};
    for (var c = 0; c < 머리.length; c++) o[머리[c]] = 값[r][c];
    out[b] = o;
  }
  return out;
}

/**
 * 발행 이력에 한 줄 기록(있으면 갱신).
 * 넘기지 않은 칸은 기존 값을 지우지 않는다. 5-1 과 6 이 따로 기록하기 때문이다.
 */
function 이력기록(브랜드, 변경) {
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
    var 열A = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < 열A.length; i++) {
      if (String(열A[i][0]).trim() === String(브랜드).trim()) { 줄 = i + 2; break; }
    }
  }
  if (!줄) {
    줄 = sh.getLastRow() + 1;
    sh.getRange(줄, 1).setValue(브랜드);
  }

  for (var k in 변경) {
    var c = 머리.indexOf(k);
    if (c < 0) continue;
    sh.getRange(줄, c + 1).setValue(변경[k]);
  }
  return 줄;
}

/** 5-1 발행 직후 호출 (구글문서생성.gs 의 실행코어에서) */
function 이력기록_5_1(브랜드, 날짜, 문서url, 보완항목) {
  var 변경 = {};
  변경['최초작성일']          = 날짜 || '';
  변경['5-1 가이드 문서']     = 문서url || '';
  변경['5-1 갱신']            = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  변경['포포몬비즈 보완 항목'] = 보완항목 || '';
  이력기록(브랜드, 변경);
}

/** 6번 노션 업로드 직후 호출 (웹앱 동작 '공고기록') */
function 이력기록_6(브랜드, 노션url) {
  var 변경 = {};
  변경['6 공고(노션)'] = 노션url || '';
  변경['6 갱신']       = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  이력기록(브랜드, 변경);
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
