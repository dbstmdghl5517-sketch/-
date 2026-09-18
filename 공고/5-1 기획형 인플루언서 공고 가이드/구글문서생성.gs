/**
 * 5-1 기획형 인플루언서 공고 가이드 → 브랜드별 구글 문서 + 관리 시트 자동 생성
 *
 * ★ 이 문서의 용도
 *   광고주에게 "이렇게 제작해 인플루언서에게 요청하겠습니다" 를 확인받는 문서다.
 *   그래서 출처를 색으로 구분한다.
 *     검정 = 광고주가 제출한 원문
 *     빨강 = 포포몬비즈가 새로 기입하거나 정리한 내용
 *   정리·보완한 항목은 원문(검정)과 함께 보여 무엇이 바뀌었는지 드러낸다.
 *
 * ★ 데이터 출처
 *   응답 시트를 직접 읽지 않는다. 가이드생성.pl 이 만든 데이터를 받아 쓴다.
 *   Apps Script 는 웹 조사를 못 하므로, 빈 항목을 조사해 채우는 일은 로컬에서 끝낸다.
 *   그래야 구글 문서와 DOCX·PDF 내용이 어긋나지 않는다.
 *
 * ★ 두 가지 실행 경로
 *   (1) 웹앱  ← 평소 경로. 로컬에서 도구/시트올리기.sh 가 데이터.json 을 보낸다
 *   (2) 수동  ← 웹앱을 못 쓸 때. _작업/데이터.gs 를 붙여 넣고 [전체생성_덮어쓰기] 실행
 *
 * 만들어지는 것
 *   내 드라이브 / 기획형 인플루언서 공고 가이드 /
 *     ├ 0_가이드 관리              ← 관리용 스프레드시트 (브랜드별 문서 링크 + 보완 현황)
 *     ├ 하나돈까스 일광신도시점 콘텐츠 제작 가이드
 *     └ …                          ← 전달용 구글 문서
 *
 * ═══ 웹앱 세팅 (한 번만) ═══
 *   1) [비밀키만들기] 실행 → 로그에 찍힌 비밀키를 복사해 둔다
 *   2) 배포 → 새 배포 → 유형 「웹 앱」
 *        · 실행 계정  : 나 (사장님 계정 권한으로 문서를 만들어야 한다)
 *        · 액세스 권한: 모든 사용자
 *          ↳ 주소를 아는 사람만 부를 수 있고, 비밀키가 틀리면 아무것도 하지 않는다
 *   3) 배포 URL(…/exec)과 비밀키를 로컬 연동/.env 에 넣는다
 *        공고가이드_웹앱=https://script.google.com/macros/s/…/exec
 *        공고가이드_비밀키=1단계에서 복사한 값
 *   4) 로컬에서 bash 도구/시트올리기.sh
 *
 *   ※ 코드를 고치면 반드시 「배포 관리 → 편집 → 새 버전」 으로 다시 배포해야 반영된다.
 *      새 배포를 만들면 URL 이 바뀌므로 .env 도 같이 고친다.
 */

// ═══════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════

var 폴더명    = '기획형 인플루언서 공고 가이드';
var 관리시트명 = '0_가이드 관리';
var 문서접미  = ' 콘텐츠 제작 가이드';

var 비밀키_속성 = '공고가이드_비밀키';

var 빨강 = '#d40000';
var 검정 = '#222222';
var 남색 = '#1F3864';

// 모든 캠페인 공통 「기본 제작 안내」 는 가이드_양식.html 에서 뽑아 데이터로 넘어온다.
// 문구를 고쳐도 이 스크립트를 다시 배포할 필요가 없다.
// 아래는 데이터에 안내가 없을 때만 쓰는 대비값이다. 양식이 유일한 기준이다.
var 기본제작안내_대비 = [
  '영상 시작 1~3초 안에 눈길을 끌 수 있는 장면을 넣어 주시면 좋습니다.',
  '자막이나 목소리 설명을 넣어 내용이 자연스럽게 전달되도록 만들어 주세요.',
  '업로드 전에 완성된 영상과 게시글 초안을 먼저 보내 주세요.',
  '담당자 확인을 받은 뒤 업로드해 주세요.',
  '음악은 인스타그램에서 제공하는 음원이나 저작권 문제가 없는 음원을 써 주세요.',
  '같은 업종의 다른 브랜드가 영상에 보이지 않도록 조심해 주세요.'
];

