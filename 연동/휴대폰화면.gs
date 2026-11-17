/**
 * 휴대폰용 버튼 화면 (웹앱 doGet)
 *
 * ★ 왜 만들었나
 *   사장님이 이동 중에 「멈춘 게 있나」, 「지금 노션에 반영해라」 를 하실 방법이 없었다.
 *   PC 에 세션이 열려 있어야만 내가 움직인다. 이 화면은 **내가 없어도 돈다.**
 *
 * ★ 여는 법
 *   웹앱 주소 뒤에 ?k=<비밀키> 를 붙인다. 휴대폰 홈 화면에 추가해 두고 쓴다.
 *   비밀키가 없거나 틀리면 아무것도 보여 주지 않는다.
 *   (웹앱 액세스가 「모든 사용자」라 주소만 알면 열리기 때문에 열쇠가 필요하다)
 *
 * ★ 여기서 하는 일은 전부 **되돌릴 수 있거나 안전한 것**만 둔다.
 *   진행완료·불발을 다른 탭으로 옮기는 상태정리는 **넣지 않았다.**
 *   되돌리기 어려운 일을 손가락 하나로 실행하게 두지 않는다.
 */

function doGet(e) {
  var 기대 = PropertiesService.getScriptProperties().getProperty(비밀키_속성);
  var 키   = (e && e.parameter && e.parameter.k) ? e.parameter.k : '';
  if (!기대 || 키 !== 기대) {
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<div style="font-family:sans-serif;padding:40px;text-align:center;color:#666">' +
      '열 수 없습니다.</div>');
  }
  return HtmlService.createHtmlOutput(폰화면HTML(키))
    .setTitle('포포몬비즈')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

/**
 * 휴대폰 화면 주소를 메일로 보낸다.
 * 주소에 비밀키가 들어 있어 옮겨 적기 번거롭다. 메일로 받아 링크만 누르면 된다.
 */
function 폰주소메일() {
  var p = PropertiesService.getScriptProperties();
  var 키 = p.getProperty(비밀키_속성);
  var 주소 = p.getProperty('알림주소');
  if (!키)   return { 성공: false, 오류: '비밀키가 없습니다.' };
  if (!주소) return { 성공: false, 오류: '알림주소가 없습니다.' };

  var url = ScriptApp.getService().getUrl() + '?k=' + 키;

  var 줄 = [
    '휴대폰에서 아래 주소를 누르세요.',
    '',
    url,
    '',
    '── 홈 화면에 추가하는 법 ──',
    '아이폰  : 사파리로 열기 → 아래 공유 버튼 → 「홈 화면에 추가」',
    '안드로이드: 크롬으로 열기 → 오른쪽 위 ⋮ → 「홈 화면에 추가」',
    '',
    '앱처럼 아이콘이 생겨 한 번에 열립니다.',
    '',
    '── 버튼 6개 ──',
    '지금 점검        멈춘 자동화가 있는지',
    '칸반 정렬        제안중을 왼쪽으로',
    '노션 동기화      시트 내용을 노션으로',
    '문의 가져오기    홈페이지 문의 지금 확인',
    '현황 보기        업체 수·곧 불발될 건',
    '견적 이력        최근 견적서 10건',
    '',
    '※ 이 주소에는 비밀키가 들어 있습니다. 남에게 전달하지 마세요.',
    '※ 주소를 모르면 열 수 없습니다.'
  ];

  MailApp.sendEmail({ to: 주소, subject: '[포포몬비즈] 휴대폰 화면 주소', body: 줄.join('\n') });
  return { 성공: true, 보낸곳: 주소 };
}

/** 버튼이 부르는 곳. 열쇠를 다시 확인한다. */
function 폰실행(키, 동작) {
  var 기대 = PropertiesService.getScriptProperties().getProperty(비밀키_속성);
  if (!기대 || 키 !== 기대) return '열쇠가 맞지 않습니다.';

  try {
    if (동작 === '점검')       return 폰_점검();
    if (동작 === '정렬')       return 폰_정렬();
    if (동작 === '노션')       return 폰_노션();
    if (동작 === '아임웹')     return 폰_아임웹();
    if (동작 === '현황')       return 폰_현황();
    if (동작 === '견적')       return 폰_견적();
    return '모르는 동작입니다: ' + 동작;
  } catch (err) {
    return '오류\n' + String(err);
  }
}

