/* ══════════════════════════════════════════════════════════════════════
   修仙也要拍 · 青羽門主題引擎（Qingyu Gate theme engine）
   ----------------------------------------------------------------------
   作用：依「最愛的角色」換整套配色與常駐背景動畫。
   資料來源：config.js → characters[].theme（沒填就自動用 c1/c2 推导）。
   預設主題：小師姐（config.js characters[0]）。
   用法（app.js 內部）：XX_THEME.applyId(id) / XX_THEME.apply(charObj)

   要自己調色：只改 config.js 的 characters[].theme 就好，
   例：theme: { a1: '#ff9ec4', a2: '#ffffff', ink: '#0b0a0d', ink2: '#14121a',
              light: true,  bgfx: 'petals' }
     a1   = 主配色（發光、按鈕、連結、游標選取）
     a2   = 副配色（文字偏色、進度條尾端、標題柔光）
     ink  = 最底層背景（質感黑）
     ink2 = 卡片／面板底
     light= true = 白系（白線、白字為主，a1 當點綴）
              false = 黑系（a1 當主要亮點，線也用 a1 色調）
     bgfx = 背景動畫：'petals' 櫻花瓣 | 'petalsGold' 黃花瓣
            | 'ripple' 水波紋 | 'flame' 火焰 | 'cloud' 白雲
            | 'lightning' 紫電 | 'leaves' 綠葉
   ══════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  var CFG = w.XX_CONFIG || {};
  var CHARS = CFG.characters || [];
  var root = document.documentElement;
  var DEFAULT_ID = CHARS.length ? CHARS[0].id : 'xiao-shi-jie';
  var current = null;
  var morphT = null, firstRun = true;   /* 換主題時讓顏色慢慢過渡 */

  /* ── 小工具：顏色運算 ───────────────────────────────────────────── */
  function hex(c) {
    c = String(c || '#888888').trim().replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c.slice(0, 6), 16);
    if (isNaN(n)) n = 0x888888;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(r) {
    return '#' + [r[0], r[1], r[2]].map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function rgba(c, a) {
    var x = hex(c);
    return 'rgba(' + x[0] + ', ' + x[1] + ', ' + x[2] + ', ' + a + ')';
  }

  /* ── 背景動畫的強度（画布不透明度）────────────────────────────── */
  var BG_OP = { petals: .78, petalsGold: .74, ripple: .55, flame: .62, cloud: .5, lightning: .62, leaves: .74 };

  /* 從角色物件萃取出主題（config 沒寫 theme 就用 c1/c2 補） */
  function paletteOf(ch) {
    var t = (ch && ch.theme) || {};
    var a1 = t.a1 || (ch && ch.c1) || '#e6c26b';
    var a2 = t.a2 || (ch && ch.c2) || '#ffffff';
    var ink = t.ink || '#08080b';
    var ink2 = t.ink2 || mix(ink, a2, .06);
    var light = !!t.light;
    var bgfx = t.bgfx || 'petals';
    return { id: ch ? ch.id : DEFAULT_ID, a1: a1, a2: a2, ink: ink, ink2: ink2, light: light, bgfx: bgfx };
  }

  /* 把主題展開成一整組 CSS 變數（app.css 全站都用這些變數） */
  function tokens(p) {
    var hairline = p.light ? rgba(mix(p.a2, '#ffffff', .5), .16) : rgba(p.a1, .18);
    var txt = p.light ? mix('#ffffff', p.a2, .22) : mix('#f4f6fa', p.a2, .30);
    var panelBase = mix(p.ink2, p.a1, p.light ? .03 : .06);
    return {
      '--ink': p.ink,
      '--ink-2': p.ink2,
      '--panel': rgba(panelBase, .80),
      '--panel-solid': mix(p.ink2, '#ffffff', .04),
      '--line': hairline,
      '--line-strong': rgba(p.a1, .42),
      '--gold': p.a1,                       /* 品牌金 → 變成主題主配色 */
      '--gold-soft': mix(p.a2, p.a1, .18),
      '--jade': mix(p.a1, p.a2, .30),       /* 連結／成功色 → 跟著主題走 */
      '--azure': p.a2,
      '--cinnabar': '#e0645a',              /* 危險／刪除固定為紅，避免誤判 */
      '--txt': txt,
      '--dim': mix(txt, p.ink, .38),
      '--dimmer': mix(txt, p.ink, .58),
      '--shadow': '0 22px 70px rgba(0, 0, 0, .62), 0 1px 0 ' + rgba(p.a2, .05),
      '--accent': p.a1,
      '--accent-soft': p.a2,
      '--sel': rgba(p.a1, .34),
      '--ring': rgba(p.a1, .5),
      '--glow': rgba(p.a1, p.light ? .14 : .2),
      '--hairline-hi': rgba(p.light ? '#ffffff' : p.a1, .07),
      /* 背景漸層（三個色標，app.css 的 body 會用） */
      '--bg-a': rgba(mix(p.ink, p.a1, p.light ? .18 : .26), .95),
      '--bg-b': rgba(mix(p.ink, mix(p.a1, p.a2, .5), p.light ? .16 : .22), .9),
      '--bg-c1': p.ink,
      '--bg-c2': mix(p.ink, p.ink2, .65),
      '--bg-c3': p.ink,
      '--bg-op': String(BG_OP[p.bgfx] != null ? BG_OP[p.bgfx] : .7)
    };
  }

  function setVars(map) {
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) root.style.setProperty(k, map[k]);
  }

  /* 依角色套用主題：CSS 變數 + body[data-theme] + 背景動畫 + 手機列顏色 */
  function apply(ch) {
    var p = paletteOf(ch || charById(DEFAULT_ID));
    if (!firstRun && p.id !== (current && current.id)) {
      try {
        root.classList.add('theme-morph');
        if (morphT) clearTimeout(morphT);
        morphT = setTimeout(function () { root.classList.remove('theme-morph'); }, 680);
      } catch (e) { /* 過渡加不上無所謂，顏色還是會換 */ }
    }
    firstRun = false;
    current = p;
    setVars(tokens(p));
    try {
      document.body.setAttribute('data-theme', p.id);
      document.body.style.setProperty('--c1', p.a1);
      document.body.style.setProperty('--c2', p.a2);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', p.ink);
    } catch (e) { /* 老瀏覽器：至少變數有生效 */ }
    if (w.XXTransition && w.XXTransition.setAmbient) {
      w.XXTransition.setAmbient(p.bgfx, { a1: p.a1, a2: p.a2, ink: p.ink });
    }
    return p;
  }
  function charById(id) {
    for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === id) return CHARS[i];
    return null;
  }

  w.XX_THEME = {
    apply: apply,
    applyId: function (id) { return apply(charById(id) || charById(DEFAULT_ID)); },
    applyDefault: function () { return apply(charById(DEFAULT_ID)); },
    current: function () { return current; },
    paletteOf: paletteOf,
    /* 給「七個選項／七個角色膠囊」用：把該角色的主題色塞成它自己的變數。
       --cink / --cink2 ＝ 該角色自己的深色底（所以七張卡不會是白底）       */
    cardVars: function (ch) {
      var p = paletteOf(ch);
      var ink1 = mix(p.ink, p.a1, .12);
      var ink2 = mix(p.ink2, p.a1, .18);
      return '--c1:' + p.a1 + ';--c2:' + p.a2 +
        ';--cink:' + rgba(ink1, .93) + ';--cink2:' + rgba(ink2, .96) +
        ';--ctint:' + rgba(p.a1, .18) +
        ';--ctint2:' + rgba(mix(p.a1, p.a2, .5), .08) + ';--cglyph:' + rgba(p.a1, .55) +
        ';--crail:' + rgba(p.light ? '#ffffff' : p.a1, .26);
    },
    DEFAULT_ID: DEFAULT_ID,
    mixHex: mix, rgba: rgba
  };

  /* 進站前就把預設主題（小師姐）上上去，第一幀就是質感黑＋櫻花瓣 */
  apply(charById(DEFAULT_ID));
}(window));
