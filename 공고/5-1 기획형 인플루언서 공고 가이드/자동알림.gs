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

var 초안접두 = '[초안] ';

// ═══ 폼 목록 ═══════════════════════════════════════════════
//
// ★ 폼이 둘이고, 문항이 서로 다르다. **열 번호로 읽으면 안 된다.**
//   16문항 폼에는 제공혜택·진행방식·강조포인트·분위기·금지사항·2차활용 문항이 아예 없고,
//   대신 영상길이·콘텐츠제출일·인사이트기한 문항이 있다. 순서도 다르다.
//   열 번호로 읽으면 엉뚱한 칸을 브랜드명으로 집는다.
//
//   그래서 **머리글 글자로 열을 찾는다.** 문항 뒤에 붙은 ex) 설명이 바뀌어도,
//   문항 순서가 바뀌어도 안 깨진다. 비교할 때 공백은 무시한다
//   (머리글에 줄바꿈과 두 칸 띄어쓰기가 섞여 있다).
//
// ★ 폼이 하나 더 생기면 여기에 한 덩어리만 넣는다. 다른 곳은 안 고쳐도 된다.
//
// ★ 키접두를 함부로 바꾸지 않는다.
//   이미 처리한 행은 `행번호|브랜드` 로 기록돼 있다. 형식이 어긋나면 처리 기록을
//   못 알아보고 **이미 보낸 알림이 전부 다시 나간다.** 그래서 먼저 쓰던 19문항 폼은
//   접두 없이 그대로 두고, 뒤에 붙는 폼만 접두를 준다.

var 폼목록 = [
  {
    이름: '19문항',
    시트ID: '1QDKvfEF31SDT0vN8rkwyLtcb7c6sJikLtXWICqrpUEY',
    탭GID: null,          // null 이면 첫 번째 탭
    키접두: '',           // ← 기존 처리 기록과 맞춰야 한다. 비우고 둔다
    항목: {
      타임스탬프:     '타임스탬프',
      브랜드명:       '브랜드명',
      담당자:         '성함',
      링크:           '플레이스',
      홍보제품:       '홍보할 제품',
      제공혜택:       '제공되는 제품',
      진행방식:       '배송형',
      브랜드소개:     '소개를 작성',
      강조포인트:     '강조하고 싶은',
      캠페인목적:     '가장 중요한 목적',
      콘텐츠스타일:   '콘텐츠 스타일',
      분위기:         '전체적인 분위기',
      필수장면:       '포함되어야 하는 장면',
      게시글필수항목: '게시글에 반드시',
      사람태그:       '사람태그',
      레퍼런스링크:   '참고하고 싶은',
      일정:           '방문/발송 일정',
      업로드시점:     '반드시 업로드',
      금지사항:       '사용하면 안 되는',
      '2차활용':      '2차 활용이 필요'
    }
  },
  {
    이름: '16문항',
    시트ID: '1x0GbiWFaWXYGLqb44p-QVBN2_oN78Oz9dBG9jslWzR8',
    탭GID: 1368813095,    // 이 시트는 gid 0 이 없다. 첫 탭이 1368813095 다
    키접두: '16문항|',
    항목: {
      타임스탬프:     '타임스탬프',
      // 한 칸에 브랜드명·성함·연락처가 `/` 로 붙어 온다. 조각으로 나눈다.
      // 예) 어반캠핑 인디언바베큐/김동욱/010-0000-0000
      브랜드명:       { 머리글: '브랜드명', 구분: '/', 조각: 0 },
      담당자:         { 머리글: '브랜드명', 구분: '/', 조각: 1, 나머지: true },
      링크:           '홈페이지 / 구매 링크',
      홍보제품:       '주요 촬영 제품',
      브랜드소개:     '브랜드 소개',
      캠페인목적:     '이번 미션 핵심',
      콘텐츠스타일:   '콘텐츠 방향',
      필수장면:       '콘텐츠 필수 포인트',
      영상길이:       '영상 길이',
      레퍼런스링크:   '제작 레퍼런스',
      일정:           '진행 및 방문 일정',
      콘텐츠제출일:   '콘텐츠 제출일',
      인사이트기한:   '인사이트 제출 기한',
      게시글필수항목: '게시글 필수 포함',
      사람태그:       '사람(계정) 태그',
      필수해시태그:   '장소 태그'
    }
  }
];

