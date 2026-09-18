/**
 * 광고주 관리 시트 → 노션 「광고주 관리」 DB 동기화 (1시간마다)
 *
 * ★ 핵심 규칙 — 사장님이 노션에서 고친 칸은 건드리지 않는다
 *
 *   칸 하나 단위다. 한 칸을 고쳤다고 그 업체 줄 전체가 멈추지 않는다.
 *   오구의 계약금액을 고쳐도 오구의 진행상태·연락처는 계속 시트에서 갱신된다.
 *   같은 항목이라도 업체마다 따로 본다.
 *
 *   판단은 **마지막으로 내가 써 넣은 값**과 비교해서 한다.
 *     지금 노션 값 == 내가 마지막에 쓴 값  →  아무도 안 건드림  →  시트 값으로 갱신
 *     지금 노션 값 != 내가 마지막에 쓴 값  →  사장님이 고침     →  그 칸만 건너뛴다
 *
 *   한 번 고친 칸은 **계속** 사장님 값을 지킨다. 시트가 나중에 바뀌어도 덮지 않는다.
 *   (사용자 선택 A, 2026-09-18)
 *
 * ★ 속성을 **ID 로** 찾는다. 이름으로 찾지 않는다.
 *   노션에서 속성 이름을 바꿔도 동기화가 안 깨진다. 이름은 언제든 바꾸셔도 된다.
 *
 * ★ 내가 쓰지 않는 칸
 *   계약구분·제안담당자·PM·협업담당자·프로젝트명·CRM등록여부·계약금액(VAT별도)·
 *   총지급액·선수잔액·계약일·계약종료일·입금현황·계산서·성과평가·No.
 *   시트에 없는 항목이다. 사장님이 노션에서 관리하신다. 아예 손대지 않는다.
 */

var 노션DB_ID   = '3df21cbd-c96e-81b5-87d0-e49aa515627a';
var 노션기록탭  = '_노션동기화';          // 페이지 id 와 마지막으로 쓴 값을 적어 둔다 (숨김)
var 노션API     = 'https://api.notion.com/v1';
var 노션버전    = '2022-06-28';

// 실패 이유를 결과에 실어 보내기 위해 남겨 둔다.
// ★ 로그에만 남기면 아무도 안 본다. 실제로 3건이 조용히 실패했는데
//   결과에는 「만듦 29」 만 나와서, 시트와 대조하기 전까지 몰랐다.
var 노션마지막오류 = '';

/**
 * 시트 행 라벨 → 노션 속성.
 *
 * ★ 이름이 아니라 **ID** 로 찾는다. 노션에서 속성 이름을 바꿔도 안 깨진다.
 *
 * ★ 속성의 **종류를 바꾸면 ID 가 새로 생긴다.** 옛 ID 를 그대로 두면
 *   「… is not a property that exists」 로 조용히 실패한다. 실제로 3건이 그렇게 실패했다.
 *   종류를 바꾸거나 속성을 다시 만들면 여기 ID 를 반드시 새로 읽어 맞춘다.
 */
var 노션매핑 = [
  { 행: '기업명(소속)',        id: 'title',          종류: 'title' },
  { 행: '진행상태',           id: '%3Ad%5Eo',       종류: 'select' },
  { 행: '신청자명',           id: 'EV_w',           종류: 'rich_text' },
  { 행: '연락처',            id: 'IpX~',           종류: 'phone_number' },
  { 행: '이메일',            id: 'tNIN',           종류: 'email' },
  { 행: '업종',             id: 'Kte%7C',         종류: 'rich_text' },
  { 행: '광고 상품',          id: 'UDp_',           종류: 'rich_text' },
  { 행: '예상 예산',          id: 'OtlH',           종류: 'rich_text' },
  { 행: '해당 지원사업',        id: 'Yug%7B',         종류: 'rich_text' },
  { 행: '문의내용',           id: '_UgT',           종류: 'rich_text' },
  { 행: '출처',             id: 'bQ%5E%7C',       종류: 'select' },
  { 행: '5-1 가이드',        id: 'anqh',           종류: 'url' },
  { 행: '6 공고',           id: '%3FH%7Cw',       종류: 'url' },
  { 행: '3-1 가이드',        id: 'QPiY',           종류: 'rich_text' },
  { 행: '4 공고',           id: 'grxf',           종류: 'rich_text' },
  { 행: '견적금액',           id: 'Ilxl',           종류: 'rich_text' },
  { 행: '견적서',            id: '%3DvKS',         종류: 'url' },
  { 행: '진행 갱신',          id: 'VVMT',           종류: 'rich_text' }
];


