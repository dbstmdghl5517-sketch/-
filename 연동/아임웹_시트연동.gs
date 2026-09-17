/**
 * 아임웹 입력폼(무료 컨설팅 문의하기) → 구글 시트 자동 적재
 *
 * 대상 시트 : https://docs.google.com/spreadsheets/d/14n42XJQ0QzTqzeFkaAHua-SMVQVtJjRQ5OQcpQ9ssl4
 *             gid=928374615  (문의 관리)
 *
 * ★ 시트는 전치 구조다.  A열 = 항목 이름 / B열~ = 문의 1건씩
 *   따라서 새 문의는 행이 아니라 맨 오른쪽 새 열로 들어간다.
 *   13~16행(확인사항·1차cs·2차cs·3차cs)은 사람이 쓰는 칸이라 건드리지 않는다.
 *
 * ★ 리프레시 토큰은 1회용이다. 갱신하면 기존 토큰이 무효가 되고 새 토큰이 내려온다.
 *   그래서 토큰 값을 다른 곳에서 테스트하면 안 된다. 테스트하는 순간 무효가 된다.
 *
 * 2026-09-15 실제 API 호출로 확정한 값:
 *   siteCode  S202605189757eef0ce5f2
 *   unitCode  u202605187b87d5aacbd3b
 *   formNo    4  (무료 컨설팅 문의하기)
 *   scope     site-info:write community:read
 *             site-info:write 가 없으면 인가 코드 발급이 errorCode 30156 으로 거부된다
 *   토큰 발급은 반드시 application/x-www-form-urlencoded (JSON 이면 errorCode 30122)
 */

// ═══════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════

// 스프레드시트 ID. script.google.com 의 독립 프로젝트에서도 동작하도록 ID 로 직접 연다.
var SPREADSHEET_ID = '14n42XJQ0QzTqzeFkaAHua-SMVQVtJjRQ5OQcpQ9ssl4';
var TARGET_GID = 928374615;
var SHEET_NAME = '';                       // 비우면 위 gid 시트를 자동으로 찾는다

var SITE_CODE  = 'S202605189757eef0ce5f2';
var UNIT_CODE  = 'u202605187b87d5aacbd3b';
var FORM_NO    = 4;
var SCOPE      = 'site-info:write community:read';
var REDIRECT   = 'https://popomonbiz.imweb.me/';
var API        = 'https://openapi.imweb.me';

var 기본_진행상태 = '진행대기';
var 출처값        = '아임웹';

// 이 날짜 이후 접수 건만 가져온다
var 시작일 = '2026-09-07';

// 걸러낼 내부 테스트 건
var 제외이메일 = ['goawd2550@withuscontents.com'];
var 제외단어   = ['관리자', '유지현', '테스트'];

/** 시트 A열 항목 이름(1행부터 순서대로)  ←  아임웹 폼 항목 이름 */
var 행매핑 = [
  ['진행상태',           '@진행상태'],
  ['기업명(소속)',        '회사/브랜드명'],
  ['신청자명',           '담당자명'],
  ['연락처',             '@연락처'],
  ['이메일',             '이메일'],
  ['업종',               '업종'],
  ['(광고 상품)',         '광고 상품'],       // 7행 — 레이블이 비어 있는 행
  ['광고 상품',           '마케팅 목적'],     // 8행 — 레이블은 광고 상품이나 실제 내용은 마케팅 목적
  ['예상 예산',           '예상 예산'],
  ['지원사업 활용 여부',   '지원사업 활용 여부'],
  ['해당 지원사업',       '@지원사업'],
  ['문의내용',           '문의내용'],
  ['확인사항',           '@빈칸'],
  ['1차cs',             '@빈칸'],
  ['2차cs',             '@빈칸'],
  ['3차cs',             '@빈칸'],
  ['출처',               '@출처'],
  ['응답번호',           '@응답번호']        // 중복 방지용. 없으면 자동 생성된다
];

// ═══════════════════════════════════════════════════════════
// 단계0 — 자격증명 저장 (한 번만)
// ═══════════════════════════════════════════════════════════

/**
 * 자격증명 저장.
 *
 * ★ 자리표시자를 그대로 저장할 수 없게 막아 뒀다.
 *   전에 이 함수를 **값을 안 바꾼 채 실행**해서 진짜 Client ID·Secret 이
 *   `여기에_Client_ID` 로 덮였다. 그 뒤로 아임웹 문의 적재가 계속 실패했는데,
 *   토큰이 만료된 것으로 오해해 한참 헤맸다. (2026-09-17)
 *
 * ★ 이미 저장된 값이 멀쩡하면 덮어쓰지 않는다.
 *   실수로 한 번 더 실행해도 연동이 끊기지 않게 한다.
 */