// ═══ 체험단 폼 (3-0) ═══════════════════════════════════════
//
// ★ 체험단 폼은 어디에도 연결돼 있지 않았다.
//   접수가 와도 메일도 없고 시트에도 안 들어갔다. 사람이 직접 열어 봐야 알았다.
//   기획형(5-0)만 자동이고 체험단은 비어 있었다. (2026-09-18 붙임)
//
// ★ 기획형과 파이프라인이 다르다.
//   기획형은 [초안] 구글 문서까지 만들지만, 체험단은 **알림과 적재까지만** 한다.
//   3-1 가이드는 업체를 조사해 채워야 해서 초안을 만들 수 없다.
//
// ★ B폼은 한 문항에 여러 정보가 묶여 온다 (브랜드명+담당자+연락처가 한 칸).
//   기계로 쪼개면 틀린다. 쪼개지 않고 원문 그대로 싣고, 사람이 3-1 만들 때 정리한다.

var 체험단폼목록 = [
  {
    이름: 'A폼(12문항)',
    시트ID: '1RFzR8NJ6a2GeYsRiu7AVOm7nVdPL2Xx-J74BFt7K5ug',
    탭GID: null,
    키접두: '체험A|',
    묶음폼: false,
    항목: {
      타임스탬프:   '타임스탬프',
      브랜드명:     '브랜드 명 또는 매장 명',
      담당자:       '성함 / 연락처',
      모집인원:     '체험단 요청 인원',
      캠페인형태:   '캠페인 형태',
      콘텐츠형태:   '제작 콘텐츠 형태',
      모집마감:     '최대 모집 기간',
      체험기간:     '방문 또는 체험 가능 기간',
      체험시간:     '방문 및 체험 가능 시간',
      제공내역:     '제공 상품 및 가격',
      핵심내용:     '반드시 소개해야 하는 핵심 내용',
      필수장면:     '반드시 촬영해야 하는 장면',
      사람태그:     '브랜드 공식 인스타그램 계정'
    }
  },
  {
    이름: 'B폼(8문항)',
    시트ID: '1ijErOco1VbWAdgBFFpWiyePbeW9720SIkVip4Q4P3e8',
    탭GID: null,
    키접두: '체험B|',
    묶음폼: true,                    // 한 칸에 여러 정보가 묶여 온다
    항목: {
      타임스탬프:   '타임스탬프',
      브랜드명:     '브랜드명과 담당자 정보',      // 담당자·연락처가 함께 들어 있다
      모집인원:     '진행을 원하는 체험단 정보',    // 인원·채널이 함께
      체험기간:     '체험 또는 방문 가능 기간',     // 기간·주소가 함께
      제공내역:     '제공되는 내용',
      핵심내용:     '홍보하고 싶은 내용',
      필수장면:     '포함했으면 하는 촬영 장면',
      사람태그:     '공식 인스타그램 계정',
      추가전달:     '추가로 꼭 전달해야 하는 내용'
    }
  }
];

// 체험단 응답을 모아 두는 탭. 기획형 응답 탭과 같은 자리에 둔다.
var 체험단응답탭 = '체험단 응답';

