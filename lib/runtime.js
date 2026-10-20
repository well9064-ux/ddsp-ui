/* 드론 파종 컨셉 UI — 오프라인 실행용 경량 런타임
   캔버스(.dc.html) 화면에서 쓰는 기능만 구현: {{hole}}, sc-for / sc-if, on* 이벤트,
   dc-import(공통 메뉴), x-import(디자인 시스템 컴포넌트), DCLogic(state·setState·생명주기) */
(function () {
  'use strict';
  var DC = window.DC = window.DC || { components: {} };
  DC.register = function (name, tpl, src) { DC.components[name] = { tpl: tpl, src: src }; };

  /* ---------- 값 조회 ---------- */
  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }
  function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

  /* ---------- 템플릿 전처리 ---------- */
  function prep(str) {
    return str
      .replace(/<helmet>[\s\S]*?<\/helmet>/g, '')
      .replace(/<sc-for\b/g, '<template data-sc="for"').replace(/<\/sc-for>/g, '</template>')
      .replace(/<sc-if\b/g, '<template data-sc="if"').replace(/<\/sc-if>/g, '</template>');
  }
  function parse(str) {
    var t = document.createElement('template');
    t.innerHTML = prep(str);
    return t.content;
  }
  function kids(node) { return node.content ? node.content.childNodes : node.childNodes; }

  /* ---------- 디자인 시스템 컴포넌트 (bundle.js 스타일 재현) ---------- */
  var SLOTS = {
    neutral: ['var(--status-neutral-bg)', 'var(--status-neutral-text)'],
    wait: ['var(--status-wait-bg)', 'var(--status-wait-text)'],
    progress: ['var(--status-progress-bg)', 'var(--status-progress-text)'],
    success: ['var(--status-success-bg)', 'var(--status-success-text)'],
    error: ['var(--status-error-bg)', 'var(--status-error-text)']
  };
  var WORK = { till: 'var(--work-till)', seeding: 'var(--work-seeding)', harvest: 'var(--work-harvest)', control: 'var(--work-control)' };
  function el(tag, style, children) {
    var e = document.createElement(tag);
    if (style) e.setAttribute('style', style);
    (children || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var BTN = {
    primary: ['var(--brand-primary)', 'var(--brand-on)', 'transparent'],
    secondary: ['var(--surface-primary)', 'var(--brand-primary)', 'var(--brand-primary)'],
    tertiary: ['var(--surface-primary)', 'var(--text-secondary)', 'var(--border-strong)'],
    danger: ['var(--status-error)', 'var(--brand-on)', 'transparent'],
    text: ['transparent', 'var(--text-secondary)', 'transparent']
  };
  var COMP = {
    StatusBadge: function (p, ch) {
      var c = SLOTS[p.status] || SLOTS.neutral;
      return el('span', 'display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;box-sizing:border-box;background:' + c[0] + ';color:' + c[1] + ';border-radius:var(--radius-full);font:600 12px/1 var(--font-primary);white-space:nowrap;' + (p.style || ''),
        [el('span', 'width:6px;height:6px;border-radius:50%;background:currentColor')].concat(ch));
    },
    WorkTag: function (p, ch) {
      return el('span', 'display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;box-sizing:border-box;background:var(--surface-primary);color:var(--text-secondary);border:1px solid var(--border-default);border-radius:var(--radius-input);font:600 12px/1 var(--font-primary);white-space:nowrap;' + (p.style || ''),
        [el('span', 'width:8px;height:8px;border-radius:2px;background:' + (WORK[p.type] || 'var(--work-till)'))].concat(ch));
    },
    KpiCard: function (p) {
      var label = el('span', 'display:flex;align-items:center;gap:6px;font:400 12px/16px var(--font-primary);color:var(--text-tertiary)',
        [p.accent ? el('span', 'width:8px;height:8px;border-radius:50%;background:' + p.accent) : null, p.label == null ? '' : String(p.label)]);
      var val = el('span', 'font:600 24px/32px var(--font-primary);letter-spacing:-0.6px;color:var(--text-primary);font-variant-numeric:tabular-nums',
        [p.value == null ? '' : String(p.value), p.unit ? el('span', 'font:600 14px/20px var(--font-primary);color:var(--text-tertiary);margin-left:2px', [String(p.unit)]) : null]);
      var sub = p.sub ? el('span', 'font:400 12px/16px var(--font-primary);color:var(--text-tertiary);font-variant-numeric:tabular-nums', [String(p.sub)]) : null;
      return el('div', 'display:flex;flex-direction:column;justify-content:space-between;gap:8px;min-height:88px;min-width:0;padding:16px;box-sizing:border-box;text-align:left;background:var(--surface-primary);border:1px solid var(--border-default);border-radius:var(--radius-btn);' + (p.style || ''), [label, val, sub]);
    },
    Button: function (p, ch) {
      var pal = BTN[p.variant || 'primary'] || BTN.primary;
      var size = p.size || 'l', h = { xl: 44, l: 32, m: 28, s: 26, xs: 24 }[size] || 32, pad = { xl: 20, l: 16, m: 14, s: 12, xs: 10 }[size] || 16;
      var b = el('button', 'display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;height:' + h + 'px;padding:0 ' + pad + 'px;font:600 ' + (size === 'xl' ? 16 : 14) + 'px/1 var(--font-primary);letter-spacing:-0.2px;color:' + pal[1] + ';background:' + pal[0] + ';border:1px solid ' + pal[2] + ';border-radius:var(--radius-btn);cursor:pointer;white-space:nowrap;' + (p.style || ''), ch);
      b.type = 'button'; b.className = 'dc-btn';
      return b;
    },
    Input: function (p) {
      var h = { l: 44, m: 32, s: 24 }[p.size || 'm'] || 32;
      var input = el('input', 'flex:1;min-width:0;border:none;outline:none;background:transparent;font:400 14px/20px var(--font-primary);color:var(--text-primary)');
      if (p.value != null) input.setAttribute('value', String(p.value));
      if (p.placeholder) input.setAttribute('placeholder', p.placeholder);
      if (p.readOnly) input.setAttribute('readonly', '');
      if (p.label) input.setAttribute('aria-label', p.label);
      var box = el('div', 'display:flex;align-items:center;gap:8px;height:' + h + 'px;padding:0 12px;box-sizing:border-box;background:var(--surface-primary);border:1px solid var(--border-input);border-radius:var(--radius-input)', [input]);
      return el('div', 'display:flex;flex-direction:column;gap:6px;' + (p.style || ''),
        [p.label ? el('span', 'font:600 14px/20px var(--font-primary);color:var(--text-secondary)', [p.label]) : null, box]);
    },
    Select: function (p) {
      var h = { l: 44, m: 32 }[p.size || 'm'] || 32;
      var sel = el('select', 'flex:1;min-width:0;height:100%;border:none;outline:none;background:transparent;font:400 14px/20px var(--font-primary);color:var(--text-primary);appearance:none;-webkit-appearance:none;cursor:pointer');
      (p.options || []).forEach(function (o) {
        var v = o && o.value != null ? o.value : o, l = o && o.label != null ? o.label : o;
        var op = el('option', null, [String(l)]); op.value = String(v);
        if (String(v) === String(p.value)) op.setAttribute('selected', '');
        sel.appendChild(op);
      });
      if (p.label) sel.setAttribute('aria-label', p.label);
      var chev = el('span', 'pointer-events:none;color:var(--text-tertiary);font-size:12px', ['▾']);
      var box = el('div', 'display:flex;align-items:center;gap:8px;height:' + h + 'px;padding:0 12px;box-sizing:border-box;background:var(--surface-primary);border:1px solid var(--border-input);border-radius:var(--radius-input)', [sel, chev]);
      return el('div', 'display:flex;flex-direction:column;gap:6px;' + (p.style || ''),
        [p.label ? el('span', 'font:600 14px/20px var(--font-primary);color:var(--text-secondary)', [p.label]) : null, box]);
    }
  };

  /* ---------- 컴포넌트 인스턴스 ---------- */
  function DCLogic(props) { this.props = props || {}; this.state = null; }
  DCLogic.prototype.setState = function (patch) {
    var prev = this.state || {};
    var next = typeof patch === 'function' ? patch(prev, this.props) : patch;
    this.state = Object.assign({}, prev, next);
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  DCLogic.prototype.renderVals = function () { return {}; };
  window.DCLogic = DCLogic;

  function makeInstance(src, props) {
    var Cls = new Function('DCLogic', src + '\n;return Component;')(DCLogic);
    var inst = new Cls(props);
    if (!inst.props) inst.props = props || {};
    return inst;
  }
  var instances = {}, mounted = [];
  function instanceFor(key, src, props) {
    var inst = instances[key];
    if (!inst) { inst = instances[key] = makeInstance(src, props); mounted.push(inst); }
    else inst.props = props;
    return inst;
  }

  /* ---------- 렌더 ---------- */
  var handlers = {}, hid = 0;
  function bindHandler(elm, name, fn) {
    if (typeof fn !== 'function') return;
    var evt = name.slice(2).toLowerCase();
    var id = 'h' + (hid++);
    handlers[id] = fn;
    elm.setAttribute('data-dc-' + evt, id);
  }
  var BOOL = { checked: 1, readonly: 1, disabled: 1, selected: 1, hidden: 1 };
  function processNodes(list, scope, out, keyPrefix) {
    for (var i = 0; i < list.length; i++) processNode(list[i], scope, out, keyPrefix + '.' + i);
  }
  function processNode(node, scope, out, key) {
    if (node.nodeType === 3) {
      out.push(document.createTextNode(node.nodeValue.indexOf('{{') >= 0 ? interp(node.nodeValue, scope) : node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'template' && node.hasAttribute('data-sc')) {
      var kind = node.getAttribute('data-sc');
      if (kind === 'if') {
        var vm = WHOLE.exec(node.getAttribute('value') || '');
        if (vm && lookup(vm[1], scope)) processNodes(kids(node), scope, out, key);
      } else {
        var lm = WHOLE.exec(node.getAttribute('list') || ''), as = node.getAttribute('as') || 'item';
        var arr = lm ? lookup(lm[1], scope) : null;
        (arr || []).forEach(function (item, idx) {
          var s = Object.create(scope); s[as] = item; s.$index = idx;
          processNodes(kids(node), s, out, key + '[' + idx + ']');
        });
      }
      return;
    }
    if (tag === 'x-import') {
      var name = (node.getAttribute('component-from-global-scope') || '').split('.').pop();
      var props = {};
      node.getAttributeNames().forEach(function (a) {
        if (a === 'component-from-global-scope') return;
        var raw = node.getAttribute(a), m = WHOLE.exec(raw);
        props[camel(a)] = m ? lookup(m[1], scope) : interp(raw, scope);
      });
      var ch = []; processNodes(node.childNodes, scope, ch, key);
      var f = COMP[name];
      out.push(f ? f(props, ch) : el('span', null, ch));
      return;
    }
    if (tag === 'dc-import') {
      var cname = node.getAttribute('name'), def = DC.components[cname];
      if (!def) return;
      var cprops = {};
      node.getAttributeNames().forEach(function (a) {
        if (a === 'name' || a.indexOf('hint-') === 0) return;
        var raw = node.getAttribute(a), m = WHOLE.exec(raw);
        cprops[camel(a)] = m ? lookup(m[1], scope) : interp(raw, scope);
      });
      var inst = instanceFor(key + ':' + cname, def.src, cprops);
      if (!def.frag) def.frag = parse(def.tpl);
      processNodes(def.frag.childNodes, inst.renderVals() || {}, out, key + ':' + cname);
      return;
    }
    var e = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.localName)
      : document.createElement(node.localName);
    node.getAttributeNames().forEach(function (a) {
      var raw = node.getAttribute(a);
      if (a.indexOf('hint-') === 0) return;
      var m = WHOLE.exec(raw);
      if (a.slice(0, 2) === 'on') { if (m) bindHandler(e, a, lookup(m[1], scope)); return; }
      if (m) {
        var v = lookup(m[1], scope);
        if (BOOL[a]) { if (v) e.setAttribute(a, ''); return; }
        if (v == null || v === false && a.indexOf('aria-') !== 0) return;
        e.setAttribute(a, String(v));
      } else {
        e.setAttribute(a, raw.indexOf('{{') >= 0 ? interp(raw, scope) : raw);
      }
    });
    var cs = []; processNodes(kids(node), scope, cs, key);
    cs.forEach(function (c) { e.appendChild(c); });
    if (tag === 'input' && e.hasAttribute('value')) e.value = e.getAttribute('value');
    out.push(e);
  }

  var root, frag, main, pending = false, firstDone = false;
  function render() {
    pending = false;
    handlers = {}; hid = 0;
    var out = [];
    processNodes(frag.childNodes, main.renderVals() || {}, out, 'r');
    var next = document.createElement('div'); next.id = 'dc-root';
    out.forEach(function (n) { next.appendChild(n); });
    window.morphdom(root, next, {
      onBeforeElUpdated: function (from, to) {
        if (from.tagName === 'INPUT' && from.type === 'range' && document.activeElement === from && from.matches(':active')) {
          to.value = from.value;
        }
        return true;
      }
    });
    if (!firstDone) {
      firstDone = true;
      mounted.forEach(function (i) { if (i.componentDidMount) i.componentDidMount(); });
    }
  }
  function schedule() { if (!pending && root) { pending = true; requestAnimationFrame(render); } }

  function delegate(type, attr) {
    document.addEventListener(type, function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-dc-' + attr + ']') : null;
      if (!t) return;
      var fn = handlers[t.getAttribute('data-dc-' + attr)];
      if (fn) fn(ev);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var tplEl = document.getElementById('dc-tpl'), srcEl = document.getElementById('dc-src');
    var tpl = tplEl.textContent;
    var hm = /<helmet>([\s\S]*?)<\/helmet>/.exec(tpl);
    if (hm) { var h = document.createElement('div'); h.innerHTML = hm[1]; Array.prototype.slice.call(h.childNodes).forEach(function (n) { document.head.appendChild(n); }); }
    frag = parse(tpl);
    main = makeInstance(srcEl.textContent, {});
    mounted.unshift(main);
    root = document.getElementById('dc-root');
    delegate('click', 'click');
    delegate('input', 'change');
    delegate('change', 'change');
    delegate('input', 'input');
    render();
  });
})();