function 단계0_자격증명저장() {
  var ID     = '여기에_Client_ID';
  var SECRET = '여기에_Client_Secret';

  if (ID.indexOf('여기에') === 0 || SECRET.indexOf('여기에') === 0) {
    Logger.log('❗저장하지 않았습니다. 함수 안의 ID/SECRET 을 실제 값으로 바꾸고 다시 실행하세요.\n'
             + '   (자리표시자를 저장하면 연동이 끊깁니다. 전에 그렇게 끊긴 적이 있습니다.)');
    return;
  }

  var p = PropertiesService.getScriptProperties();
  var 기존 = p.getProperty('IMWEB_CLIENT_ID') || '';
  if (기존 && 기존.indexOf('여기에') !== 0 && 기존 !== ID) {
    Logger.log('❗이미 다른 Client ID 가 저장돼 있습니다: ' + 기존.substring(0, 8) + '…\n'
             + '   정말 바꾸려면 [단계0_자격증명_강제저장] 을 쓰세요.');
    return;
  }

  p.setProperties({ IMWEB_CLIENT_ID: ID, IMWEB_CLIENT_SECRET: SECRET });
  Logger.log('저장 완료. 보안을 위해 위 문자열은 코드에서 지워도 됩니다.');
}

/** 자격증명을 정말로 바꿔야 할 때만 쓴다. 위 확인을 건너뛴다. */
function 단계0_자격증명_강제저장() {
  var ID     = '여기에_Client_ID';
  var SECRET = '여기에_Client_Secret';
  if (ID.indexOf('여기에') === 0 || SECRET.indexOf('여기에') === 0) {
    Logger.log('❗값을 먼저 채우세요.');
    return;
  }
  PropertiesService.getScriptProperties()
    .setProperties({ IMWEB_CLIENT_ID: ID, IMWEB_CLIENT_SECRET: SECRET });
  Logger.log('강제 저장 완료.');
}

function 설정값(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function 설정저장(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }

// ═══════════════════════════════════════════════════════════
// 단계1 — 승인 링크 만들기 (90일에 한 번)
// ═══════════════════════════════════════════════════════════

function 단계1_승인링크() {
  var id = 설정값('IMWEB_CLIENT_ID');
  if (!id) { Logger.log('단계0 을 먼저 실행하세요.'); return; }

  var url = API + '/oauth2/authorize'
    + '?responseType=code'
    + '&clientId='    + encodeURIComponent(id)
    + '&redirectUri=' + encodeURIComponent(REDIRECT)
    + '&scope='       + encodeURIComponent(SCOPE)
    + '&siteCode='    + encodeURIComponent(SITE_CODE);

  Logger.log('아래 주소를 브라우저에서 여세요.\n\n' + url
    + '\n\n주소창이 popomonbiz.imweb.me/?code=XXXX 로 바뀝니다.'
    + '\n그 code 값을 [단계2_토큰발급] 함수 안에 붙여넣고 실행하세요. (몇 분 내 만료)');
}

// ═══════════════════════════════════════════════════════════
// 단계2 — 인가 코드 → 토큰 (90일에 한 번)
// ═══════════════════════════════════════════════════════════

function 단계2_토큰발급() {
  var CODE = '여기에_code_붙여넣기';

  if (CODE.indexOf('여기에') === 0) { Logger.log('CODE 를 먼저 붙여넣으세요.'); return; }

  var res = UrlFetchApp.fetch(API + '/oauth2/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',   // JSON 이면 errorCode 30122
    payload: {
      grantType:    'authorization_code',
      clientId:     설정값('IMWEB_CLIENT_ID'),
      clientSecret: 설정값('IMWEB_CLIENT_SECRET'),
      redirectUri:  REDIRECT,
      code:         CODE
    },
    muteHttpExceptions: true
  });

  var body = res.getContentText();
  if (res.getResponseCode() !== 200) { Logger.log('실패 ' + res.getResponseCode() + ': ' + body); return; }

  var d = JSON.parse(body).data;
  설정저장('IMWEB_REFRESH_TOKEN', d.refreshToken);
  CacheService.getScriptCache().put('imweb_access', d.accessToken, 6600);
  Logger.log('토큰 저장 완료. 리프레시 토큰은 90일간 유효합니다.\n승인된 scope: ' + JSON.stringify(d.scope));

  연동완료처리(d.accessToken);          // 최초 1회. 이미 완료 상태여도 문제 없다
}