// 가이드에 들어가야 하는 전체 항목.
// 폼에 문항 자체가 없으면 여기서 채워 「작성 필요」로 남긴다. 조용히 빠지면 안 된다.
var 전체항목 = ['링크', '홍보제품', '제공혜택', '진행방식', '브랜드소개', '강조포인트',
                '캠페인목적', '콘텐츠스타일', '분위기', '필수장면', '게시글필수항목',
                '사람태그', '레퍼런스링크', '일정', '업로드시점', '금지사항',
                '2차활용', '필수해시태그'];

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

  // ★ 폼마다 하나씩 건다. 하나만 걸면 나머지 폼 접수는 조용히 묻힌다.
  //   (실제로 16문항 폼 접수가 통째로 묻혔다. 10분 트리거는 성실히 돌고 있었지만
  //    보는 시트가 19문항 하나뿐이었다.)
  폼목록.forEach(function (폼) {
    var ss = SpreadsheetApp.openById(폼.시트ID);
    ScriptApp.newTrigger('새응답처리').forSpreadsheet(ss).onFormSubmit().create();
    Logger.log('폼 제출 트리거: ' + 폼.이름);
  });

  // 폼이 아닌 경로(아임웹 연동 등)로 행이 늘어난 경우를 위한 보완.
  // onFormSubmit 은 실제 폼 제출에만 걸리므로 이것 없이는 놓친다.
  ScriptApp.newTrigger('놓친행확인').timeBased().everyMinutes(10).create();

  Logger.log('트리거 ' + (폼목록.length + 1) + '개 설치 완료 (폼 제출 ' +
             폼목록.length + '개 / 10분 주기 1개)');
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

/** 폼 제출 트리거. e.source 로 어느 폼인지, e.range 로 어느 행인지 알 수 있다. */
function 새응답처리(e) {
  var 폼 = null;
  if (e && e.source) {
    var id = e.source.getId();
    폼목록.forEach(function (f) { if (f.시트ID === id) 폼 = f; });
  }
  // 어느 폼인지 모르면 전부 훑는다. 놓치는 것보다 낫다.
  if (!폼) { 놓친행확인(); return; }
  var 행번호 = (e && e.range) ? e.range.getRow() : 시트(폼).getLastRow();
  처리(폼, 행번호);
}

/** 10분 주기. 모든 폼에서 아직 처리하지 않은 행을 훑는다. */
function 놓친행확인() {
  폼목록.forEach(function (폼) {
    var sh;
    try { sh = 시트(폼); }
    catch (err) { Logger.log(폼.이름 + ' 시트를 못 열었습니다: ' + err); return; }
    var 끝 = sh.getLastRow();
    for (var r = 2; r <= 끝; r++) 처리(폼, r);
  });

  // 체험단 폼도 같은 주기로 본다. 트리거를 따로 걸면 하나가 빠지기 쉽다.
  try { 체험단_새접수확인(); }
  catch (e) { Logger.log('체험단 접수 확인 실패: ' + e); }
}

// ═══════════════════════════════════════════════════════════
// 체험단 폼 — 감지 · 알림 · 적재
// ═══════════════════════════════════════════════════════════

/** 10분 주기. 체험단 폼에 새로 들어온 접수를 찾아 알리고 시트에 싣는다. */
function 체험단_새접수확인() {
  var 새것 = [];

  체험단폼목록.forEach(function (폼) {
    var sh;
    try { sh = 시트(폼); }
    catch (e) { Logger.log(폼.이름 + ' 시트를 못 열었습니다: ' + e); return; }
    var 끝 = sh.getLastRow();
    if (끝 < 2) return;

    var 머리글 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    for (var r = 2; r <= 끝; r++) {
      var 값들 = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
      var 브랜드raw = 칸읽기(값들, 머리글, 폼.항목.브랜드명);
      if (브랜드raw === '') continue;

      var 키 = 처리키(폼, r, 브랜드raw);
      if (이미처리(키)) continue;

      var d = { 폼: 폼.이름, 묶음폼: !!폼.묶음폼, 행: r, 항목: {} };
      for (var 이름 in 폼.항목) {
        if (이름 === '타임스탬프') continue;
        d.항목[이름] = 칸읽기(값들, 머리글, 폼.항목[이름]);
      }
      d.접수일 = 날짜문자(칸원본(값들, 머리글, 폼.항목.타임스탬프));
      d.브랜드 = 브랜드raw;
      새것.push(d);
      처리기록(키);
    }
  });

  if (!새것.length) { Logger.log('체험단 신규 접수 없음'); return { 성공: true, 신규: 0 }; }

  try { 체험단_응답미러(); } catch (e) { Logger.log('체험단 응답 미러 실패: ' + e); }
  체험단_알림(새것);
  Logger.log('체험단 신규 ' + 새것.length + '건 처리');
  return { 성공: true, 신규: 새것.length,
           브랜드: 새것.map(function (x) { return x.브랜드; }) };
}

