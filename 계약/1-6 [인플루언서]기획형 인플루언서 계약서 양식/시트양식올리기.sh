#!/usr/bin/env bash
# 1-6 계약서 양식 → A4 문서형 스프레드시트 (드라이브 `계약서 양식` 폴더)
#
# 사용법: bash "계약/1-6 [인플루언서]기획형 인플루언서 계약서 양식/시트양식올리기.sh" [쪽높이px]
# 결과:   시트 링크 출력 + _작업/시트확인.pdf (A4 로 내보낸 모습 — 쪽 나눔 확인용)
#
# 흐름: _작업/양식_행.json → 시트양식배치.js → 웹앱 `계약양식시트` → PDF 되받기
# 같은 제목의 옛 시트는 휴지통으로 가고 새로 만들어진다 (링크가 바뀐다).

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NHERE="$(cygpath -m "$HERE" 2>/dev/null || echo "$HERE")"   # node 는 윈도 경로가 필요하다
ROOT="$(cd "$HERE/../.." && pwd)"
PAGE="${1:-1025}"
URL="$(grep -m1 '^공고가이드_웹앱=' "$ROOT/연동/.env" | cut -d= -f2-)"
KEY="$(grep -m1 '^공고가이드_비밀키=' "$ROOT/연동/.env" | cut -d= -f2-)"
W="$NHERE/_작업"

node "$NHERE/시트양식배치.js" "$W/양식_행.json" "$W/배치.json" "$PAGE"
node -e '
const fs=require("fs");const [lay,key,out]=process.argv.slice(1);
const 변수=[["프로젝트명","표지 < > 안"],["표지일자","표지 날짜 — 금일 (예: 2026. 09. 28.)"],["인플루언서명","서두 계약 당사자 (= 성함)"],["광고주명","본문 전체 — 예) 아쿠아필드 하남점"],["계약기간","제2조 기간"],["방문장소","제2조"],["방문일자","제2조"],["업로드기한","제2조"],["지급포인트","제2조 제공 내역 — 숫자만 (예: 150,000)"],["제공혜택","제2조 제공 내역 — 제품·서비스"],["게시유지기간","제2조·제3조 — 예) 90일"],["2차활용기간","제2조 — 예) 기간제한 없이 사용가능 / 1년"],["계약체결일","서명란 위 — 금일"],["성함","서두·서명란·동의인"],["연락처","서명란"],["플랫폼","서명란 — 예) 인스타그램"],["계정ID","서명란 — 예) @hong_daily"],["주민번호","서명란 — 원천세 신고용"],["동의일자","개인정보 동의서 — 금일"]].map(([a,b])=>["{{"+a+"}}",b]);
fs.writeFileSync(out,JSON.stringify({"비밀키":key.replace(/[^A-Za-z0-9_-]/g,""),"동작":"계약양식시트","자료":{"제목":"[양식] 기획형 인플루언서 계약서 (포포몬 포인트)","배치":JSON.parse(fs.readFileSync(lay,"utf8")),"변수":변수,"pdf확인":true}}));' \
  "$W/배치.json" "$KEY" "$W/req.json"
curl -sS -L --max-time 300 -H 'Content-Type: application/json' --data-binary "@$W/req.json" "$URL" > "$W/res.json"
rm -f "$W/req.json"
node -e '
const fs=require("fs");const [res,pdf]=process.argv.slice(1);const r=JSON.parse(fs.readFileSync(res,"utf8"));
if(!r["성공"]){console.log("실패:",r["오류"]);process.exit(2);}
console.log("시트 :",r["링크"]);
if(r.pdf){fs.writeFileSync(pdf,Buffer.from(r.pdf,"base64"));console.log("PDF  :",pdf);}' "$W/res.json" "$W/시트확인.pdf"
rm -f "$W/res.json"