function 연동완료처리(token) {
  var res = UrlFetchApp.fetch(API + '/site-info/integration-complete', {
    method: 'patch',
    contentType: 'application/json',
    payload: '{}',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  Logger.log('연동완료 처리: HTTP ' + res.getResponseCode() + ' ' + res.getContentText().substring(0, 120));
}

/** 액세스 토큰. 캐시에 없으면 리프레시 토큰으로 갱신한다. */
function 토큰() {
  var c = CacheService.getScriptCache();
  var t = c.get('imweb_access');
  if (t) return t;

  var rt = 설정값('IMWEB_REFRESH_TOKEN');
  if (!rt) throw new Error('리프레시 토큰이 없습니다. 단계1 → 단계2 를 실행하세요.');

  var res = UrlFetchApp.fetch(API + '/oauth2/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grantType:    'refresh_token',
      clientId:     설정값('IMWEB_CLIENT_ID'),
      clientSecret: 설정값('IMWEB_CLIENT_SECRET'),
      refreshToken: rt
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('토큰 갱신 실패(' + res.getResponseCode() + '). 90일이 지났다면 단계1 → 단계2 를 다시 하세요. '
      + res.getContentText().substring(0, 200));
  }
  var d = JSON.parse(res.getContentText()).data;

  // ★ 아임웹 리프레시 토큰은 1회용이다. 갱신하면 기존 토큰이 즉시 무효가 되고
  //   새 토큰이 내려온다. 반드시 저장해야 다음 갱신이 가능하다.
  //   저장에 실패하면 연동이 끊기므로, 새 토큰이 없으면 경고를 남긴다.
  if (d.refreshToken) {
    설정저장('IMWEB_REFRESH_TOKEN', d.refreshToken);
  } else {
    Logger.log('경고: 갱신 응답에 새 리프레시 토큰이 없습니다. 다음 갱신이 실패할 수 있습니다.');
  }

  c.put('imweb_access', d.accessToken, 6600);            // 1시간 50분
  return d.accessToken;
}

/**
 * 단계2 대안 — 이미 받아둔 리프레시 토큰을 그대로 저장한다.
 * 인가 코드는 몇 분이면 만료돼 단계1 → 단계2 를 시간 안에 못 끝내는 경우가 많다.
 * 리프레시 토큰은 90일 유효하므로 한 번 넣어두면 그때까지 자동으로 돌아간다.
 */
function 단계2B_리프레시토큰직접저장() {
  var AT = '여기에_액세스토큰_붙여넣기';     // 2시간 유효. 바로 단계3 을 돌릴 수 있다
  var RT = '여기에_리프레시토큰_붙여넣기';   // 90일 유효. 액세스 토큰이 만료되면 이걸로 갱신한다

  if (RT.indexOf('여기에') === 0) { Logger.log('리프레시 토큰을 붙여넣으세요.'); return; }
  설정저장('IMWEB_REFRESH_TOKEN', RT);

  // ★ 여기서 갱신을 하지 않는다.
  //   리프레시 토큰은 1회용이라, 확인차 갱신하면 저장한 토큰이 바로 무효가 된다.
  //   대신 이미 받아둔 액세스 토큰을 캐시에 넣어 단계3 이 갱신 없이 돌게 한다.
  if (AT.indexOf('여기에') !== 0) {
    CacheService.getScriptCache().put('imweb_access', AT, 6600);
    Logger.log('액세스 토큰(2시간) + 리프레시 토큰(90일) 저장 완료. 이제 단계3 을 실행하세요.');
  } else {
    CacheService.getScriptCache().remove('imweb_access');
    Logger.log('리프레시 토큰만 저장했습니다. 단계3 실행 시 자동으로 갱신됩니다.');
  }
}

// ═══════════════════════════════════════════════════════════
// 단계3 — 시트에 적재 (트리거로 자동 실행)
// ═══════════════════════════════════════════════════════════

function 단계3_시트에적재() {
  var token = 토큰();
  var 응답들 = 폼응답가져오기(token);
  if (!응답들.length) { Logger.log('가져온 응답이 없습니다.'); return; }

  var sh = 대상시트();
  라벨보정(sh);

  var 라벨 = A열라벨(sh);
  var 이미 = 이미적재된번호(sh, 라벨);
  var 기존기업 = 기존기업명(sh, 라벨);

  var 추가 = 0, 중복 = 0, 걸러짐 = 0;
  var 신규 = [];                    // 메일로 알릴 새 문의

  응답들.forEach(function (r) {
    if (이미[String(r.submitNo)]) { 중복++; return; }
    if (!필터통과(r))             { 걸러짐++; return; }
    var 이름 = String(r.f['회사/브랜드명'] || '').replace(/\s+/g, '');
    if (이름 && 기존기업[이름])    { 중복++; return; }     // 같은 업체가 이미 있으면 건너뛴다

    var col = sh.getLastColumn() + 1;
    var 값 = 라벨.map(function (name) { return [셀값(name, r)]; });
    sh.getRange(1, col, 값.length, 1).setValues(값);

    이미[String(r.submitNo)] = true;
    if (이름) 기존기업[이름] = true;
    추가++;

    신규.push({
      기업:   String(r.f['회사/브랜드명'] || '(미기재)'),
      담당:   String(r.f['담당자명'] || ''),
      연락처: 전화형식(r.f['연락처'] || ''),
      이메일: String(r.f['이메일'] || ''),
      업종:   String(r.f['업종'] || ''),
      예산:   String(r.f['예상 예산'] || ''),
      문의:   String(r.f['문의내용'] || ''),
      열:     col
    });
  });

  Logger.log('전체 ' + 응답들.length + '건 → 추가 ' + 추가 + ' / 이미있음 ' + 중복 + ' / 제외 ' + 걸러짐);

  // ★ 새로 들어온 문의는 메일로 알린다.
  //   전에는 시트에만 쌓여서, 문의가 온 줄 모르고 지나가는 일이 있었다.
  //   5-0 폼 접수만 메일이 가고 아임웹은 조용했다.
  if (신규.length) 아임웹_신규알림(신규);
}

/** 새로 들어온 홈페이지 문의를 메일로 알린다. */
function 아임웹_신규알림(신규) {
  var 주소 = PropertiesService.getScriptProperties().getProperty('알림주소');
  if (!주소) { Logger.log('알림주소가 없어 메일을 못 보냅니다.'); return; }

  var 제목 = '[포포몬비즈] 홈페이지 문의 ' + 신규.length + '건 — '
           + 신규.map(function (n) { return n.기업; }).join(', ');

  var 줄 = ['홈페이지(아임웹)로 새 문의가 들어왔습니다.', ''];
  신규.forEach(function (n, i) {
    줄.push((i + 1) + '. ' + n.기업);
    줄.push('   담당자 : ' + (n.담당 || '(미기재)'));
    줄.push('   연락처 : ' + (n.연락처 || '(미기재)'));
    줄.push('   이메일 : ' + (n.이메일 || '(미기재)'));
    if (n.업종)   줄.push('   업종   : ' + n.업종);
    if (n.예산)   줄.push('   예산   : ' + n.예산);
    if (n.문의)   줄.push('   문의   : ' + String(n.문의).replace(/\n/g, ' / ').substring(0, 200));
    줄.push('   시트   : ' + n.열 + '열');
    줄.push('');
  });
  줄.push('광고주 관리 시트');
  줄.push('https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit#gid=' + TARGET_GID);
  줄.push('');
  줄.push('※ 진행상태는 ' + 기본_진행상태 + ' 로 들어갑니다.');

  try { MailApp.sendEmail({ to: 주소, subject: 제목, body: 줄.join('\n') }); Logger.log('신규 문의 메일 발송: ' + 주소); }
  catch (e) { Logger.log('메일 실패: ' + e); }
}

/** 아임웹 폼 제출 목록. 날짜 필터는 API 가 직접 지원한다. */
function 폼응답가져오기(token) {
  var 끝 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var out = [];

  for (var page = 1; page <= 20; page++) {
    var url = API + '/community/form-submissions'
      + '?page=' + page + '&limit=100'
      + '&unitCode=' + encodeURIComponent(UNIT_CODE)
      + '&formNo=' + FORM_NO
      + '&formSubmitTimeType=BETWEEN'
      + '&formSubmitTime=' + encodeURIComponent(시작일 + 'T00:00:00.000Z')
      + '&formSubmitTime=' + encodeURIComponent(끝 + 'T23:59:59.000Z');

    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('조회 실패 ' + res.getResponseCode() + ': ' + res.getContentText().substring(0, 300));
      break;
    }
    var d = JSON.parse(res.getContentText()).data;
    var list = d.list || [];
    if (!list.length) break;

    list.forEach(function (s) {
      var f = {};
      (s.item || []).forEach(function (it) {
        var v = it.value;
        if (v === undefined || v === null || v === '') {
          v = (it.valueList && it.valueList.join) ? it.valueList.join(', ') : '';
        }
        f[it.itemSubject] = v;
      });
      out.push({ submitNo: s.submitNo, wtime: s.wtime, f: f });
    });

    if (page >= (d.totalPage || 1)) break;
  }

  // 오래된 순 — 시트가 시간순으로 쌓이는 구조
  out.sort(function (a, b) { return String(a.wtime).localeCompare(String(b.wtime)); });
  return out;
}

function 필터통과(r) {
  var email = String(r.f['이메일'] || '').toLowerCase();
  for (var i = 0; i < 제외이메일.length; i++) {
    if (email === 제외이메일[i].toLowerCase()) return false;
  }
  var 텍스트 = [r.f['담당자명'], r.f['회사/브랜드명']].join(' ');
  for (var k = 0; k < 제외단어.length; k++) {
    if (제외단어[k] && 텍스트.indexOf(제외단어[k]) >= 0) return false;
  }
  return true;
}

function 셀값(항목, r) {
  var name = String(항목).trim();
  if (name === '') return '';

  var 맵 = null;
  for (var i = 0; i < 행매핑.length; i++) {
    if (행매핑[i][0] === name) { 맵 = 행매핑[i][1]; break; }
  }
  if (맵 === null) return '';                        // 모르는 행은 비워 둔다

  if (맵 === '@진행상태') return 기본_진행상태;
  if (맵 === '@출처')     return 출처값;
  if (맵 === '@응답번호') return r.submitNo;
  if (맵 === '@빈칸')     return '';
  if (맵 === '@연락처')   return 전화형식(r.f['연락처'] || '');
  if (맵 === '@지원사업') return r.f['해당 지원사업을 선택해주세요'] || '-';
  return r.f[맵] || '';
}

/** 01012345678 → 010-1234-5678 (기존 시트 표기에 맞춤) */
function 전화형식(p) {
  var d = String(p).replace(/\D/g, '');
  if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return p;
}

// ═══════════════════════════════════════════════════════════
// 시트 보조
// ═══════════════════════════════════════════════════════════

function 대상시트() {
  // getActiveSpreadsheet() 는 시트에 붙어 있는(컨테이너 바인딩) 프로젝트에서만 동작한다.
  // script.google.com 에서 만든 독립 프로젝트면 null 이 되므로 ID 로 직접 연다.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) throw new Error('스프레드시트를 열 수 없습니다. SPREADSHEET_ID 를 확인하세요.');

  if (SHEET_NAME) { var s = ss.getSheetByName(SHEET_NAME); if (s) return s; }
  var f = ss.getSheets().filter(function (s) { return s.getSheetId() === TARGET_GID; })[0];
  if (!f) throw new Error('gid=' + TARGET_GID + ' 시트를 찾지 못했습니다. SHEET_NAME 을 지정하세요.');
  return f;
}

function A열라벨(sh) {
  return sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return String(r[0]).trim(); });
}