/** 체험단 폼 응답을 통합 워크북의 «체험단 응답» 탭 하나로 모은다. */
function 체험단_응답미러() {
  if (typeof 통합시트_ID === 'undefined') { Logger.log('통합관리.gs 가 없습니다.'); return 0; }

  var 열 = ['접수일', '폼', '브랜드명', '담당자', '모집인원', '캠페인형태', '콘텐츠형태',
            '모집마감', '체험기간', '체험시간', '제공내역', '핵심내용', '필수장면',
            '사람태그', '추가전달'];
  var 줄들 = [];

  체험단폼목록.forEach(function (폼) {
    var sh;
    try { sh = 시트(폼); } catch (e) { return; }
    var 끝 = sh.getLastRow();
    if (끝 < 2) return;
    var 머리글 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var 값 = sh.getRange(2, 1, 끝 - 1, sh.getLastColumn()).getValues();
    값.forEach(function (행) {
      var b = 칸읽기(행, 머리글, 폼.항목.브랜드명);
      if (b === '') return;
      줄들.push(열.map(function (k) {
        if (k === '폼') return 폼.이름;
        if (k === '접수일') return 날짜문자(칸원본(행, 머리글, 폼.항목.타임스탬프));
        return 칸읽기(행, 머리글, 폼.항목[k]);
      }));
    });
  });

  var ss = SpreadsheetApp.openById(통합시트_ID);
  var sh2 = 탭확보(ss, 체험단응답탭);
  sh2.clear();
  sh2.getRange(1, 1, 1, 열.length).setValues([열])
     .setFontWeight('bold').setBackground('#F2F4F8');
  if (줄들.length) sh2.getRange(2, 1, 줄들.length, 열.length).setValues(줄들);
  sh2.setFrozenRows(1);
  sh2.setFrozenColumns(3);
  Logger.log('  ' + 체험단응답탭 + ': ' + 줄들.length + '건');
  return 줄들.length;
}

/** 체험단 신규 접수를 메일로 알린다. */
function 체험단_알림(새것) {
  var 주소 = PropertiesService.getScriptProperties().getProperty('알림주소');
  if (!주소) { Logger.log('알림주소가 없어 메일을 못 보냅니다.'); return; }

  var 제목 = '[포포몬비즈] 체험단 신규 접수 ' + 새것.length + '건 — '
           + 새것.map(function (d) { return 첫조각(d.브랜드); }).join(', ');

  var 줄 = ['체험단 양식폼에 새 접수가 들어왔습니다.', ''];
  새것.forEach(function (d, i) {
    줄.push((i + 1) + '. ' + 첫조각(d.브랜드) + '   [' + d.폼 + ' ' + d.행 + '행]');
    줄.push('   접수일 : ' + d.접수일);
    ['담당자', '모집인원', '캠페인형태', '콘텐츠형태', '체험기간', '제공내역'].forEach(function (k) {
      var v = d.항목[k];
      if (v) 줄.push('   ' + k + ' : ' + String(v).replace(/\n/g, ' / ').substring(0, 160));
    });
    if (d.묶음폼) {
      줄.push('   ※ B폼은 한 칸에 여러 정보가 묶여 옵니다. 3-1 만들 때 사람이 나눠야 합니다.');
    }
    줄.push('');
  });
  줄.push('체험단 응답 탭');
  줄.push('https://docs.google.com/spreadsheets/d/' + 통합시트_ID + '/edit');
  줄.push('');
  줄.push('다음 단계: 클로드에게 「3-1 ' + 첫조각(새것[0].브랜드) + '」 라고 지시하세요.');
  줄.push('(어느 채널로 만들지 — 블로그 / 인스타 / 릴스 — 물어봅니다)');

  try { MailApp.sendEmail({ to: 주소, subject: 제목, body: 줄.join('\n') }); Logger.log('체험단 알림 발송: ' + 주소); }
  catch (e) { Logger.log('메일 실패: ' + e); }
}

/** 「브랜드명, 담당자, 연락처」 처럼 묶여 온 값에서 앞부분만. 제목용이다. */
function 첫조각(v) {
  var s = String(v || '').split('\n')[0];
  s = s.split(/[,/]/)[0];
  return s.replace(/^\s+|\s+$/g, '') || '(브랜드명 미상)';
}

