// 1-6 계약서 양식(행 JSON) → 스프레드시트 A4 문서형 배치(JSON)
//
// 사용법: node 시트양식배치.js <양식_행.json> <출력.json> [쪽높이px]
//
// ★ 왜 이렇게 하나
//   시트는 병합 셀의 행 높이를 자동으로 맞추지 못한다. 글자 수로 줄 수를 어림해 높이를 넘긴다.
//   A4 세로에 너비 맞춤으로 내보내면 열 합계 720px 기준 한 쪽이 약 1,060px 이다.
//   표지는 한 쪽을 채우고, 서명란·동의서는 쪽 중간에서 잘리지 않게 다음 쪽으로 민다.
//   값은 어림이므로 만든 뒤 PDF 로 내보내 쪽 수를 확인한다 (pdf확인 옵션).

const fs = require('fs');
const [src, out, pageArg] = process.argv.slice(2);
// 실측(2026-09-28): A4·너비 맞춤 내보내기에서 한 쪽 = 1,018~1,043px. 행은 쪽 사이에서 쪼개지지 않고
// 통째로 다음 쪽으로 넘어간다. 그래서 쪽 위치를 행 단위로 그대로 흉내 낸다.
const PAGE = Number(pageArg || 1025);
// 한 줄에 여러 항목이 붙어 온 것을 나눈다 (예: "…부담한다. 2) …", "…이행한다. 1) …")
// 작은따옴표는 시트가 맨 앞 ' 를 텍스트 표시로 먹으므로 굽은 따옴표로 바꾼다.
const rows = [];
for (const r of JSON.parse(fs.readFileSync(src, 'utf8'))) {
  const t = r.t.replace(/'([^']*)'/g, "‘$1’").replace(/’([^‘’]*)'/g, "’$1’");
  const 조각 = r.k === 'b' ? t.split(/(?<=[.다])\s+(?=\d\)\s|\*|위 계약서는)/) : [t];
  조각.forEach(x => rows.push({ t: x.trim(), k: r.k }));
}

// 글자 폭 어림 (맑은 고딕 10pt): 한글 13px, 그 밖 7px
const 폭 = t => [...String(t)].reduce((s, c) => s + (/[ᄀ-ᇿ㄰-㆏가-힯　-〿＀-￯【】]/.test(c) ? 13 : 7), 0);
const 높이 = (t, avail, 배율 = 1, 최소 = 21) =>
  Math.max(최소, Math.ceil(폭(t) * 배율 / (avail - 10)) * Math.round(17 * 배율) + 8);
const W = { para: 680, item: 650, item2: 580, note: 650, kv: 480, sign: 240 };

const L = [];
let 위치 = 0;                                   // 현재 쪽에서 쓴 높이
const add = x => { x.h = Math.max(2, Math.round(x.h)); if (위치 + x.h > PAGE) 위치 = 0; 위치 += x.h; L.push(x); };
const 쪽넘김 = () => { if (위치 > 0) add({ k: 'gap', h: PAGE - 위치 }); };
const 남은 = () => PAGE - 위치;
const 표지 = rows.filter(r => r.k === 'cover').map(r => r.t);

// ── 표지 (한 쪽)
add({ k: 'gap', h: 200 });
add({ k: 'cover', t: 표지[0], s: 20, h: 44 });
add({ k: 'gap', h: 16 });
add({ k: 'title', t: 표지[1], s: 17, u: true, h: 40 });
add({ k: 'gap', h: 380 });
add({ k: 'cover', t: 표지[2], s: 13, h: 30 });
add({ k: 'gap', h: 10 });
add({ k: 'cover', t: 표지[3], s: 12, h: 26 });
쪽넘김();