/** 「출처」·「응답번호」 행이 없으면 맨 아래에 만든다. */
function 라벨보정(sh) {
  var 라벨 = A열라벨(sh);
  ['출처', '응답번호'].forEach(function (n) {
    if (라벨.indexOf(n) < 0) {
      var r = sh.getLastRow() + 1;
      sh.getRange(r, 1).setValue(n);
      라벨.push(n);
      Logger.log('「' + n + '」 행을 ' + r + '행에 추가했습니다.');
    }
  });
}

function 이미적재된번호(sh, 라벨) {
  var i = 라벨.indexOf('응답번호'), m = {};
  if (i < 0 || sh.getLastColumn() < 2) return m;
  sh.getRange(i + 1, 2, 1, sh.getLastColumn() - 1).getValues()[0]
    .forEach(function (v) { if (v !== '') m[String(v)] = true; });
  return m;
}

function 기존기업명(sh, 라벨) {
  var i = 라벨.indexOf('기업명(소속)'), m = {};
  if (i < 0 || sh.getLastColumn() < 2) return m;
  sh.getRange(i + 1, 2, 1, sh.getLastColumn() - 1).getValues()[0]
    .forEach(function (v) { var k = String(v).replace(/\s+/g, ''); if (k !== '') m[k] = true; });
  return m;
}

// ═══════════════════════════════════════════════════════════
// 트리거
// ═══════════════════════════════════════════════════════════

function 아임웹_트리거설치() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '단계3_시트에적재') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('단계3_시트에적재').timeBased().everyHours(1).create();
  Logger.log('1시간마다 자동 적재 트리거를 설치했습니다.');
}

function 아임웹_트리거삭제() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('모든 트리거를 삭제했습니다.');
}
