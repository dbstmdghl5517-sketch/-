#!/usr/bin/env bash
# 저장소의 .gs 파일을 Apps Script 프로젝트에 직접 올린다.
#
# 사용법:  bash "도구/앱스푸시.sh"           ← 올린다
#          bash "도구/앱스푸시.sh" 받기      ← 프로젝트 → 저장소 (반대 방향)
#          bash "도구/앱스푸시.sh" 확인      ← 올리지 않고 차이만 본다
#          bash "도구/앱스푸시.sh" 배포      ← 올리고 웹앱 배포까지 (URL 은 그대로)
#
# ★ 왜 만들었나
#   전에는 내가 클립보드에 코드를 올리고 사용자가 편집기에 붙여넣었다.
#   그 과정에서 엉뚱한 파일에 붙여넣기, 클립보드 덮어쓰기, 옛 버전 붙여넣기가
#   반복해서 일어났다. 한 번은 완성된 코드가 통째로 날아갔다.
#   이제 clasp 로 직접 쓴다. 사람 손을 거치지 않으므로 그런 사고가 안 난다.
#
# ★ 준비 (한 번만 끝냄)
#   1) script.google.com/home/usersettings → Google Apps Script API 사용
#   2) clasp login  → 브라우저에서 계정 허용
#   두 가지 모두 이미 되어 있다. 토큰이 만료되면 1)은 그대로 두고 2)만 다시 한다.
#
# ─── 함정 ───────────────────────────────────────────────────
# 1. **셸 변수명에 한글을 쓸 수 없다.** 변수명은 ASCII 로 둔다.
# 2. **Git Bash 에서 clasp 를 직접 부르면 `node: not found` 가 난다.**
#    npm 래퍼가 PATH 에서 node 를 못 찾는다. node 폴더를 PATH 에 넣어 줘야 한다.
# 3. 프로젝트 안의 파일 이름·폴더 구조가 저장소와 다르다. 아래 짝 표가 기준이다.
#    이름이 어긋나면 clasp 가 **새 파일을 만들어** 같은 함수가 두 벌이 된다.
# 4. `clasp push` 는 프로젝트 쪽 변경을 **덮어쓴다.** 편집기에서 직접 고친 게 있으면
#    먼저 `받기` 로 가져와야 한다. 그래서 올리기 전에 항상 차이를 보여준다.
# 5. push 는 **저장**까지만 한다. 웹앱은 배포 시점 코드로 도므로 **배포는 따로** 해야 한다.
#    트리거는 저장된 코드로 돌기 때문에 배포 없이도 바로 반영된다.

set -euo pipefail

MODE="${1:-올리기}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$ROOT/연동/앱스스크립트"

[[ -d "$WORK" ]] || { echo "오류: $WORK 이 없습니다." >&2; exit 1; }
[[ -f "$WORK/.clasp.json" ]] || { echo "오류: .clasp.json 이 없습니다." >&2; exit 1; }

# node 를 PATH 에 넣는다 (함정 2)
for P in "/c/Program Files/nodejs" "${APPDATA:-}/npm" "${HOME:-}/AppData/Roaming/npm"; do
  [[ -d "$P" ]] && PATH="$PATH:$P"
done
export PATH
command -v node >/dev/null || { echo "오류: node 를 찾을 수 없습니다." >&2; exit 1; }

CLASP="$(command -v clasp || true)"
[[ -n "$CLASP" ]] || { echo "오류: clasp 이 없습니다. npm i -g @google/clasp" >&2; exit 1; }

# 저장소 파일  ↔  프로젝트 파일 (함정 3)
PAIRS=(
  "공고/5-1 기획형 인플루언서 공고 가이드/구글문서생성.gs|구글문서생성.js"
  "공고/5-1 기획형 인플루언서 공고 가이드/자동알림.gs|자동알림.js"
  "연동/통합관리.gs|연동/통합관리.js"
  "연동/아임웹_시트연동.gs|연동/아임웹_시트연동.js"
)