// ═══════════════════════════════════════════════════════════
// 각 버튼이 하는 일
// ═══════════════════════════════════════════════════════════

function 폰_점검() {
  var r = 점검();
  var 줄 = [];
  r.결과.forEach(function (x) {
    줄.push((x.정상 ? '정상   ' : '❗멈춤  ') + x.이름 + (x.사유 ? '\n         ' + x.사유 : ''));
  });
  var 나쁨 = r.결과.filter(function (x) { return !x.정상; }).length;
  줄.unshift(나쁨 ? ('멈춘 것 ' + 나쁨 + '개') : '전부 정상입니다');
  줄.push('');
  줄.push('열 정렬 ' + (r.정렬 || 0) + '번 이동');
  return 줄.join('\n');
}

function 폰_정렬() {
  var sh = 문의탭();
  var 업체행 = 행찾기(sh, '기업명(소속)');
  var 상태행 = 행찾기(sh, '진행상태');
  if (!업체행 || !상태행) return '기업명 또는 진행상태 행을 못 찾았습니다.';
  var n = 열정렬(sh, 업체행, 상태행);
  return n ? (n + '개 열을 옮겼습니다.\n제안중 → 진행중 → 진행대기 순서입니다.')
           : '이미 순서가 맞습니다.';
}

function 폰_노션() {
  var r = 노션동기화();
  if (!r.성공) return '실패\n' + (r.오류 || '');
  var 줄 = ['새로 만듦 ' + r.만듦.length + '개',
            '갱신     ' + r.갱신.length + '개',
            '그대로   ' + r.그대로 + '개'];
  if (r.보호 && r.보호.length) {
    줄.push('');
    줄.push('노션에서 고치신 칸은 그대로 뒀습니다 (' + r.보호.length + '건)');
    r.보호.slice(0, 5).forEach(function (s) { 줄.push('  ' + s); });
  }
  if (r.오류 && r.오류.length) {
    줄.push('');
    줄.push('❗실패 ' + r.오류.length + '건');
    r.오류.slice(0, 3).forEach(function (s) { 줄.push('  ' + s.substring(0, 90)); });
  }
  return 줄.join('\n');
}

function 폰_아임웹() {
  if (typeof 단계3_시트에적재 !== 'function') return '아임웹 연동이 프로젝트에 없습니다.';
  단계3_시트에적재();
  return '홈페이지 문의를 가져왔습니다.\n새 문의가 있으면 메일이 갑니다.';
}

function 폰_현황() {
  var r = 현황요약();
  var 줄 = [];
  // ★ 상태별 개수는 r.상태별 안에 들어 있다. r 바로 밑에 있는 줄 알고 찾다가 빈 화면이 나왔다.
  var 상태 = r.상태별 || {};
  for (var k in 상태) 줄.push(k + '  ' + 상태[k] + '개');
  if (r['진행완료탭'] !== undefined) 줄.push('진행완료  ' + r['진행완료탭'] + '개');
  if (r['불발탭'] !== undefined)     줄.push('불발      ' + r['불발탭'] + '개');
  if (r['5-0응답'] !== undefined)    줄.push('폼 접수   ' + r['5-0응답'] + '건');
  if (r.불발임박 && r.불발임박.length) {
    줄.push('');
    줄.push('곧 불발되는 업체');
    r.불발임박.slice(0, 6).forEach(function (s) { 줄.push('  ' + s); });
  }
  return 줄.length ? 줄.join('\n') : '현황을 읽지 못했습니다.';
}

