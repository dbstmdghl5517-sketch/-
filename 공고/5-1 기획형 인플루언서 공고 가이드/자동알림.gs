/**
 * 5-0 폼에 새 업체가 등록되면 자동으로 알리고 초안을 만든다.
 *
 * ★ 왜 초안까지만인가
 *   5-1 의 핵심은 광고주가 비워 낸 항목을 포포몬비즈가 업체를 조사해 채우는 일이다.
 *   Apps Script 는 웹 조사를 할 수 없다. 그래서 여기서는 광고주 원문만으로 초안을 만들고,
 *   채워야 할 항목을 이메일로 알린다. 조사·보완은 사람이 한 뒤 덮어쓴다.
 *
 *   ※ 초안을 광고주에게 그대로 보내면 안 된다. 제목에 [초안] 을 붙여 구분한다.
 *
 * ★ 하는 일 (폼 제출 즉시)
 *   1) 0_가이드 관리 시트에 행 추가
 *   2) 구글 문서 초안 생성 — 빈 항목은 ❗포포몬비즈 작성 필요
 *   3) 노션 프로젝트 초안 생성 — 토큰이 설정돼 있을 때만
 *   4) 이메일 발송 — 업체명·담당자·비어 있는 항목 목록·문서 링크
 *
 * ★ 이 파일은 구글문서생성.gs 와 같은 프로젝트에 둔다.
 *   문서만들기() · 폴더확보() · 관리시트갱신() 등을 그대로 쓴다.
 *
 * ═══ 설치 (한 번만) ═══
 *   1) [설정_알림받을주소] 안의 주소를 확인하고 실행
 *   2) 노션 초안도 만들려면 [설정_노션] 안의 두 줄을 채우고 실행 (건너뛰어도 된다)
 *   3) [트리거설치] 실행 → 권한 승인
 *      · 폼 제출 트리거: 폼으로 들어온 응답을 즉시 처리
 *      · 10분 주기 트리거: 폼이 아닌 경로(아임웹 등)로 들어온 행을 놓치지 않게 보완
 *   4) 확인은 [시험_마지막행처리] 로 한다 (마지막 한 행을 강제로 다시 처리한다)
 *
 *   트리거를 지우려면 [트리거삭제].
 */

// ═══════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════

var 응답시트_ID = '1QDKvfEF31SDT0vN8rkwyLtcb7c6sJikLtXWICqrpUEY';

var 초안접두 = '[초안] ';

// 응답 시트 열 번호 (0부터). 5-0 폼 문항 순서와 같다.
var 열 = {
  타임스탬프: 0, 브랜드명: 1, 담당자: 2, 링크: 3, 홍보제품: 4, 제공혜택: 5,
  진행방식: 6, 브랜드소개: 7, 강조포인트: 8, 캠페인목적: 9, 콘텐츠스타일: 10,
  분위기: 11, 필수장면: 12, 게시글필수항목: 13, 사람태그: 14, 레퍼런스링크: 15,
  일정: 16, 업로드시점: 17, 금지사항: 18, '2차활용': 19
};

// 전 캠페인 공통 기본값. 보완내용.tsv 의 `*` 행과 같아야 한다.
// 저작권은 건마다 확인해야 하는 조건이라, 초안에는 기본값을 넣고 메일에 확인 요청을 적는다.
var 공통기본값 = {
  '영상길이':     '30초 ~ 1분 내외',
  '콘텐츠제출일': '방문 후 7일 이내',
  '인사이트기한': '콘텐츠 업로드 후 7일 뒤',
  '저작권':       '인플루언서 업로드 90일 유지 / 저작권 1년 제공',
  '파트너십광고': '제공 필수'
};

// 광고주가 비워 낸 경우 포포몬비즈가 조사해 채워야 하는 항목
var 조사필요항목 = ['브랜드소개', '강조포인트', '콘텐츠스타일', '분위기',
                    '필수장면', '게시글필수항목', '금지사항', '필수해시태그'];

var 미작성표시 = '❗포포몬비즈 작성 필요';