차이보기() {
  local DIFF=0
  for PAIR in "${PAIRS[@]}"; do
    SRC="$ROOT/${PAIR%%|*}"
    DST="$WORK/${PAIR##*|}"
    NAME="$(basename "$SRC")"
    if [[ ! -f "$DST" ]]; then
      printf '  %-16s 프로젝트에 없음 (새로 만들어집니다)\n' "$NAME"; DIFF=1; continue
    fi
    if diff -q "$SRC" "$DST" >/dev/null 2>&1; then
      printf '  %-16s 같음\n' "$NAME"
    else
      A=$(wc -l < "$SRC"); B=$(wc -l < "$DST")
      printf '  %-16s 다름  (저장소 %s줄 / 프로젝트 %s줄)\n' "$NAME" "$A" "$B"; DIFF=1
    fi
  done
  return $DIFF
}

cd "$WORK"

if [[ "$MODE" == "받기" ]]; then
  echo "프로젝트 → 저장소"
  "$CLASP" pull >/dev/null
  for PAIR in "${PAIRS[@]}"; do
    cp "$WORK/${PAIR##*|}" "$ROOT/${PAIR%%|*}"
    echo "  받음: ${PAIR%%|*}"
  done
  echo "완료. 저장소 파일이 프로젝트 내용으로 바뀌었습니다."
  exit 0
fi

echo "프로젝트에서 현재 코드를 받아 비교합니다…"
"$CLASP" pull >/dev/null
echo
echo "── 저장소 vs 프로젝트 ──"
차이보기 || true
echo

if [[ "$MODE" == "확인" ]]; then
  echo "확인만 했습니다. 올리려면 인자 없이 다시 돌리세요."
  exit 0
fi

# 저장소 내용을 프로젝트 폴더로 복사한 뒤 올린다
for PAIR in "${PAIRS[@]}"; do
  mkdir -p "$(dirname "$WORK/${PAIR##*|}")"
  cp "$ROOT/${PAIR%%|*}" "$WORK/${PAIR##*|}"
done

"$CLASP" push --force

# 올라간 내용이 정말 같은지 되받아 확인한다. 올렸다고 믿지 않는다.
echo
echo "되받아 확인합니다…"
for PAIR in "${PAIRS[@]}"; do rm -f "$WORK/${PAIR##*|}"; done
"$CLASP" pull >/dev/null
echo "── 확인 ──"
if 차이보기; then
  echo
  echo "✅ 세 파일 모두 저장소와 같습니다."
else
  echo
  echo "❗아직 다른 파일이 있습니다. 위 목록을 확인하세요." >&2
  exit 1
fi

echo
echo "※ 저장까지 끝났습니다. 트리거는 바로 새 코드로 돕니다."

# ── 배포 ──
# 웹앱(doPost)은 **배포 시점 코드**로 돈다. 저장만 해서는 안 바뀐다.
# ★ 반드시 기존 배포를 갱신한다. 새로 만들면 URL 이 바뀌어
#   연동/.env 의 주소와 모든 도구가 한꺼번에 끊긴다.
if [[ "$MODE" == "배포" ]]; then
  DEPLOY_ID="$(grep -m1 '^공고가이드_웹앱=' "$ROOT/연동/.env" \
    | sed -E 's#.*/macros/s/([^/]+)/exec.*#\1#')"
  if [[ -z "$DEPLOY_ID" || "$DEPLOY_ID" == *"공고가이드_웹앱"* ]]; then
    echo "오류: 연동/.env 의 공고가이드_웹앱 에서 배포 ID 를 못 뽑았습니다." >&2
    exit 1
  fi
  echo
  echo "기존 배포를 갱신합니다 (URL 그대로): ${DEPLOY_ID:0:20}…"
  "$CLASP" create-version "$(date '+%Y-%m-%d %H:%M') 자동 배포" | tail -1
  "$CLASP" redeploy "$DEPLOY_ID" -d "$(date '+%Y-%m-%d %H:%M')" | tail -1
  echo "배포 완료. 웹앱이 새 코드로 돕니다."
else
  echo "   웹앱 동작을 바꿨으면 «bash 도구/앱스푸시.sh 배포» 로 배포까지 하세요."
fi