/** 각 폼의 마지막 행을 강제로 다시 처리한다. 확인용. */
function 시험_마지막행처리() {
  폼목록.forEach(function (폼) {
    var sh = 시트(폼);
    var r = sh.getLastRow();
    if (r < 2) return;
    var 머리글 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var 값들 = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
    var 브랜드 = 칸읽기(값들, 머리글, 폼.항목.브랜드명);
    처리목록삭제(처리키(폼, r, 브랜드));   // 이미 처리했더라도 다시 하도록
    처리(폼, r);
  });
}

/**
 * 브랜드 하나를 다시 처리한다. 잘못 만들어진 초안을 고칠 때 쓴다.
 *
 * 처리 기록을 지우고 다시 돌리므로 초안 문서·메일이 새로 만들어진다.
 * 완성본이 있는 브랜드는 여전히 건너뛴다. 사람 작업을 덮지 않는다.
 */
function 브랜드재처리(브랜드명) {
  브랜드명 = String(브랜드명 || '').trim();
  if (브랜드명 === '') return { 성공: false, 오류: '브랜드명이 비어 있습니다.' };

  var 찾음 = [];
  폼목록.forEach(function (폼) {
    var sh;
    try { sh = 시트(폼); } catch (e) { return; }
    var 끝 = sh.getLastRow();
    if (끝 < 2) return;
    var 머리글 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    for (var r = 2; r <= 끝; r++) {
      var 값들 = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
      var b = 칸읽기(값들, 머리글, 폼.항목.브랜드명);
      if (b !== 브랜드명) continue;
      처리목록삭제(처리키(폼, r, b));
      처리(폼, r);
      찾음.push(폼.이름 + ' ' + r + '행');
    }
  });

  if (!찾음.length) return { 성공: false, 오류: '어느 폼에도 없습니다: ' + 브랜드명 };
  Logger.log('재처리: ' + 브랜드명 + ' (' + 찾음.join(', ') + ')');
  return { 성공: true, 브랜드: 브랜드명, 처리: 찾음 };
}

/** 폼 설정이 맞는지 확인한다. 머리글을 못 찾는 항목이 있으면 알려준다. */
function 시험_폼확인() {
  폼목록.forEach(function (폼) {
    Logger.log('── ' + 폼.이름 + ' ──');
    var sh;
    try { sh = 시트(폼); }
    catch (err) { Logger.log('  시트를 못 열었습니다: ' + err); return; }
    var 머리글 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    Logger.log('  탭 «' + sh.getName() + '» / 열 ' + 머리글.length +
               '개 / 응답 ' + Math.max(0, sh.getLastRow() - 1) + '건');
    var 못찾음 = [];
    for (var 이름 in 폼.항목) {
      var 규칙 = 폼.항목[이름];
      var 키워드 = (typeof 규칙 === 'string') ? 규칙 : 규칙.머리글;
      if (열찾기(머리글, 키워드) < 0) 못찾음.push(이름 + ' («' + 키워드 + '»)');
    }
    if (못찾음.length) {
      Logger.log('  ❗머리글을 못 찾은 항목: ' + 못찾음.join(', '));
      Logger.log('    → 폼 문항이 바뀌었을 수 있습니다. 폼목록 의 키워드를 고치세요.');
    } else {
      Logger.log('  ✅ 모든 항목을 찾았습니다');
    }
    전체항목.forEach(function (k) {
      if (!폼.항목[k]) Logger.log('  · ' + k + ' — 이 폼에는 문항이 없습니다 (작성 필요로 남음)');
    });
  });
}

// ═══════════════════════════════════════════════════════════
// 처리
// ═══════════════════════════════════════════════════════════