// ── 본문
let 제2조 = false, 제공 = null, 서명 = false;
const 몸 = rows.filter(r => r.k !== 'cover' && r.t !== '');
for (let i = 0; i < 몸.length; i++) {
  const { t, k } = 몸[i];
  if (k === 'sign') {
    if (서명) continue;
    서명 = true;
    // 좌우 서명표 — 대행사 | 인플루언서
    const 표 = [
      { l1: '구분', v1: '대행사', l2: '구분', v2: '인플루언서', head: true },
      { l1: '회사명', v1: '㈜위더스콘텐츠', l2: '성함', v2: '{{성함}}   (인)' },
      { l1: '대표자', v1: '하 인 덕   (인)', l2: '연락처', v2: '{{연락처}}' },
      { l1: '주소', v1: '부산광역시 해운대구 센텀북대로 60, 9층 901호 (재송동, 센텀아이에스타워)', l2: '플랫폼', v2: '{{플랫폼}}' },
      { l1: '', v1: '', l2: '계정 ID', v2: '{{계정ID}}' },
      { l1: '', v1: '', l2: '주민번호', v2: '{{주민번호}}' },
    ].map(x => ({ k: 'sign', ...x, h: Math.max(높이(x.v1, W.sign, 1, 30), 높이(x.v2, W.sign, 1, 30)) }));
    표.forEach(add);
    continue;
  }
  if (/^개인정보 수집/.test(t)) {
    쪽넘김();
    add({ k: 'gap', h: 30 });
    add({ k: 'box', t, h: 36 });
    add({ k: 'gap', h: 20 });
    continue;
  }
  if (k === 'title') { add({ k: 'gap', h: 10 }); add({ k: 'title', t, u: true, h: 40 }); continue; }
  if (/^제\s*\d+\s*조/.test(t)) {
    제2조 = /^제\s*2\s*조/.test(t);
    add({ k: 'h', t, h: 34 });
    continue;
  }
  if (t === '{{계약체결일}}') {
    // 날짜 + 서명표(약 260px)가 쪽 끝에서 잘리지 않게
    if (남은() < 300) 쪽넘김();
    add({ k: 'gap', h: 16 });
    add({ k: 'center', t, b: true, h: 30 });
    add({ k: 'gap', h: 12 });
    continue;
  }
  if (t === '{{동의일자}}') { add({ k: 'gap', h: 20 }); add({ k: 'center', t, b: true, h: 30 }); continue; }
  if (/^동의인/.test(t)) { add({ k: 'right', t: '동의인 : {{성함}}   (인)', b: true, h: 30 }); continue; }
  if (/^- 다\s*음/.test(t)) { add({ k: 'center', t: '- 다   음 -', h: 34 }); continue; }

  if (제2조) {
    let m;
    if ((m = t.match(/^\d\)\s*(기간|방법)\s*:\s*(.*)$/))) { add({ k: 'kv', l1: m[1], v1: m[2], h: 높이(m[2], W.kv, 1, 26) }); continue; }
    if ((m = t.match(/^- (.+?)\s*:\s*(.*)$/))) {
      let v = m[2];
      if (m[1] === '제공 내역') {           // 다음 줄(제공혜택)과 합친다
        const 다음 = 몸[i + 1] ? 몸[i + 1].t.trim() : '';
        if (다음.startsWith('{{제공혜택}}')) { v = v + ' ' + 다음; i++; }
      }
      add({ k: 'kv', l1: m[1], v1: v, h: 높이(v, W.kv, 1, 26) });
      continue;
    }
    if (t.startsWith('*')) { add({ k: 'note', t, h: 높이(t, W.note, 0.9, 18) }); continue; }
  }

  let m;
  if ((m = t.match(/^(\d+-\d+\))\s*(.*)$/))) { add({ k: 'item2', n: m[1], t: m[2], h: 높이(m[2], W.item2) }); continue; }
  if ((m = t.match(/^(\d+\))\s*(.*)$/))) { add({ k: 'item', n: m[1], t: m[2], h: 높이(m[2], W.item) }); continue; }
  if ((m = t.match(/^(\(\d+\))\s*(.*)$/))) { add({ k: 'item2', n: m[1], t: m[2], h: 높이(m[2], W.item2) }); continue; }
  if ((m = t.match(/^-\s+(.*)$/))) { add({ k: 'bullet', n: '-', t: m[1], h: 높이(m[1], W.item2) }); continue; }
  if (t.startsWith('*')) { add({ k: 'note', t, h: 높이(t, W.note, 0.9, 18) }); continue; }
  if (/^[□■]/.test(t)) { add({ k: 'gap', h: 6 }); add({ k: 'para', t, h: 높이(t, W.para) }); continue; }
  if (/^['‘"“]/.test(t) || /^'/.test(t)) { add({ k: 'item2', n: '', t, h: 높이(t, W.item2) }); continue; }
  add({ k: 'para', t, b: i === 1, h: 높이(t, W.para) });
}

L.forEach(x => { x.h = Math.max(2, Math.round(x.h)); });   // 시트는 0·음수 높이를 받지 않는다
fs.writeFileSync(out, JSON.stringify(L));
const 전체 = L.reduce((a, x) => a + x.h, 0);
console.log('배치', L.length, '행 / 전체 높이', 전체, 'px');