// ═══════════════════════════════════════════════════════════
// 진입점
// ═══════════════════════════════════════════════════════════

/** 1시간마다 도는 동기화. */
function 노션동기화() { return 노션동기화실행(false); }

/** 무엇이 바뀔지만 본다. 아무것도 쓰지 않는다. */
function 노션동기화_미리보기() { return 노션동기화실행(true); }

/**
 * 「마지막으로 쓴 값」 기록만 지운다. 페이지 id 는 남긴다.
 *
 * ★ 이걸 돌리면 **사장님이 노션에서 고친 칸도 시트 값으로 덮인다.**
 *   기록이 없으면 「처음 쓰는 칸」으로 보기 때문이다.
 *   쓰는 쪽 코드를 고쳐 기록이 어긋났을 때만 쓴다. 평소에는 쓰지 않는다.
 */
function 노션기록_값만초기화() {
  var 기록 = 노션기록읽기();
  var n = 0;
  for (var k in 기록) { 기록[k].마지막 = {}; n++; }
  노션기록쓰기(기록);
  Logger.log('기록 ' + n + '줄의 값을 지웠습니다. 페이지 id 는 남겼습니다.');
  return { 성공: true, 초기화: n };
}

/**
 * 노션 DB 의 줄을 전부 보관 처리하고 기록도 비운다. 처음부터 다시 만들 때 쓴다.
 *
 * ★ 사장님이 노션에 적어 둔 계약·정산 값도 같이 사라진다.
 *   보관(휴지통)이라 30일 안에는 되살릴 수 있지만, 함부로 쓰지 않는다.
 *   열쇠 규칙이 바뀌어 짝이 안 맞을 때만 쓴다.
 */