// ═══════════════════════════════════════════════════════════
// 설정 함수 — 값을 바꾼 뒤 한 번 실행한다
// ═══════════════════════════════════════════════════════════

function 설정_알림받을주소() {
  var 주소 = 'tmdghl0809@naver.com';          // ← 여러 명이면 쉼표로 구분
  PropertiesService.getScriptProperties().setProperty('알림주소', 주소);
  Logger.log('알림 주소 저장: ' + 주소);
}

function 설정_노션() {
  var 토큰 = '';                               // ← ntn_... (비워 두면 노션 초안을 만들지 않는다)
  var 페이지 = '1cbc0a5373eb42369a6ee8deeeaf0681';
  var p = PropertiesService.getScriptProperties();
  if (토큰 === '') { Logger.log('토큰이 비어 있습니다. 노션 초안은 건너뜁니다.'); return; }
  p.setProperty('노션토큰', 토큰);
  p.setProperty('노션페이지', 페이지);
  Logger.log('노션 설정 저장 완료. 대상 페이지: ' + 페이지);
}

function 설정확인() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('알림주소   : ' + (p.getProperty('알림주소') || '(없음 — 설정_알림받을주소 실행 필요)'));
  Logger.log('노션토큰   : ' + (p.getProperty('노션토큰') ? '설정됨' : '(없음 — 노션 초안 건너뜀)'));
  Logger.log('노션페이지 : ' + (p.getProperty('노션페이지') || '(없음)'));
  Logger.log('처리한 건  : ' + (처리목록().length) + '건');
}

// ═══════════════════════════════════════════════════════════
// 트리거
// ═══════════════════════════════════════════════════════════

function 트리거설치() {
  트리거삭제();
  var ss = SpreadsheetApp.openById(응답시트_ID);

  // 폼으로 들어온 응답 → 즉시
  ScriptApp.newTrigger('새응답처리').forSpreadsheet(ss).onFormSubmit().create();

  // 폼이 아닌 경로(아임웹 연동 등)로 행이 늘어난 경우를 위한 보완.
  // onFormSubmit 은 실제 폼 제출에만 걸리므로 이것 없이는 놓친다.
  ScriptApp.newTrigger('놓친행확인').timeBased().everyMinutes(10).create();

  Logger.log('트리거 2개 설치 완료 (폼 제출 / 10분 주기)');
}

function 트리거삭제() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === '새응답처리' || f === '놓친행확인') ScriptApp.deleteTrigger(t);
  });
  Logger.log('기존 트리거 삭제');
}

// ═══════════════════════════════════════════════════════════
// 진입점
// ═══════════════════════════════════════════════════════════

/** 폼 제출 트리거. e.range 로 어느 행인지 알 수 있다. */
function 새응답처리(e) {
  var 행번호 = (e && e.range) ? e.range.getRow() : 마지막행번호();
  처리(행번호);
}

/** 10분 주기. 아직 처리하지 않은 행을 모두 훑는다. */
function 놓친행확인() {
  var sh = 응답시트();
  var 끝 = sh.getLastRow();
  for (var r = 2; r <= 끝; r++) 처리(r);
}

function 시험_마지막행처리() {
  var r = 마지막행번호();
  처리목록삭제(r);                       // 이미 처리했더라도 다시 하도록
  처리(r);
}

// ═══════════════════════════════════════════════════════════
// 처리
// ═══════════════════════════════════════════════════════════

