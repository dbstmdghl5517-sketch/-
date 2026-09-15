#!/usr/bin/env bash
# 공개 구글 스프레드시트를 CSV 로 내려받는다.
#
# 사용법:
#   bash "도구/시트받기.sh" "<시트ID 또는 URL>" "<저장경로.csv>"
# 예:
#   bash "도구/시트받기.sh" "1QDKvfEF31SDT0vN8rkwyLtcb7c6sJikLtXWICqrpUEY" \
#        "공고/5-0 new 기획형 인플루언서 양식폼(응답)/응답/응답시트.csv"
#
# 시트가 "링크가 있는 모든 사용자 - 뷰어" 로 공유돼 있어야 한다.
# 비공개면 HTTP 401 이 오고, 이 환경에는 구글 자격증명이 없어 우회할 수 없다.

set -euo pipefail

IN="${1:-}"; OUTFILE="${2:-}"
if [[ -z "$IN" || -z "$OUTFILE" ]]; then
  echo '사용법: bash "도구/시트받기.sh" "<시트ID 또는 URL>" "<저장경로.csv>"' >&2
  exit 1
fi

# URL 이 들어오면 시트 ID 만 뽑는다
ID="$IN"
if [[ "$IN" == *"/spreadsheets/d/"* ]]; then
  ID="${IN#*/spreadsheets/d/}"
  ID="${ID%%/*}"
fi

mkdir -p "$(dirname "$OUTFILE")"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

CODE="$(curl -sL -o "$TMP" -w '%{http_code}' \
  "https://docs.google.com/spreadsheets/d/$ID/export?format=csv")"

if [[ "$CODE" != "200" ]]; then
  echo "오류: 시트를 받지 못했습니다 (HTTP $CODE)" >&2
  echo "      시트 공유 설정을 '링크가 있는 모든 사용자 → 뷰어' 로 바꿔주세요." >&2
  exit 1
fi

# HTML 로그인 페이지가 200 으로 오는 경우도 있다
if head -c 200 "$TMP" | grep -qi '<!DOCTYPE html\|<html'; then
  echo "오류: CSV 가 아니라 로그인 페이지가 왔습니다. 시트가 비공개입니다." >&2
  exit 1
fi

mv -f "$TMP" "$OUTFILE"
trap - EXIT

LINES="$(grep -c '' "$OUTFILE" || true)"
echo "저장 : $OUTFILE"
echo "크기 : $(stat -c%s "$OUTFILE") bytes / 약 ${LINES} 줄"