function 노션_전부지우고다시() {
  var 토큰 = PropertiesService.getScriptProperties().getProperty('노션토큰');
  if (!토큰) return { 성공: false, 오류: '노션토큰이 없습니다.' };

  var 지움 = 0, cursor = null;
  do {
    var body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    var res = UrlFetchApp.fetch(노션API + '/databases/' + 노션DB_ID + '/query', {
      method: 'post', contentType: 'application/json',
      headers: 노션헤더(토큰), payload: JSON.stringify(body), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) break;
    var d = JSON.parse(res.getContentText());
    (d.results || []).forEach(function (p) {
      UrlFetchApp.fetch(노션API + '/pages/' + p.id, {
        method: 'patch', contentType: 'application/json',
        headers: 노션헤더(토큰), payload: JSON.stringify({ archived: true }),
        muteHttpExceptions: true
      });
      지움++;
    });
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);

  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sh = ss.getSheetByName(노션기록탭);
  if (sh) ss.deleteSheet(sh);

  Logger.log('노션 줄 ' + 지움 + '개 보관 처리, 기록 탭 삭제');
  return { 성공: true, 지움: 지움 };
}

function 노션동기화실행(미리보기) {
  var 토큰 = PropertiesService.getScriptProperties().getProperty('노션토큰');
  if (!토큰) return { 성공: false, 오류: '노션토큰이 없습니다.' };

  var sh = 문의탭();
  var 업체행 = 행찾기(sh, '기업명(소속)');
  if (!업체행) return { 성공: false, 오류: '기업명(소속) 행이 없습니다.' };

  var 끝열 = sh.getLastColumn();
  var 값 = sh.getRange(1, 1, sh.getLastRow(), 끝열).getValues();

  // A열 라벨 → 행 번호
  var 행번호 = {};
  for (var i = 0; i < 값.length; i++) {
    var l = String(값[i][0] || '').trim();
    if (l !== '') 행번호[l] = i;
  }

  var 기록 = 노션기록읽기();
  var 본run키 = {};                 // 이번 실행에서 같은 열쇠가 또 나오는지 센다
  var 만듦 = [], 갱신 = [], 보호 = [], 그대로 = [], 오류 = [];

  for (var c = 2; c <= 끝열; c++) {
    var 업체 = 첫줄(값[업체행 - 1][c - 1]);
    if (업체 === '') continue;

    // ★ 열쇠를 이름만으로 만들면 안 된다.
    //   「호텔스토리(프라임)」·「비엘르」처럼 같은 이름이 두 열에 있다.
    //   그러면 두 열이 노션 페이지 하나를 함께 쓰게 되고,
    //   **뒤 열의 빈 값이 앞 열이 채운 값을 지운다.** 실제로 견적금액이 그렇게 날아갔다.
    //   이름·응답번호·신청자·연락처를 합쳐 구분한다.
    var 조각 = [업체];
    ['응답번호', '신청자명', '연락처'].forEach(function (lab) {
      var r = 행번호[lab];
      조각.push(r === undefined ? '' : 첫줄(값[r][c - 1]));
    });
    var 키 = 조각.join('|');

    // 그래도 똑같으면 순번을 붙인다. 한 페이지를 둘이 쓰는 것보다 낫다.
    if (본run키[키]) { 본run키[키]++; 키 = 키 + '#' + 본run키[키]; }
    else 본run키[키] = 1;

    // 시트에서 이번에 보낼 값
    var 보낼값 = {};
    노션매핑.forEach(function (m) {
      var r = 행번호[m.행];
      보낼값[m.id] = (r === undefined) ? '' : 시트값글자(값[r][c - 1]);
    });

    var 줄 = 기록[키] || { 페이지: '', 마지막: {} };

    if (!줄.페이지) {
      if (미리보기) { 만듦.push(업체); continue; }
      var 새id = 노션페이지만들기(토큰, 보낼값);
      if (!새id) { 오류.push(업체 + ' — ' + 노션마지막오류); continue; }
      줄.페이지 = 새id;
      // ★ 보낸 값이 아니라 **다시 읽은 값**을 기록한다.
      //   노션이 값을 바꿔 저장하는 경우가 있다 (주소가 아닌 글을 url 칸에 보내면 비워진다).
      //   보낸 값을 그대로 적어 두면 다음 번에 「사장님이 고쳤다」로 잘못 보고 영원히 잠긴다.
      줄.마지막 = 노션페이지읽기(토큰, 새id) || 보낼값;
      기록[키] = 줄;
      만듦.push(업체);
      continue;
    }

    // 지금 노션 값을 읽어 사장님이 고쳤는지 본다
    var 현재 = 노션페이지읽기(토큰, 줄.페이지);
    if (현재 === null) { 오류.push(업체 + ' — 읽기 실패'); continue; }

    var 쓸것 = {}, 쓸개수 = 0, 이번보호 = [];
    노션매핑.forEach(function (m) {
      if (m.종류 === 'title') return;                       // 제목은 열쇠라 건드리지 않는다
      var 마지막 = 줄.마지막[m.id];
      var 지금   = 현재[m.id] === undefined ? '' : 현재[m.id];
      var 시트   = 보낼값[m.id];

      if (마지막 === undefined) {                            // 한 번도 안 쓴 칸
        if (시트 !== '') { 쓸것[m.id] = 시트; 쓸개수++; }
        return;
      }
      if (지금 !== 마지막) { 이번보호.push(m.행); return; }   // ★ 사장님이 고친 칸 — 건드리지 않는다
      if (시트 !== 마지막) { 쓸것[m.id] = 시트; 쓸개수++; }
    });

    if (이번보호.length) 보호.push(업체 + ' [' + 이번보호.join(', ') + ']');

    if (!쓸개수) { 그대로.push(업체); continue; }
    if (미리보기) { 갱신.push(업체 + ' (' + 쓸개수 + '칸)'); continue; }

    if (노션페이지고치기(토큰, 줄.페이지, 쓸것)) {
      // 다시 읽어서 기록한다. 보낸 값과 저장된 값이 다를 수 있다 (위 설명 참고).
      var 다시 = 노션페이지읽기(토큰, 줄.페이지);
      for (var k in 쓸것) {
        줄.마지막[k] = (다시 && 다시[k] !== undefined) ? 다시[k] : 쓸것[k];
      }
      기록[키] = 줄;
      갱신.push(업체 + ' (' + 쓸개수 + '칸)');
    }
  }

  if (!미리보기) 노션기록쓰기(기록);

  var 결과 = { 성공: true, 미리보기: !!미리보기,
               만듦: 만듦, 갱신: 갱신, 보호: 보호, 그대로: 그대로.length, 오류: 오류 };
  Logger.log((미리보기 ? '[미리보기] ' : '') + '만듦 ' + 만듦.length +
             ' / 갱신 ' + 갱신.length + ' / 보호 ' + 보호.length + ' / 그대로 ' + 그대로.length);
  return 결과;
}

// ═══════════════════════════════════════════════════════════
// 노션 주고받기
// ═══════════════════════════════════════════════════════════

function 노션헤더(토큰) {
  return { Authorization: 'Bearer ' + 토큰, 'Notion-Version': 노션버전 };
}

/**
 * 시트 칸 → 글자.
 * ★ 날짜 칸은 String() 하면 「Fri Sep 18 2026 16:29:00 GMT+0900 (한국 표준시)」 가 된다.
 *   시트 화면에 보이는 모양과 전혀 달라 노션에 그대로 들어간 적이 있다.
 */
function 시트값글자(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    var 시분 = (v.getHours() || v.getMinutes()) ? ' HH:mm' : '';
    return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd' + 시분);
  }
  return String(v).trim();
}