function 처리(행번호) {
  if (행번호 < 2) return;

  var sh = 응답시트();
  var 값들 = sh.getRange(행번호, 1, 1, sh.getLastColumn()).getValues()[0];
  var 브랜드 = 텍스트(값들[열.브랜드명]);
  if (브랜드 === '') return;

  var 키 = 처리키(행번호, 브랜드);
  if (이미처리(키)) return;

  var d = 데이터만들기(값들);
  var 폴더 = 폴더확보(폴더명);

  // 1) 구글 문서 초안
  var 문서url = '';
  try {
    var 문서명 = 초안접두 + d.날짜 + ' ' + 브랜드 + 문서접미;
    같은브랜드문서(폴더, 브랜드).forEach(function (f) { f.setTrashed(true); });
    문서url = 문서만들기(폴더, 문서명, d);
  } catch (err) {
    Logger.log('구글 문서 실패: ' + err);
  }

  // 2) 관리 시트 — 지우지 않고 한 줄만 덧붙인다
  var 시트url = '';
  try {
    시트url = 관리시트에추가(폴더, [브랜드, 항목값(d, '진행방식'), d.접수일,
                                  문서url, '초안(작성 필요)', 작성필요목록(d).join(', ')]);
  } catch (err) {
    Logger.log('관리 시트 실패: ' + err);
  }

  // 3) 노션 초안 (토큰이 있을 때만)
  var 노션url = 노션초안(d);

  // 4) 이메일
  알림보내기(d, 문서url, 시트url, 노션url);

  처리기록(키);
  Logger.log('처리 완료: ' + 브랜드 + ' (' + 행번호 + '행)');
}

/**
 * 응답 한 행 → 구글문서생성.gs 가 쓰는 데이터 모양으로.
 * 광고주가 적은 것은 구분 '원문', 비워 낸 것은 '제안' + 미작성표시 로 둔다.
 * 그래야 문서에 빨간 글씨로 「작성 필요」 가 보인다.
 */
function 데이터만들기(값들) {
  var 항목 = {};

  for (var 이름 in 열) {
    if (이름 === '타임스탬프' || 이름 === '브랜드명' || 이름 === '담당자') continue;
    var v = 텍스트(값들[열[이름]]);
    항목[이름] = 비었나(v)
      ? { 구분: '제안', 원문: '', 보완: 미작성표시 }
      : { 구분: '원문', 원문: v, 보완: '' };
  }

  // 폼에 없는 항목 — 공통 기본값
  for (var k in 공통기본값) {
    항목[k] = { 구분: '제안', 원문: '', 보완: 공통기본값[k] };
  }
  if (!항목['필수해시태그']) {
    항목['필수해시태그'] = { 구분: '제안', 원문: '', 보완: 미작성표시 };
  }

  // 기본 제작 안내는 양식(가이드_양식.html)이 기준이지만, 초안 단계에서는
  // 로컬 파일을 읽을 수 없으므로 구글문서생성.gs 의 대비값이 쓰인다.

  return {
    브랜드: 텍스트(값들[열.브랜드명]),
    담당자: 텍스트(값들[열.담당자]),
    접수일: 날짜문자(값들[열.타임스탬프]),
    날짜:   날짜문자(값들[열.타임스탬프]),   // 최초 작성일 = 폼 제출일. 이후 바뀌지 않는다
    항목: 항목
  };
}

/** 조사해서 채워야 하는 항목 목록 */
function 작성필요목록(d) {
  var 목록 = [];
  조사필요항목.forEach(function (k) {
    var it = d.항목[k];
    if (it && it.보완 === 미작성표시) 목록.push(k);
  });
  return 목록;
}

// ═══════════════════════════════════════════════════════════
// 관리 시트 — 추가 전용
// ═══════════════════════════════════════════════════════════
// 구글문서생성.gs 의 관리시트갱신() 은 시트를 지우고 전체를 다시 쓴다(일괄 발행용).
// 자동 알림은 한 건씩 들어오므로 그걸 쓰면 기존 행이 날아간다. 그래서 따로 둔다.
// 같은 브랜드가 이미 있으면 그 행을 갱신한다.