function 폰_견적() {
  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sh = ss.getSheetByName(견적탭명);
  if (!sh || sh.getLastRow() < 2) return '견적 이력이 비어 있습니다.';
  var 끝 = sh.getLastRow();
  var 처음 = Math.max(2, 끝 - 9);
  var v = sh.getRange(처음, 1, 끝 - 처음 + 1, 10).getValues();
  var 줄 = [];
  for (var i = v.length - 1; i >= 0; i--) {
    // ★ 날짜 칸을 그대로 이으면 「Thu Sep 17 2026 00:00:00 GMT+0900」 가 된다.
    //   금액은 숫자로 저장돼 콤마가 없다. 둘 다 보기 좋게 고친다.
    줄.push(폰날짜(v[i][0]) + '  ' + (v[i][1] || ''));
    줄.push('   ' + (v[i][3] || ''));
    줄.push('   ' + 폰금액(v[i][9]) + ' (VAT포함)');
    줄.push('');
  }
  return 줄.join('\n');
}

/** 날짜 칸이면 yyyy-MM-dd 로. 아니면 글자 그대로. */
function 폰날짜(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  return String(v === null || v === undefined ? '' : v).trim();
}

/** 11000000 → 11,000,000. 이미 콤마가 있으면 그대로. */
function 폰금액(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (s === '') return '';
  if (s.indexOf(',') >= 0) return s;
  var n = Number(s.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n) || s.replace(/[0-9.\-]/g, '') !== '') return s;
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ═══════════════════════════════════════════════════════════
// 화면
// ═══════════════════════════════════════════════════════════

function 폰화면HTML(키) {
  var 버튼 = [
    ['점검',   '지금 점검',      '멈춘 자동화가 있는지'],
    ['정렬',   '칸반 정렬',      '제안중을 왼쪽으로'],
    ['노션',   '노션 동기화',    '시트 내용을 노션으로'],
    ['아임웹', '문의 가져오기',  '홈페이지 문의 지금 확인'],
    ['현황',   '현황 보기',      '업체 수·곧 불발될 건'],
    ['견적',   '견적 이력',      '최근 견적서 10건']
  ];

  var 목록 = 버튼.map(function (b) {
    return '<button class="b" onclick="go(\'' + b[0] + '\',this)">' +
           '<span class="t">' + b[1] + '</span>' +
           '<span class="s">' + b[2] + '</span></button>';
  }).join('');

  return '' +
'<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
'<style>' +
'*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}' +
'body{margin:0;padding:16px;background:#F2F3F7;' +
'  font-family:-apple-system,"Apple SD Gothic Neo","맑은 고딕",sans-serif;color:#222}' +
'h1{font-size:17px;margin:4px 0 16px;color:#1F3864;letter-spacing:1px}' +
'.b{display:block;width:100%;margin:0 0 10px;padding:16px 18px;text-align:left;' +
'  background:#fff;border:1px solid #D8DCE6;border-radius:12px;font-size:16px;' +
'  font-family:inherit;color:#1F3864;font-weight:700}' +
'.b:active{background:#EDEFF5}' +
'.b:disabled{opacity:.5}' +
'.t{display:block}' +
'.s{display:block;margin-top:3px;font-size:12px;font-weight:400;color:#7A8194}' +
'#out{white-space:pre-wrap;background:#fff;border:1px solid #D8DCE6;border-radius:12px;' +
'  padding:16px;font-size:14px;line-height:1.7;margin-top:6px;min-height:40px;color:#333}' +
'#out:empty{display:none}' +
'.busy{color:#7A8194}' +
'</style></head><body>' +
'<h1>포포몬비즈</h1>' +
목록 +
'<div id="out"></div>' +
'<script>' +
'var K=' + JSON.stringify(키) + ';' +
'function go(a,el){' +
'  var o=document.getElementById("out");' +
'  o.className="busy"; o.textContent="하는 중…";' +
'  var bs=document.querySelectorAll(".b");' +
'  for(var i=0;i<bs.length;i++) bs[i].disabled=true;' +
'  google.script.run' +
'    .withSuccessHandler(function(r){o.className="";o.textContent=r;on(bs);})' +
'    .withFailureHandler(function(e){o.className="";o.textContent="오류\\n"+e.message;on(bs);})' +
'    .폰실행(K,a);' +
'}' +
'function on(bs){for(var i=0;i<bs.length;i++) bs[i].disabled=false;}' +
'</script></body></html>';
}