/** 글 안에서 첫 번째 http(s) 주소만 꺼낸다. url 칸에 넣을 때 쓴다. */
function 첫주소(s) {
  var m = String(s || '').match(/https?:\/\/[^\s)>\]]+/);
  return m ? m[0] : '';
}

/** 값 하나를 노션 속성 모양으로. 빈 값은 null 로 지운다. */
function 노션값(종류, v) {
  v = String(v === undefined || v === null ? '' : v);
  if (종류 === 'title')        return { title: v === '' ? [] : [{ type: 'text', text: { content: v.substring(0, 2000) } }] };
  if (종류 === 'rich_text')    return { rich_text: v === '' ? [] : [{ type: 'text', text: { content: v.substring(0, 2000) } }] };
  if (종류 === 'select')       return { select: v === '' ? null : { name: v.substring(0, 100) } };
  if (종류 === 'email')        return { email: v === '' ? null : v };
  if (종류 === 'phone_number') return { phone_number: v === '' ? null : v };
  // 앞에 「📝 블로그」 같은 말머리가 붙어 와도 주소만 꺼내 넣는다. 통째로 버리지 않는다.
  if (종류 === 'url')          { var u = 첫주소(v); return { url: u === '' ? null : u }; }
  if (종류 === 'number') {
    var n = Number(v.replace(/[^0-9.\-]/g, ''));
    return { number: (v === '' || isNaN(n)) ? null : n };
  }
  return { rich_text: [] };
}