function 관리시트에추가(폴더, 행) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('관리시트_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(관리시트명);
    props.setProperty('관리시트_ID', ss.getId());
    var f = DriveApp.getFileById(ss.getId());
    폴더.addFile(f);
    DriveApp.getRootFolder().removeFile(f);
  }

  var sh = ss.getSheets()[0];
  var 머리글 = ['브랜드', '진행 방식', '문의 접수일', '가이드 문서', '상태',
                '포포몬비즈 보완 항목', '갱신'];

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 머리글.length).setValues([머리글])
      .setFontWeight('bold').setBackground('#F2F4F8');
    sh.setFrozenRows(1);
    [22, 12, 14, 52, 10, 46, 18].forEach(function (w, i) { sh.setColumnWidth(i + 1, w * 8); });
  }

  var 지금 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  var 값 = 행.concat([지금]);

  // 같은 브랜드가 있으면 덮어쓴다
  var 찾은 = 0;
  if (sh.getLastRow() > 1) {
    var 브랜드열 = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < 브랜드열.length; i++) {
      if (String(브랜드열[i][0]).trim() === String(행[0]).trim()) { 찾은 = i + 2; break; }
    }
  }
  var 줄 = 찾은 || (sh.getLastRow() + 1);
  sh.getRange(줄, 1, 1, 값.length).setValues([값]);
  sh.getRange(줄, 6).setFontColor(빨강).setWrap(true);

  return ss.getUrl();
}

// ═══════════════════════════════════════════════════════════
// 노션 초안
// ═══════════════════════════════════════════════════════════

function 노션초안(d) {
  var p = PropertiesService.getScriptProperties();
  var 토큰 = p.getProperty('노션토큰');
  var 부모 = p.getProperty('노션페이지');
  if (!토큰 || !부모) return '';

  var 제목 = 초안접두 + d.날짜 + ' ' + d.브랜드;
  var 줄들 = [];
  줄들.push(['heading_2', '📋 아직 초안입니다']);
  줄들.push(['paragraph', '광고주 응답만으로 만든 초안입니다. 아래 항목은 포포몬비즈가 업체를 조사해 채워야 합니다.']);
  var 필요 = 작성필요목록(d);
  if (필요.length) {
    필요.forEach(function (k) { 줄들.push(['bulleted_list_item', k]); });
  } else {
    줄들.push(['paragraph', '비어 있는 항목은 없습니다. 내용 확인 후 정리만 하면 됩니다.']);
  }
  줄들.push(['heading_2', '광고주 응답 원문']);
  ['홍보제품', '진행방식', '제공혜택', '캠페인목적', '브랜드소개', '강조포인트',
   '콘텐츠스타일', '분위기', '필수장면', '게시글필수항목', '사람태그',
   '일정', '업로드시점', '금지사항', '2차활용'].forEach(function (k) {
    var it = d.항목[k];
    if (!it) return;
    줄들.push(['heading_3', k]);
    줄들.push(['paragraph', it.구분 === '원문' ? it.원문 : 미작성표시]);
  });

  var children = 줄들.map(function (pair) {
    var t = pair[0];
    var o = { object: 'block', type: t };
    o[t] = { rich_text: [{ type: 'text', text: { content: String(pair[1]).slice(0, 2000) } }] };
    return o;
  });

  try {
    var res = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + 토큰, 'Notion-Version': '2022-06-28' },
      payload: JSON.stringify({
        parent: { page_id: 부모 },
        properties: { title: { title: [{ type: 'text', text: { content: 제목 } }] } },
        children: children.slice(0, 100)
      }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('노션 실패 ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
      return '';
    }
    return JSON.parse(res.getContentText()).url || '';
  } catch (err) {
    Logger.log('노션 오류: ' + err);
    return '';
  }
}

// ═══════════════════════════════════════════════════════════
// 이메일
// ═══════════════════════════════════════════════════════════