// ═══════════════════════════════════════════════════════════
// 웹앱 세팅
// ═══════════════════════════════════════════════════════════

/** 한 번만 실행한다. 로그에 찍힌 값을 연동/.env 의 공고가이드_비밀키 에 넣는다. */
function 비밀키만들기() {
  var 키 = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(비밀키_속성, 키);
  Logger.log('공고가이드_비밀키=' + 키);
  Logger.log('\n이 값을 연동/.env 에 넣으세요. 저장소에 커밋하면 안 됩니다.');
}

function 비밀키보기() {
  var 키 = PropertiesService.getScriptProperties().getProperty(비밀키_속성);
  Logger.log(키 ? ('공고가이드_비밀키=' + 키) : '비밀키가 없습니다. [비밀키만들기] 를 먼저 실행하세요.');
}

// ═══════════════════════════════════════════════════════════
// 진입점
// ═══════════════════════════════════════════════════════════

/** 웹앱 — 로컬 도구/시트올리기.sh 가 부른다. */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return 응답({ 성공: false, 오류: '본문이 없습니다.' });
    }
    var 본문 = JSON.parse(e.postData.contents);

    var 기대 = PropertiesService.getScriptProperties().getProperty(비밀키_속성);
    if (!기대)                      return 응답({ 성공: false, 오류: '비밀키 미설정. [비밀키만들기] 를 실행하세요.' });
    if (본문.비밀키 !== 기대)        return 응답({ 성공: false, 오류: '비밀키 불일치' });

    // 시트 읽기 — 시트를 비공개로 바꾼 뒤 로컬에서 내용을 확인할 길이 이것뿐이다.
    // 쓰지 않고 읽기만 한다. 비밀키를 아는 쪽만 호출할 수 있다.
    if (본문.동작 === '시트읽기') {
      return 응답(시트읽기(본문.시트, 본문.탭, 본문.최대));
    }

    // 체험단 폼 신규 접수 확인을 지금 돌린다.
    if (본문.동작 === '체험단확인') {
      if (typeof 체험단_새접수확인 !== 'function') {
        return 응답({ 성공: false, 오류: '자동알림.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(체험단_새접수확인());
    }

    // 노션 DB 를 비우고 처음부터 다시 만든다. 열쇠 규칙이 바뀐 경우.
    if (본문.동작 === '노션전부지우기') {
      if (typeof 노션_전부지우고다시 !== 'function') {
        return 응답({ 성공: false, 오류: '노션동기화.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(노션_전부지우고다시());
    }

    // 노션 기록 초기화 — 쓰는 쪽 코드를 고쳐 기록이 어긋났을 때만.
    if (본문.동작 === '노션기록초기화') {
      if (typeof 노션기록_값만초기화 !== 'function') {
        return 응답({ 성공: false, 오류: '노션동기화.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(노션기록_값만초기화());
    }

    // 노션 동기화. 미리보기로 무엇이 바뀔지 먼저 볼 수 있다.
    if (본문.동작 === '노션동기화') {
      if (typeof 노션동기화실행 !== 'function') {
        return 응답({ 성공: false, 오류: '노션동기화.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(노션동기화실행(본문.미리보기 === true));
    }

    // 매시간 점검을 지금 돌린다.
    if (본문.동작 === '점검') {
      if (typeof 점검 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(점검());
    }

    // 트리거 설치·정리. 웹앱에서 직접 걸 수 있다는 것을 확인하고 열었다.
    // 전에는 사용자가 편집기에서 눌러야 했다.
    if (본문.동작 === '트리거정리') {
      var 원함 = {
        '점검':     { 종류: '시간', 매시간: 1 },
        '전체갱신': { 종류: '시간', 매시간: 1 },
        '상태정리': { 종류: '매일', 시각: 6 },
        '노션동기화': { 종류: '시간', 매시간: 1 }
      };
      if (typeof 단계3_시트에적재 === 'function') 원함['단계3_시트에적재'] = { 종류: '시간', 매시간: 1 };

      var 있음 = {};
      ScriptApp.getProjectTriggers().forEach(function (t) {
        var f = t.getHandlerFunction();
        있음[f] = (있음[f] || 0) + 1;
      });

      var 만듦 = [], 이미 = [];
      for (var f in 원함) {
        if (있음[f]) { 이미.push(f + ' ×' + 있음[f]); continue; }
        var spec = 원함[f];
        if (spec.종류 === '시간') ScriptApp.newTrigger(f).timeBased().everyHours(spec.매시간).create();
        else                      ScriptApp.newTrigger(f).timeBased().everyDays(1).atHour(spec.시각).create();
        만듦.push(f);
      }
      return 응답({ 성공: true, 만듦: 만듦, 이미있음: 이미 });
    }

    // 시험 — 로그인 없이 토큰을 받을 수 있는 방식이 있는지 두드려 본다.
    if (본문.동작 === '아임웹토큰시도') {
      var pp = PropertiesService.getScriptProperties();
      var 결과 = [];
      ['client_credentials', 'clientCredentials'].forEach(function (g) {
        try {
          var r = UrlFetchApp.fetch('https://openapi.imweb.me/oauth2/token', {
            method: 'post', contentType: 'application/x-www-form-urlencoded',
            payload: { grantType: g,
                       clientId: pp.getProperty('IMWEB_CLIENT_ID'),
                       clientSecret: pp.getProperty('IMWEB_CLIENT_SECRET') },
            muteHttpExceptions: true
          });
          결과.push({ 방식: g, 코드: r.getResponseCode(),
                      응답: r.getContentText().substring(0, 200) });
        } catch (e) { 결과.push({ 방식: g, 오류: String(e) }); }
      });
      return 응답({ 성공: true, 시도: 결과 });
    }

    // 시험 — 웹앱에서 트리거를 직접 걸 수 있는지 확인한다.
    if (본문.동작 === '트리거시험') {
      try {
        var t = ScriptApp.newTrigger('전체갱신').timeBased().everyHours(6).create();
        var id = t.getUniqueId();
        ScriptApp.getProjectTriggers().forEach(function (x) {
          if (x.getUniqueId() === id) ScriptApp.deleteTrigger(x);   // 바로 치운다. 시험일 뿐이다
        });
        return 응답({ 성공: true, 결과: '웹앱에서 트리거를 걸 수 있습니다.' });
      } catch (e) {
        return 응답({ 성공: false, 오류: String(e) });
      }
    }

    // 아임웹 문의 적재를 지금 돌리고, 막히면 어디서 막히는지 그대로 돌려준다.
    // ★ 「안 들어왔다」를 추측으로 답하지 않기 위해 만든 것이다.
    if (본문.동작 === '아임웹점검') {
      var p = PropertiesService.getScriptProperties();
      // ★ 값이 「있는지」만 보면 안 된다. 자리표시자(`여기에_…`)가 저장돼 있어도
      //   있는 것으로 보여 진짜 원인을 놓친다. 실제로 그렇게 헛다리를 짚었다.
      var 값보기 = function (k) {
        var v = p.getProperty(k);
        if (!v) return '(없음)';
        if (v.indexOf('여기에') === 0) return '❗자리표시자 그대로: ' + v;
        return '설정됨 (' + v.length + '자, 앞 4자 ' + v.substring(0, 4) + '…)';
      };
      var 진단 = {
        함수있음:      (typeof 단계3_시트에적재 === 'function'),
        CLIENT_ID:     값보기('IMWEB_CLIENT_ID'),
        CLIENT_SECRET: 값보기('IMWEB_CLIENT_SECRET'),
        리프레시토큰:   값보기('IMWEB_REFRESH_TOKEN')
      };
      if (!진단.함수있음) {
        return 응답({ 성공: false, 오류: '단계3_시트에적재 함수가 프로젝트에 없습니다.', 진단: 진단 });
      }
      if (본문.실행 !== true) return 응답({ 성공: true, 진단: 진단, 안내: '실행:true 로 보내면 실제로 돌립니다.' });
      try {
        단계3_시트에적재();
        return 응답({ 성공: true, 진단: 진단, 결과: '실행 완료' });
      } catch (e) {
        return 응답({ 성공: false, 진단: 진단, 오류: String(e) });
      }
    }

    // 견적서 한 건 기록. PDF 를 드라이브에 올리고 견적 이력·광고주 관리에 쓴다.
    if (본문.동작 === '견적기록') {
      if (typeof 견적기록 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(견적기록(본문.견적 || {}));
    }

    // 1시간 주기 갱신을 지금 돌린다. 폼 응답 미러 + 문의 탭 반영.
    if (본문.동작 === '전체갱신') {
      if (typeof 응답미러 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      var n1 = 응답미러();
      var n2 = (typeof 문의탭반영 === 'function') ? 문의탭반영() : 0;
      return 응답({ 성공: true, 응답행: n1, 반영업체: n2 });
    }

    // 스크립트 속성 저장. 노션 토큰처럼 코드에 적으면 안 되는 값을 넣는다.
    // ★ 토큰을 .gs 에 적으면 저장소에 올라간다. 반드시 속성으로만 둔다.
    if (본문.동작 === '설정저장') {
      var 설정 = 본문.설정 || {};
      var 넣음 = [];
      for (var k in 설정) {
        PropertiesService.getScriptProperties().setProperty(k, String(설정[k]));
        넣음.push(k);
      }
      return 응답({ 성공: true, 저장: 넣음 });
    }

    // 5-1 가이드를 구글 문서로 만든다. 데이터.json 을 그대로 넘긴다.
    // 전에는 데이터.gs 를 편집기에 붙여넣고 [실행] 을 눌러야 했다.
    // 붙여넣기 단계에서 사고가 반복돼 웹앱으로 부를 수 있게 열어 둔다.
    if (본문.동작 === '가이드문서') {
      var 데이터 = 본문.데이터;
      if (!데이터 || !데이터.length) {
        return 응답({ 성공: false, 오류: '데이터가 비어 있습니다.' });
      }
      return 응답(실행코어(데이터, 본문.덮어쓰기 !== false));
    }

    // 폼 접수 한 건을 다시 처리한다. 잘못 만들어진 초안을 고칠 때.
    if (본문.동작 === '재처리') {
      if (typeof 브랜드재처리 !== 'function') {
        return 응답({ 성공: false, 오류: '자동알림.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(브랜드재처리(본문.브랜드));
    }

    // 발행 이력에서 잘못 쌓인 줄을 지운다. 미리보기로 먼저 확인할 수 있다.
    if (본문.동작 === '이력정리') {
      if (typeof 이력정리 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(이력정리(본문.미리보기 === true));
    }

    // 상태 정리를 지금 돌린다. 매일 오전 6시 트리거와 같은 일을 한다.
    // 미리보기로 넘기면 아무것도 바꾸지 않고 무엇이 옮겨질지만 돌려준다.
    if (본문.동작 === '상태정리') {
      if (typeof 상태정리실행 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      var r = 상태정리실행(본문.미리보기 === true);
      r.미리보기 = (본문.미리보기 === true);
      return 응답(r);
    }

    // 자동화 현황 요약 — 로컬에서 「업데이트」 로 확인할 때 쓴다
    if (본문.동작 === '현황요약') {
      if (typeof 현황요약 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      var s = 현황요약();
      s.성공 = true;
      return 응답(s);
    }

    // 문의 탭의 한 행을 기업명으로 찾아 채운다 (5-0 브랜드명 등)
    if (본문.동작 === '칸쓰기') {
      if (typeof 칸쓰기 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(칸쓰기(본문.행라벨, 본문.항목 || []));
    }

    // 3-1 체험단 가이드를 브랜드·채널마다 구글 문서로 만든다
    if (본문.동작 === '체험단문서') {
      if (typeof 체험단문서만들기 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(체험단문서만들기(본문.데이터 || []));
    }

    // 가이드 내용을 시트 탭으로 — 문서보다 시트가 보기 편할 때 쓴다
    if (본문.동작 === '가이드시트') {
      if (typeof 가이드시트쓰기 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      return 응답(가이드시트쓰기(본문.탭, 본문.제목, 본문.항목순서 || [], 본문.데이터 || []));
    }

    // 6번 노션 업로드 결과 기록 — 도구/노션올리기.sh 가 올린 뒤 알려 준다
    if (본문.동작 === '공고기록') {
      if (typeof 이력기록_공고 !== 'function') {
        return 응답({ 성공: false, 오류: '통합관리.gs 가 프로젝트에 없습니다.' });
      }
      // 종류를 안 넘기면 기획형으로 본다. 체험단(4번)은 '체험단' 을 넘긴다.
      // 체험단은 채널(블로그·피드·릴스)까지 넘겨야 한다. 채널마다 따로 올라가는 공고다.
      var 종류 = 본문.종류 || '기획형';
      var 채널 = 본문.채널 || '';
      var 줄 = 이력기록_공고(종류, 채널, 본문.브랜드, 본문.링크);
      if (!줄) return 응답({ 성공: false, 오류: '브랜드명이 비어 있습니다.' });
      if (typeof 문의탭반영 === 'function') { try { 문의탭반영(); } catch (e) {} }
      return 응답({ 성공: true, 종류: 종류, 채널: 채널, 기록: 본문.브랜드 });
    }

    if (!본문.데이터 || !본문.데이터.length) return 응답({ 성공: false, 오류: '데이터가 비어 있습니다.' });

    // 웹앱은 302 로 응답을 돌려준다. 리다이렉트가 POST 로 재전송되면 두 번 실행되므로,
    // 같은 실행키가 다시 들어오면 앞선 결과를 그대로 돌려준다.
    var 캐시 = CacheService.getScriptCache();
    var 캐시키 = 본문.실행키 ? ('실행_' + 본문.실행키) : null;
    if (캐시키) {
      var 이전 = 캐시.get(캐시키);
      if (이전) { var r = JSON.parse(이전); r.재사용 = true; return 응답(r); }
    }

    var 결과 = 실행코어(본문.데이터, 본문.덮어쓰기 !== false);
    if (캐시키) 캐시.put(캐시키, JSON.stringify(결과), 600);
    return 응답(결과);

  } catch (err) {
    return 응답({ 성공: false, 오류: String(err && err.stack ? err.stack : err) });
  }
}

function 응답(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
         .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 시트 내용을 읽어 돌려준다. 쓰지 않는다.
 *
 * 왜 필요한가
 *   광고주 관리 시트·5-0 응답 시트를 비공개로 바꿨다. 계좌번호와 계정 비밀번호가
 *   링크만 알면 보이는 상태였기 때문이다. 대신 로컬에서 내용을 확인할 길이 막혔다.
 *   이 동작은 비밀키를 아는 쪽만 호출할 수 있는 읽기 전용 통로다.
 *
 * 시트 별칭
 *   통합 / 응답 / 관리  또는 스프레드시트 ID 를 직접 넘긴다.
 *   탭을 비우면 첫 번째 탭을 읽는다.
 */
function 시트읽기(시트, 탭, 최대) {
  var 별칭 = {
    '통합': (typeof 통합시트_ID !== 'undefined') ? 통합시트_ID : '',
    '응답': (typeof 응답시트_ID !== 'undefined') ? 응답시트_ID : '',
    '관리': PropertiesService.getScriptProperties().getProperty('관리시트_ID') || ''
  };
  var id = 별칭[시트] || 시트 || '';
  if (!id) return { 성공: false, 오류: '시트를 찾을 수 없습니다: ' + 시트 };

  var ss;
  try { ss = SpreadsheetApp.openById(id); }
  catch (e) { return { 성공: false, 오류: '시트를 열 수 없습니다: ' + e }; }

  var 탭목록 = ss.getSheets().map(function (s) {
    return { 이름: s.getName(), gid: s.getSheetId(), 행: s.getLastRow(), 열: s.getLastColumn() };
  });

  var sh = null;
  if (탭) {
    sh = ss.getSheetByName(탭);
    if (!sh) {
      // 이름이 아니라 gid 로 넘어올 수도 있다
      var g = String(탭);
      ss.getSheets().forEach(function (s) { if (String(s.getSheetId()) === g) sh = s; });
    }
    if (!sh) return { 성공: false, 오류: '탭이 없습니다: ' + 탭, 탭목록: 탭목록 };
  } else {
    sh = ss.getSheets()[0];
  }

  var 한도 = Math.min(최대 || 200, 500);          // 응답이 너무 커지지 않게 제한
  var 끝행 = Math.min(sh.getLastRow(), 한도);
  var 값 = (끝행 > 0 && sh.getLastColumn() > 0)
    ? sh.getRange(1, 1, 끝행, sh.getLastColumn()).getDisplayValues()
    : [];

  return {
    성공: true,
    시트명: ss.getName(),
    탭명: sh.getName(),
    행: sh.getLastRow(),
    열: sh.getLastColumn(),
    잘림: sh.getLastRow() > 끝행,
    탭목록: 탭목록,
    값: 값
  };
}

/** 수동 — _작업/데이터.gs 를 붙여 넣은 뒤 쓴다. */
function 전체생성()          { 수동실행(false); }
function 전체생성_덮어쓰기() { 수동실행(true); }

function 수동실행(덮어쓰기) {
  if (typeof 가이드데이터 === 'undefined' || !가이드데이터.length) {
    Logger.log('데이터.gs 가 없습니다. 먼저 가이드생성.pl 을 돌리고 _작업/데이터.gs 를 붙여 넣으세요.');
    Logger.log('또는 로컬에서 bash 도구/시트올리기.sh 를 쓰면 붙여 넣지 않아도 됩니다.');
    return;
  }
  var 결과 = 실행코어(가이드데이터, 덮어쓰기);
  결과.문서.forEach(function (d) { Logger.log(d.상태 + ': ' + d.브랜드); });
  Logger.log('\n완료 ' + 결과.건수 + '건');
  Logger.log('관리 시트: ' + 결과.관리시트);
  Logger.log('폴더: ' + 결과.폴더);
}

// ═══════════════════════════════════════════════════════════
// 실제 작업
// ═══════════════════════════════════════════════════════════

function 실행코어(데이터, 덮어쓰기) {
  var 폴더 = 폴더확보(폴더명);
  var 행들 = [];
  var 문서 = [];

  데이터.forEach(function (d) {
    var 브랜드 = String(d.브랜드 || '').trim();
    if (브랜드 === '') return;

    // 산출물 이름 앞에 만든 날짜를 붙인다. 날짜는 생성기(데이터.json)에서 받는다.
    // 같은 브랜드를 다시 만들면 날짜가 바뀌므로, 옛 문서를 찾으려면 접미로 찾는다.
    var 문서명 = (d.날짜 ? d.날짜 + ' ' : '') + 브랜드 + 문서접미;
    var 기존 = 같은브랜드문서(폴더, 브랜드);

    if (기존.length && !덮어쓰기) {
      var f = 기존[0];
      행들.push([브랜드, 항목값(d, '진행방식'), d.접수일 || '', f.getUrl(), '이미 있음', 보완요약(d)]);
      문서.push({ 브랜드: 브랜드, 상태: '건너뜀(이미 있음)', 링크: f.getUrl() });
      return;
    }
    기존.forEach(function (f) { f.setTrashed(true); });   // 덮어쓰기: 기존 문서는 휴지통으로

    var url = 문서만들기(폴더, 문서명, d);
    행들.push([브랜드, 항목값(d, '진행방식'), d.접수일 || '', url, '생성', 보완요약(d)]);
    문서.push({ 브랜드: 브랜드, 상태: '생성', 링크: url });

    // 광고주 관리 워크북의 발행 이력에도 남긴다. 통합관리.gs 가 같은 프로젝트에 있을 때만.
    if (typeof 이력기록_5_1 === 'function') {
      try { 이력기록_5_1(브랜드, d.날짜 || '', url, 보완요약(d)); }
      catch (err) { Logger.log('발행 이력 기록 실패: ' + err); }
    }
  });

  var 관리url = 관리시트갱신(폴더, 행들);

  // 광고주 관리 워크북의 문의 탭까지 한 번에 반영한다
  if (typeof 문의탭반영 === 'function') {
    try { 문의탭반영(); } catch (err) { Logger.log('문의 탭 반영 실패: ' + err); }
  }

  return {
    성공: true,
    건수: 문서.length,
    관리시트: 관리url,
    폴더: 폴더.getUrl(),
    문서: 문서,
    시각: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
  };
}

// ═══════════════════════════════════════════════════════════
// 항목 읽기
// ═══════════════════════════════════════════════════════════

/** 항목 객체 {구분, 원문, 보완} 를 꺼낸다. 없으면 빈 항목. */
function 항목(d, 이름) {
  var it = (d.항목 || {})[이름];
  if (!it) return { 구분: '제안', 원문: '', 보완: '❗포포몬비즈 작성 필요' };
  return it;
}

/** 관리 시트처럼 한 줄로 쓸 때의 최종 값 (보완이 있으면 보완을 쓴다). */
function 항목값(d, 이름) {
  var it = 항목(d, 이름);
  return (it.보완 && it.구분 !== '보완') ? it.보완 : (it.원문 || it.보완 || '');
}

function 보완요약(d) {
  var 목록 = [];
  var h = d.항목 || {};
  for (var k in h) {
    if (h[k] && h[k].구분 && h[k].구분 !== '원문') 목록.push(k + '(' + h[k].구분 + ')');
  }
  return 목록.sort().join(', ');
}

// ═══════════════════════════════════════════════════════════
// 구글 문서 만들기
// ═══════════════════════════════════════════════════════════

function 문서만들기(폴더, 문서명, d) {
  var doc = DocumentApp.create(문서명);
  var body = doc.getBody();
  body.clear();

  var 브랜드 = String(d.브랜드);

  body.appendParagraph(브랜드 + ' 기획형 인플루언서 콘텐츠 제작')
      .setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('기획형 인플루언서 콘텐츠 제작 가이드 · ' + 브랜드)
      .setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  body.appendParagraph('인플루언서 가이드 제작 → 인플루언서 매칭 → 콘텐츠 제작 → 검수 → 업로드');

  범례(body);

  제목(body, '캠페인 개요');
  표(body, d, [
    ['브랜드',            null, 브랜드],
    ['브랜드 확인 링크',   '링크'],
    ['홍보 제품 · 서비스', '홍보제품'],
    ['진행 방식',          '진행방식'],
    ['제공 제품 · 혜택',   '제공혜택'],
    ['캠페인 목적',        '캠페인목적']
  ]);

  제목(body, '브랜드 소개');
  항목문단(body, d, '브랜드소개');
  소제목(body, '브랜드가 가장 강조하고 싶은 점');
  항목문단(body, d, '강조포인트');

  제목(body, '일정');
  표(body, d, [
    ['방문 일정',          '일정'],
    ['콘텐츠 제출일',      '콘텐츠제출일'],
    ['업로드 희망 시점',   '업로드시점'],
    ['인사이트 제출 기한', '인사이트기한']
  ]);

  제목(body, '콘텐츠 방향');
  소제목(body, '희망하는 콘텐츠 스타일');
  항목문단(body, d, '콘텐츠스타일');
  소제목(body, '전체적인 분위기');
  항목문단(body, d, '분위기');

  제목(body, '반드시 포함되어야 하는 장면');
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

  제목(body, '2차 활용 · 저작권');
  표(body, d, [
    ['2차 활용',      '2차활용'],
    ['저작권',        '저작권'],
    ['파트너십 광고', '파트너십광고']
  ]);

  제목(body, '참고할 만한 콘텐츠');
  항목문단(body, d, '레퍼런스링크');

  제목(body, '기본 제작 안내');
  표(body, d, [['영상 길이', '영상길이']]);
  var 안내 = String(항목(d, '기본제작안내').원문 || '').split('\n')
               .filter(function (s) { return s !== ''; });
  목록(body, 안내.length ? 안내 : 기본제작안내_대비);

  doc.saveAndClose();

  // 내 드라이브 루트에 생기므로 폴더로 옮긴다
  var file = DriveApp.getFileById(doc.getId());
  폴더.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return doc.getUrl();
}

// ═══════════════════════════════════════════════════════════
// 출력 — 검정/빨강 구분이 핵심이다
// ═══════════════════════════════════════════════════════════

function 범례(body) {
  var p = body.appendParagraph('');
  var t = p.editAsText();
  넣기(t, '이 문서는 ', 검정, true);
  넣기(t, '위 내용으로 인플루언서에게 제작을 요청하기 전, 광고주님께 확인받기 위한 가이드입니다.\n', 검정, false);
  넣기(t, '검정 글씨는 광고주님이 제출해 주신 내용입니다.\n', 검정, false);
  넣기(t, '빨간 글씨는 포포몬비즈가 새로 기입하거나 정리한 내용입니다. 확인 후 수정 요청해 주세요.', 빨강, true);
}

/** 텍스트 끝에 색·굵기를 지정해 이어 붙인다. */
function 넣기(t, s, 색, 굵게) {
  if (!s) return;
  var from = t.getText().length;
  t.appendText(s);
  var to = t.getText().length - 1;
  if (to < from) return;
  t.setForegroundColor(from, to, 색);
  t.setBold(from, to, !!굵게);
}

/**
 * 한 항목을 문단으로 쓴다.
 *   원문 → 검정만
 *   제안 → [제안] + 빨강만
 *   정리·보완 → [원문] 검정 + [정리|보완] 빨강 을 위아래로 함께
 */
function 항목문단(body, d, 이름) {
  var it = 항목(d, 이름);
  var 구분 = it.구분 || '원문';

  if (구분 === '원문') { 줄들(body, it.원문, 검정, null);  return; }
  if (구분 === '제안') { 줄들(body, it.보완, 빨강, '제안'); return; }
  줄들(body, it.원문, 검정, '원문');
  줄들(body, it.보완, 빨강, 구분 === '정리' ? '정리' : '보완');
}

/** 여러 줄 텍스트를 문단으로 나눠 쓰고, 첫 줄 앞에 배지를 붙인다. */
function 줄들(body, s, 색, 배지) {
  var lines = String(s == null ? '' : s).split('\n');
  if (lines.length === 1 && lines[0] === '') lines = ['—'];
  lines.forEach(function (line, i) {
    var p = body.appendParagraph('');
    p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    var t = p.editAsText();
    if (i === 0 && 배지) 넣기(t, '[' + 배지 + '] ', 색, true);
    넣기(t, line === '' ? ' ' : line, 색, false);
  });
}

function 제목(body, s) {
  var p = body.appendParagraph(s).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  p.editAsText().setForegroundColor(남색);
}
function 소제목(body, s) {
  body.appendParagraph(s).setHeading(DocumentApp.ParagraphHeading.HEADING3);
}
function 목록(body, arr) {
  arr.forEach(function (s) {
    body.appendListItem(s).setGlyphType(DocumentApp.GlyphType.BULLET)
        .editAsText().setForegroundColor(검정);
  });
}

/**
 * 2열 표.
 * 행 정의: [머리글, 항목이름]  또는  [머리글, null, 고정값]
 * 표 셀에서도 검정/빨강 구분을 유지한다.
 */
function 표(body, d, 행들) {
  var t = body.appendTable(행들.map(function () { return ['', '']; }));

  행들.forEach(function (행, i) {
    var 머리 = t.getCell(i, 0);
    머리.getChild(0).asParagraph().editAsText().appendText(행[0]);
    머리.getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(남색);

    var 셀 = t.getCell(i, 1);
    var p0 = 셀.getChild(0).asParagraph();

    if (행[1] === null) {                                  // 고정값
      p0.editAsText().appendText(String(행[2]));
      p0.editAsText().setForegroundColor(검정);
      return;
    }

    var it = 항목(d, 행[1]);
    var 구분 = it.구분 || '원문';
    var 조각 = [];
    if (구분 === '원문')      { 조각.push([it.원문, 검정, null]); }
    else if (구분 === '제안') { 조각.push([it.보완, 빨강, '제안']); }
    else                      { 조각.push([it.원문, 검정, '원문']);
                                조각.push([it.보완, 빨강, 구분 === '정리' ? '정리' : '보완']); }

    var 첫줄 = true;
    조각.forEach(function (c) {
      String(c[0] == null ? '' : c[0]).split('\n').forEach(function (line, j) {
        var p = 첫줄 ? p0 : 셀.appendParagraph('');
        첫줄 = false;
        var txt = p.editAsText();
        if (j === 0 && c[2]) 넣기(txt, '[' + c[2] + '] ', c[1], true);
        넣기(txt, line === '' ? ' ' : line, c[1], false);
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════
// 관리 시트
// ═══════════════════════════════════════════════════════════

function 관리시트갱신(폴더, 행들) {
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
  sh.clear();

  var 머리글 = ['브랜드', '진행 방식', '문의 접수일', '가이드 문서', '상태',
                '포포몬비즈 보완 항목', '갱신'];
  var 지금 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  var 값들 = [머리글].concat(행들.map(function (r) {
    return [r[0], r[1], r[2], r[3], r[4], r[5], 지금];
  }));

  sh.getRange(1, 1, 값들.length, 머리글.length).setValues(값들);

  var h = sh.getRange(1, 1, 1, 머리글.length);
  h.setFontWeight('bold').setBackground('#F2F4F8');
  sh.setFrozenRows(1);
  if (행들.length) {
    sh.getRange(2, 6, 행들.length, 1).setFontColor(빨강).setWrap(true);
  }
  [22, 12, 14, 52, 10, 46, 18].forEach(function (w, i) { sh.setColumnWidth(i + 1, w * 8); });

  return ss.getUrl();
}

// ═══════════════════════════════════════════════════════════
// 보조
// ═══════════════════════════════════════════════════════════

function 폴더확보(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/**
 * 같은 브랜드의 기존 문서를 찾는다.
 * 문서명 앞에 만든 날짜가 붙으므로 이름이 완전히 일치하지 않는다.
 * 「…<브랜드> 콘텐츠 제작 가이드」 로 끝나는 파일을 모두 모아 돌려준다.
 * 이걸 이름 일치로 찾으면 날짜가 바뀔 때마다 옛 문서가 남아 중복이 쌓인다.
 */
function 같은브랜드문서(폴더, 브랜드) {
  var 접미 = 브랜드 + 문서접미;
  var 목록 = [];
  var it = 폴더.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var n = f.getName();
    if (n === 접미 || n.slice(-접미.length) === 접미) 목록.push(f);
  }
  return 목록;
}