/** 노션 속성 → 비교용 문자열. 쓸 때와 같은 모양이어야 비교가 맞는다. */
function 노션평문(p) {
  if (!p) return '';
  var t = p.type;
  if (t === 'title' || t === 'rich_text') {
    return (p[t] || []).map(function (x) { return x.plain_text || ''; }).join('');
  }
  if (t === 'select')       return p.select ? p.select.name : '';
  if (t === 'email')        return p.email || '';
  if (t === 'phone_number') return p.phone_number || '';
  if (t === 'url')          return p.url || '';
  if (t === 'number')       return (p.number === null || p.number === undefined) ? '' : String(p.number);
  if (t === 'date')         return p.date && p.date.start ? p.date.start : '';
  return '';
}

function 노션페이지만들기(토큰, 보낼값) {
  var props = {};
  노션매핑.forEach(function (m) {
    var v = 보낼값[m.id];
    if (m.종류 !== 'title' && (v === undefined || v === '')) return;   // 빈 값은 아예 안 보낸다
    props[m.id] = 노션값(m.종류, v);
  });

  var res = UrlFetchApp.fetch(노션API + '/pages', {
    method: 'post', contentType: 'application/json',
    headers: 노션헤더(토큰),
    payload: JSON.stringify({ parent: { database_id: 노션DB_ID }, properties: props }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    노션마지막오류 = res.getResponseCode() + ' ' + res.getContentText().substring(0, 220);
    Logger.log('페이지 만들기 실패 ' + 노션마지막오류);
    return '';
  }
  return JSON.parse(res.getContentText()).id;
}

/** 페이지의 지금 값들을 { 속성id: 평문 } 으로. */
function 노션페이지읽기(토큰, 페이지id) {
  var res = UrlFetchApp.fetch(노션API + '/pages/' + 페이지id, {
    headers: 노션헤더(토큰), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('페이지 읽기 실패 ' + res.getResponseCode() + ': ' + res.getContentText().substring(0, 200));
    return null;
  }
  var p = JSON.parse(res.getContentText()).properties || {};
  var out = {};
  for (var 이름 in p) out[p[이름].id] = 노션평문(p[이름]);
  return out;
}

function 노션페이지고치기(토큰, 페이지id, 쓸것) {
  var props = {};
  노션매핑.forEach(function (m) {
    if (쓸것[m.id] === undefined) return;
    props[m.id] = 노션값(m.종류, 쓸것[m.id]);
  });
  var res = UrlFetchApp.fetch(노션API + '/pages/' + 페이지id, {
    method: 'patch', contentType: 'application/json',
    headers: 노션헤더(토큰),
    payload: JSON.stringify({ properties: props }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('페이지 고치기 실패 ' + res.getResponseCode() + ': ' + res.getContentText().substring(0, 300));
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════
// 기록 — 페이지 id 와 마지막으로 쓴 값
// ═══════════════════════════════════════════════════════════
// 이게 있어야 「사장님이 고쳤는지」를 안다. 지우면 다음 동기화 때
// 모든 칸을 처음 쓰는 것으로 보고 덮어쓴다. 함부로 지우지 않는다.

function 노션기록읽기() {
  var sh = 탭확보(SpreadsheetApp.openById(통합시트_ID), 노션기록탭);
  var 기록 = {};
  if (sh.getLastRow() < 2) return 기록;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < v.length; i++) {
    var 키 = String(v[i][0] || '').trim();
    if (키 === '') continue;
    var 마지막 = {};
    try { 마지막 = JSON.parse(v[i][2] || '{}'); } catch (e) {}
    기록[키] = { 페이지: String(v[i][1] || ''), 마지막: 마지막 };
  }
  return 기록;
}

function 노션기록쓰기(기록) {
  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sh = 탭확보(ss, 노션기록탭);
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['업체키', '노션 페이지 id', '마지막으로 쓴 값(JSON)']])
    .setFontWeight('bold').setBackground('#F2F4F8');
  var 줄 = [];
  for (var k in 기록) 줄.push([k, 기록[k].페이지, JSON.stringify(기록[k].마지막)]);
  if (줄.length) sh.getRange(2, 1, 줄.length, 3).setValues(줄);
  sh.hideSheet();                      // 프로그램이 쓰는 탭이다
  return 줄.length;
}