function 알림보내기(d, 문서url, 시트url, 노션url) {
  var 주소 = PropertiesService.getScriptProperties().getProperty('알림주소');
  if (!주소) { Logger.log('알림 주소가 없습니다. [설정_알림받을주소] 를 실행하세요.'); return; }

  var 필요 = 작성필요목록(d);
  var 제목 = '[포포몬비즈] 기획형 인플루언서 신규 등록 — ' + d.브랜드;

  var 줄 = [];
  줄.push('새 업체가 5-0 양식폼에 등록됐습니다.');
  줄.push('');
  줄.push('업체명   : ' + d.브랜드);
  줄.push('담당자   : ' + (d.담당자 || '(미기재)'));
  줄.push('접수일   : ' + d.접수일);
  줄.push('진행방식 : ' + 항목값(d, '진행방식'));
  줄.push('제공내역 : ' + 항목값(d, '제공혜택'));
  줄.push('');

  if (필요.length) {
    줄.push('■ 포포몬비즈가 조사해 채워야 하는 항목 (' + 필요.length + '개)');
    필요.forEach(function (k) { 줄.push('   - ' + k); });
  } else {
    줄.push('■ 비어 있는 항목 없음 — 내용 정리만 하면 됩니다.');
  }
  줄.push('');
  줄.push('■ 저작권 조건 확인 필요');
  줄.push('   초안에는 기본값 「인플루언서 업로드 90일 유지 / 저작권 1년 제공」 이 들어갔습니다.');
  줄.push('   이 건에 맞는지 확인해 주세요.');
  줄.push('');
  줄.push('■ 만들어진 초안');
  if (문서url) 줄.push('   구글 문서 : ' + 문서url);
  if (노션url) 줄.push('   노션       : ' + 노션url);
  if (시트url) 줄.push('   관리 시트 : ' + 시트url);
  if (!노션url) 줄.push('   (노션 초안은 토큰이 설정되지 않아 건너뛰었습니다)');
  줄.push('');
  줄.push('※ 초안은 광고주에게 보내지 마세요. 조사·보완 후 발행해야 합니다.');
  줄.push('');
  줄.push('다음 단계: 클로드에게 「5-1 ' + d.브랜드 + '」 라고 지시하세요.');

  try {
    MailApp.sendEmail({ to: 주소, subject: 제목, body: 줄.join('\n') });
    Logger.log('메일 발송: ' + 주소);
  } catch (err) {
    Logger.log('메일 실패: ' + err);
  }
}

// ═══════════════════════════════════════════════════════════
// 중복 처리 방지
// ═══════════════════════════════════════════════════════════
// 같은 행을 두 번 처리하면 문서와 메일이 중복된다.
// 폼 트리거와 10분 주기 트리거가 같은 행을 볼 수 있어 반드시 필요하다.

function 처리키(행번호, 브랜드) { return 행번호 + '|' + 브랜드; }

function 처리목록() {
  var s = PropertiesService.getScriptProperties().getProperty('처리한행') || '';
  return s === '' ? [] : s.split('\n');
}

function 이미처리(키) { return 처리목록().indexOf(키) >= 0; }

function 처리기록(키) {
  var 목록 = 처리목록();
  목록.push(키);
  if (목록.length > 500) 목록 = 목록.slice(목록.length - 500);   // 속성 크기 제한(9KB)
  PropertiesService.getScriptProperties().setProperty('처리한행', 목록.join('\n'));
}

function 처리목록삭제(행번호) {
  var 목록 = 처리목록().filter(function (k) {
    return k.split('|')[0] !== String(행번호);
  });
  PropertiesService.getScriptProperties().setProperty('처리한행', 목록.join('\n'));
}

/** 전부 다시 처리하고 싶을 때. 문서·메일이 다시 만들어지니 주의. */
function 처리기록_전체삭제() {
  PropertiesService.getScriptProperties().deleteProperty('처리한행');
  Logger.log('처리 기록을 지웠습니다. 다음 실행에서 모든 행을 다시 처리합니다.');
}

// ═══════════════════════════════════════════════════════════
// 보조
// ═══════════════════════════════════════════════════════════

function 응답시트() { return SpreadsheetApp.openById(응답시트_ID).getSheets()[0]; }
function 마지막행번호() { return 응답시트().getLastRow(); }

function 텍스트(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\r/g, '').replace(/^\s+|\s+$/g, '');
}

/** 「없음」 처럼 내용이 없는 답변도 빈 것으로 본다. */
function 비었나(v) {
  var s = 텍스트(v).replace(/[.!~\s]+$/, '');
  if (s === '') return true;
  return /^(없음|없습니다|없어요|해당\s*없음|무|미정|아직\s*미정|-)$/.test(s);
}

/** 구글 폼 타임스탬프 → yyyy-MM-dd */
function 날짜문자(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  var s = 텍스트(v);
  var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return s;
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