function 처리(폼, 행번호) {
  if (행번호 < 2) return;

  var sh = 시트(폼);
  var 머리글 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var 값들 = sh.getRange(행번호, 1, 1, sh.getLastColumn()).getValues()[0];
  var 브랜드 = 칸읽기(값들, 머리글, 폼.항목.브랜드명);
  if (브랜드 === '') return;

  var 키 = 처리키(폼, 행번호, 브랜드);
  if (이미처리(키)) return;

  var d = 데이터만들기(값들, 머리글, 폼);

  // ★ 완성본이 이미 있으면 아무것도 하지 않는다.
  //   사람이 조사해서 채운 문서를 초안이 덮으면 그 작업이 통째로 날아간다.
  //   (실제로 그렇게 날아간 적이 있다. 10분 트리거가 기존 행을 훑으면서
  //    완성본 5개를 휴지통에 넣고 [초안] 으로 갈아치웠다.)
  var 폴더 = 폴더확보(폴더명);
  if (완성본있나(폴더, 브랜드)) {
    처리기록(키);                        // 다시 훑지 않도록 처리한 것으로 표시만 한다
    Logger.log('완성본이 있어 건너뜀: ' + 브랜드);
    return;
  }

  // 1) 구글 문서 초안
  var 문서url = '';
  try {
    var 문서명 = 초안접두 + d.날짜 + ' ' + 브랜드 + 문서접미;
    // ★ 내가 만든 [초안] 만 치운다. 완성본은 절대 건드리지 않는다.
    내초안문서(폴더, 브랜드).forEach(function (f) { f.setTrashed(true); });
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
  Logger.log('처리 완료: ' + 폼.이름 + ' ' + 브랜드 + ' (' + 행번호 + '행)');
}

// ═══════════════════════════════════════════════════════════
// 문서 안전장치 · 복구
// ═══════════════════════════════════════════════════════════

/** 이 브랜드의 완성본(=[초안] 이 아닌 문서)이 있나. 있으면 초안을 만들지 않는다. */
function 완성본있나(폴더, 브랜드) {
  var 목록 = 같은브랜드문서(폴더, 브랜드);
  for (var i = 0; i < 목록.length; i++) {
    if (목록[i].getName().indexOf(초안접두) !== 0) return true;
  }
  return false;
}

/** 이 브랜드의 [초안] 문서만 고른다. 완성본은 빼고 돌려준다. */
function 내초안문서(폴더, 브랜드) {
  return 같은브랜드문서(폴더, 브랜드).filter(function (f) {
    return f.getName().indexOf(초안접두) === 0;
  });
}

/**
 * 휴지통에 들어간 완성본을 되살린다.
 *
 * ★ 왜 필요한가
 *   예전 코드가 완성본·초안을 가리지 않고 휴지통에 넣고 [초안] 으로 갈아치웠다.
 *   구글 드라이브 휴지통은 30일간 보관하므로 그 안에는 되살릴 수 있다.
 *
 * ★ 하는 일
 *   1) 휴지통에서 「… 콘텐츠 제작 가이드」 로 끝나는 문서를 찾는다
 *   2) [초안] 이 아닌 것만 되살린다
 *   3) 되살린 브랜드의 [초안] 은 휴지통으로 보낸다 (완성본이 정본이다)
 *
 * ★ 먼저 [복구_미리보기] 로 무엇이 되살아날지 확인하고 실행한다.
 */
function 복구_미리보기() { return 복구실행(true); }
function 복구_삭제된완성본() { return 복구실행(false); }

function 복구실행(미리보기) {
  var 폴더 = 폴더확보(폴더명);
  var 되살림 = [], 치운초안 = [];

  // 휴지통은 폴더 목록에 안 나온다. 검색으로 찾아야 한다.
  var it = DriveApp.searchFiles('trashed = true and title contains "' + 문서접미.replace(/^\s+/, '') + '"');
  while (it.hasNext()) {
    var f = it.next();
    var n = f.getName();
    if (n.slice(-문서접미.length) !== 문서접미) continue;   // 이름 끝이 정확히 맞아야 한다
    if (n.indexOf(초안접두) === 0) continue;                // 초안은 되살리지 않는다
    되살림.push(n);
    if (!미리보기) { f.setTrashed(false); 폴더.addFile(f); }
  }

  // 되살린 브랜드의 초안은 치운다. 완성본과 초안이 같이 있으면 헷갈린다.
  if (!미리보기) {
    var it2 = 폴더.getFiles();
    while (it2.hasNext()) {
      var g = it2.next();
      var gn = g.getName();
      if (gn.indexOf(초안접두) !== 0) continue;
      var 몸통 = gn.slice(초안접두.length);
      var 겹침 = 되살림.some(function (r) {
        // 날짜가 달라도 「<브랜드> 콘텐츠 제작 가이드」 부분이 같으면 같은 건이다
        return r.slice(-문서접미.length) === 몸통.slice(-문서접미.length) &&
               꼬리브랜드(r) === 꼬리브랜드(몸통);
      });
      if (겹침) { g.setTrashed(true); 치운초안.push(gn); }
    }
  }

  Logger.log((미리보기 ? '[미리보기] ' : '') + '되살릴 완성본 ' + 되살림.length + '개');
  되살림.forEach(function (n) { Logger.log('  ↩ ' + n); });
  if (치운초안.length) {
    Logger.log('치운 초안 ' + 치운초안.length + '개');
    치운초안.forEach(function (n) { Logger.log('  🗑 ' + n); });
  }
  if (미리보기) Logger.log('실제로 되살리려면 [복구_삭제된완성본] 을 실행하세요.');
  return { 되살림: 되살림, 치운초안: 치운초안 };
}

/** 「2026-09-15 비엘르 카페 콘텐츠 제작 가이드」 → 「비엘르 카페」 */
function 꼬리브랜드(이름) {
  var s = 이름.slice(0, 이름.length - 문서접미.length);
  return s.replace(/^\s*\d{4}[-.\s]\s*\d{1,2}[-.\s]\s*\d{1,2}\s*/, '').replace(/^\s+|\s+$/g, '');
}

/**
 * 응답 한 행 → 구글문서생성.gs 가 쓰는 데이터 모양으로.
 * 광고주가 적은 것은 구분 '원문', 비워 낸 것은 '제안' + 미작성표시 로 둔다.
 * 그래야 문서에 빨간 글씨로 「작성 필요」 가 보인다.
 */
function 데이터만들기(값들, 머리글, 폼) {
  var 항목 = {};

  // 1) 이 폼이 물어본 항목
  for (var 이름 in 폼.항목) {
    if (이름 === '타임스탬프' || 이름 === '브랜드명' || 이름 === '담당자') continue;
    var v = 칸읽기(값들, 머리글, 폼.항목[이름]);
    항목[이름] = 비었나(v)
      ? { 구분: '제안', 원문: '', 보완: 미작성표시 }
      : { 구분: '원문', 원문: v, 보완: '' };
  }

  // 2) 이 폼에 문항이 아예 없는 항목 — 조용히 빠지면 안 되므로 「작성 필요」로 남긴다
  전체항목.forEach(function (k) {
    if (!항목[k]) 항목[k] = { 구분: '제안', 원문: '', 보완: 미작성표시 };
  });

  // 3) 공통 기본값 — **광고주가 적어 낸 값은 덮지 않는다.**
  //    16문항 폼은 영상길이·콘텐츠제출일·인사이트기한을 직접 물어본다.
  //    무조건 덮어쓰면 광고주가 「1분내외」라고 적어 낸 것이 기본값으로 바뀐다.
  for (var k2 in 공통기본값) {
    var 이미 = 항목[k2];
    if (이미 && 이미.구분 === '원문') continue;      // 광고주 원문 보존
    항목[k2] = { 구분: '제안', 원문: '', 보완: 공통기본값[k2] };
  }

  // 기본 제작 안내는 양식(가이드_양식.html)이 기준이지만, 초안 단계에서는
  // 로컬 파일을 읽을 수 없으므로 구글문서생성.gs 의 대비값이 쓰인다.

  // ★ 타임스탬프는 **글자로 바꾸지 말고 날짜 값 그대로** 넘긴다.
  //   String(Date) 는 「Thu Sep 17 2026 07:08:19 …」 가 되고,
  //   날짜문자() 가 거기서 앞 숫자 셋을 집어 2026-07-08 로 읽는다. 시:분을 월·일로 본다.
  //   실제로 인디언 접수일이 9월 17일인데 7월 8일로 기록됐다.
  var 시각 = 칸원본(값들, 머리글, 폼.항목.타임스탬프);
  return {
    브랜드: 칸읽기(값들, 머리글, 폼.항목.브랜드명),
    담당자: 칸읽기(값들, 머리글, 폼.항목.담당자),
    접수일: 날짜문자(시각),
    날짜:   날짜문자(시각),   // 최초 작성일 = 폼 제출일. 이후 바뀌지 않는다
    폼:     폼.이름,
    항목: 항목
  };
}

// ═══════════════════════════════════════════════════════════
// 머리글로 열 찾기
// ═══════════════════════════════════════════════════════════
// 열 번호로 읽으면 폼이 바뀔 때 조용히 엉뚱한 칸을 집는다. 이름으로 찾는다.
// 머리글에는 줄바꿈과 두 칸 띄어쓰기가 섞여 있어, 공백을 다 지우고 비교한다.

function 공백뺀(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }

function 열찾기(머리글, 키워드) {
  var k = 공백뺀(키워드);
  if (k === '') return -1;
  for (var i = 0; i < 머리글.length; i++) {
    if (공백뺀(머리글[i]).indexOf(k) >= 0) return i;
  }
  return -1;
}

/**
 * 규칙에 따라 한 칸을 읽는다.
 *   '키워드'                                  → 그 열의 값 그대로
 *   { 머리글, 구분, 조각 }                     → 구분자로 나눈 뒤 그 조각
 *   { 머리글, 구분, 조각, 나머지: true }        → 그 조각부터 끝까지
 */
function 칸읽기(값들, 머리글, 규칙) {
  if (규칙 == null) return '';
  var 키워드 = (typeof 규칙 === 'string') ? 규칙 : 규칙.머리글;
  var i = 열찾기(머리글, 키워드);
  if (i < 0) return '';
  var v = 텍스트(값들[i]);
  if (typeof 규칙 === 'string' || !규칙.구분) return v;

  var 조각들 = v.split(규칙.구분);
  var 결과 = 규칙.나머지
    ? 조각들.slice(규칙.조각).join(규칙.구분)
    : (조각들[규칙.조각] || '');
  return 결과.replace(/^\s+|\s+$/g, '');
}

/**
 * 칸의 값을 **바꾸지 않고 그대로** 돌려준다.
 * 날짜처럼 형이 중요한 칸에 쓴다. 칸읽기() 는 글자로 바꿔 버려서 날짜가 망가진다.
 */
function 칸원본(값들, 머리글, 규칙) {
  if (규칙 == null) return '';
  var 키워드 = (typeof 규칙 === 'string') ? 규칙 : 규칙.머리글;
  var i = 열찾기(머리글, 키워드);
  return (i < 0) ? '' : 값들[i];
}

/** 폼의 시트(탭)를 연다. 탭GID 가 있으면 그 탭을, 없으면 첫 탭을 쓴다. */
function 시트(폼) {
  var ss = SpreadsheetApp.openById(폼.시트ID);
  if (폼.탭GID == null) return ss.getSheets()[0];
  var 목록 = ss.getSheets();
  for (var i = 0; i < 목록.length; i++) {
    if (목록[i].getSheetId() === 폼.탭GID) return 목록[i];
  }
  throw new Error(폼.이름 + ': gid ' + 폼.탭GID + ' 탭을 찾지 못했습니다.');
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

// ★ 19문항 폼은 접두가 빈 문자열이라 예전 기록(`행번호|브랜드`)과 그대로 맞는다.
//   여기 형식을 바꾸면 기존 기록을 못 알아보고 이미 보낸 알림이 전부 다시 나간다.
function 처리키(폼, 행번호, 브랜드) {
  return (폼.키접두 || '') + 행번호 + '|' + 브랜드;
}

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

/** 처리 기록에서 키 하나를 뺀다. 그 행을 다시 처리하게 된다. */
function 처리목록삭제(키) {
  var 목록 = 처리목록().filter(function (k) { return k !== 키; });
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

// 통합관리.gs 가 첫 번째 폼의 응답 시트를 미러링할 때 쓴다.
function 응답시트() { return 시트(폼목록[0]); }

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
