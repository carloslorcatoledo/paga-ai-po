/*
 * app.js — Interfaz de "Paga aí po!".
 *
 * Toda la lógica de dinero vive en calc.js (probado). Este archivo solo maneja
 * la pantalla y el guardado local. Se carga como script externo (no en línea)
 * para poder aplicar una Content-Security-Policy estricta (ver index.html).
 *
 * Seguridad:
 *  - Todo texto del usuario se escapa con esc() antes de insertarlo en el DOM (anti-XSS).
 *  - Los datos se guardan solo en este dispositivo (localStorage). Nada se envía a
 *    ningún servidor; lo único que "sale" es el texto que tú mismo compartes por
 *    WhatsApp, y esa ventana se abre con 'noopener' y sin referer.
 */
(function () {
  'use strict';
  var R = window.Reparte;

  // ---------- Config ----------
  var CURRENCIES = {
    CLP: { code: 'CLP', decimals: 0, locale: 'es-CL', label: 'CLP', name: 'Peso chileno', sign: '$' },
    USD: { code: 'USD', decimals: 2, locale: 'en-US', label: 'USD', name: 'Dólar', sign: 'US$' },
    BRL: { code: 'BRL', decimals: 2, locale: 'pt-BR', label: 'BRL', name: 'Real brasileño', sign: 'R$' }
  };
  var CATEGORIES = [
    { id: 'comida', label: 'Comida', icon: '🍕' },
    { id: 'alcohol', label: 'Alcohol', icon: '🍺' },
    { id: 'bebidas', label: 'Bebidas', icon: '🥤' },
    { id: 'transporte', label: 'Transporte', icon: '🚕' },
    { id: 'otros', label: 'Otros', icon: '🧾' }
  ];
  var AVATAR_COLORS = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#14b8a6'];
  var STORAGE_KEY = 'pagaaipo_v1';

  // ---------- State ----------
  var state = {
    eventName: '', currency: 'CLP', theme: 'system', tab: 'personas',
    tipPercent: 0, participants: [], expenses: [],
    cloudId: null, codigo: null
  };
  var TIP_PRESETS = [0, 5, 10, 15];
  var editingId = null;

  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        state.eventName = typeof s.eventName === 'string' ? s.eventName : '';
        state.currency = CURRENCIES[s.currency] ? s.currency : 'CLP';
        state.theme = s.theme || 'system';
        state.tab = s.tab || 'personas';
        state.tipPercent = (typeof s.tipPercent === 'number' && s.tipPercent >= 0) ? s.tipPercent : 0;
        state.participants = Array.isArray(s.participants) ? s.participants : [];
        state.expenses = Array.isArray(s.expenses) ? s.expenses : [];
        state.cloudId = s.cloudId || null;
        state.codigo = s.codigo || null;
      }
    } catch (e) {}
  }

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cur() { return CURRENCIES[state.currency] || CURRENCIES.CLP; }
  function factor() { return Math.pow(10, cur().decimals); }
  function fmt(minor) {
    var c = cur();
    try {
      return new Intl.NumberFormat(c.locale, {
        style: 'currency', currency: c.code,
        minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals
      }).format((minor || 0) / factor());
    } catch (e) { return c.sign + (minor || 0); }
  }
  function parseAmount(str) {
    if (str == null) return 0;
    var n = parseFloat(String(str).replace(',', '.'));
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * factor());
  }
  function initials(name) {
    var parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  function pById(id) { for (var i = 0; i < state.participants.length; i++) if (state.participants[i].id === id) return state.participants[i]; return null; }
  function nameOf(id) { var p = pById(id); return p ? p.name : '—'; }
  function colorOf(id) { var p = pById(id); return p ? p.color : '#888'; }
  function catOf(id) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i]; return CATEGORIES[4]; }
  // Anti-XSS: escapa texto antes de insertarlo como HTML.
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }

  // ---------- Render ----------
  function render() {
    $('eventName').value = state.eventName;
    $('currencyHeader').value = state.currency;
    $('badgePeople').textContent = state.participants.length;
    $('badgeExp').textContent = state.expenses.length;
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === state.tab); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + state.tab); });
    $('fab').style.display = state.tab === 'gastos' ? 'inline-flex' : 'none';
    $('themeBtn').textContent = state.theme === 'dark' ? '☀️' : (state.theme === 'light' ? '🌙' : '🌓');
    renderPeople();
    renderExpenses();
    if (state.tab === 'resumen') renderSummary();
  }

  function renderPeople() {
    var box = $('peopleList');
    if (!state.participants.length) {
      box.innerHTML = emptyHTML('👋', 'Agrega a quienes salieron', 'Escribe un nombre arriba. Luego podrás crear gastos.');
      return;
    }
    box.innerHTML = state.participants.map(function (p) {
      return '<div class="person-chip">' +
        '<div class="avatar" style="background:' + esc(p.color) + '">' + esc(initials(p.name)) + '</div>' +
        '<div class="pname">' + esc(p.name) + '</div>' +
        '<button class="remove-x" data-remove="' + esc(p.id) + '" aria-label="Quitar">×</button>' +
        '</div>';
    }).join('');
  }

  function renderExpenses() {
    var box = $('expList');
    if (!state.expenses.length) {
      box.innerHTML = emptyHTML('🧾', 'Aún no hay gastos',
        state.participants.length ? 'Toca “＋ Gasto” para agregar el primero.' : 'Primero agrega personas, luego gastos.');
      return;
    }
    box.innerHTML = state.expenses.map(function (e) {
      var names = e.participants.map(nameOf);
      var noTip = (state.tipPercent > 0 && e.tip === false) ? ' · sin propina' : '';
      var sub = 'Pagó ' + esc(nameOf(e.paidBy)) + ' · entre ' + e.participants.length + ': ' + esc(names.join(', ')) + noTip;
      return '<div class="exp-card" data-edit="' + esc(e.id) + '">' +
        '<div class="exp-icon">' + catOf(e.category).icon + '</div>' +
        '<div class="exp-main">' +
          '<div class="exp-top"><span class="exp-desc">' + esc(e.description || catOf(e.category).label) + '</span>' +
          '<span class="exp-amt">' + esc(fmt(e.amount)) + '</span></div>' +
          '<div class="exp-sub">' + sub + '</div>' +
        '</div></div>';
    }).join('');
  }

  function setTip(p) {
    state.tipPercent = (isFinite(p) && p >= 0) ? Math.min(p, 1000) : 0;
    save(); renderSummary();
  }

  function renderSummary() {
    var box = $('summaryContent');
    if (!state.expenses.length) {
      box.innerHTML = emptyHTML('📊', 'Nada que calcular todavía', 'Agrega gastos para ver quién debe a quién.');
      return;
    }
    var tip = state.tipPercent || 0;
    var balances = R.computeBalances(state.participants, state.expenses, { tipPercent: tip });
    var totals = R.eventTotals(state.expenses, tip);
    var sorted = balances.slice().sort(function (a, b) { return b.balance - a.balance; });

    var html = '';
    html += '<div class="total-card"><div class="lbl">Total de la salida</div>' +
      '<div class="amt">' + esc(fmt(totals.total)) + '</div>' +
      '<div class="meta">' + state.expenses.length + ' gasto(s) · ' + state.participants.length + ' persona(s)</div>' +
      (tip > 0 ? '<div class="sub">Subtotal ' + esc(fmt(totals.subtotal)) + '  +  propina ' + esc(fmt(totals.tip)) + ' (' + tip + '%)</div>' : '') +
      '</div>';

    // Propina / servicio
    html += '<div class="tip-card"><div class="tip-head"><span class="lbl">Propina / servicio</span>' +
      '<span class="amt">' + (tip > 0 ? esc(fmt(totals.tip)) : 'Sin propina') + '</span></div>' +
      '<div class="chips" id="tipChips">' +
        TIP_PRESETS.map(function (p) {
          return '<button type="button" class="chip' + (p === tip ? ' active' : '') + '" data-tip="' + p + '">' + (p === 0 ? 'Sin' : p + '%') + '</button>';
        }).join('') +
        '<input class="text-input tip-custom" id="tipCustom" type="number" inputmode="decimal" min="0" max="100" step="0.5" placeholder="Otro %" value="' + (TIP_PRESETS.indexOf(tip) === -1 ? tip : '') + '" />' +
      '</div></div>';

    html += '<div class="section-title">Saldo de cada uno</div>';
    html += sorted.map(function (b) {
      var pill, label, amt;
      if (b.balance > 0) { pill = 'pill-pos'; label = 'le deben'; amt = '+' + fmt(b.balance); }
      else if (b.balance < 0) { pill = 'pill-neg'; label = 'debe'; amt = '−' + fmt(-b.balance); }
      else { pill = 'pill-zero'; label = 'al día'; amt = fmt(0); }
      return '<div class="person-card">' +
        '<div class="avatar" style="background:' + esc(colorOf(b.id)) + '">' + esc(initials(b.name)) + '</div>' +
        '<div class="pc-main"><div class="pc-name">' + esc(b.name) + '</div>' +
        '<div class="pc-sub">Pagó ' + esc(fmt(b.paid)) + ' · le toca ' + esc(fmt(b.owes)) + '</div></div>' +
        '<div class="pill ' + pill + '">' + esc(amt) + '<small>' + label + '</small></div></div>';
    }).join('');

    var transfers = R.simplifyDebts(balances);
    html += '<div class="section-title" style="margin-top:18px">Cómo saldar (menos transferencias)</div>';
    if (!transfers.length) {
      html += '<div class="settle-card" style="text-align:center;color:var(--muted)">Todos están al día ✓</div>';
    } else {
      html += '<div class="settle-card">' + transfers.map(function (t) {
        return '<div class="transfer">' +
          '<span class="t-name">' + esc(t.fromName) + '</span>' +
          '<span class="t-mid">→ <span class="t-amt">' + esc(fmt(t.amount)) + '</span> →</span>' +
          '<span class="t-name">' + esc(t.toName) + '</span></div>';
      }).join('') + '</div>';
    }

    html += '<div class="share-row">' +
      '<button class="btn btn-wa" id="shareWa" style="flex:2">📲 Compartir por WhatsApp</button>' +
      '<button class="btn btn-ghost" id="copySum" style="flex:1">Copiar</button></div>';

    box.innerHTML = html;
    $('tipChips').addEventListener('click', function (e) {
      var c = e.target.closest('[data-tip]'); if (c) setTip(parseFloat(c.dataset.tip));
    });
    $('tipCustom').addEventListener('change', function () { setTip(parseFloat(this.value)); });
    $('shareWa').addEventListener('click', shareWhatsApp);
    $('copySum').addEventListener('click', copySummary);
  }

  function emptyHTML(icon, title, text) {
    return '<div class="empty"><div class="big">' + icon + '</div><strong>' + esc(title) + '</strong><p>' + esc(text) + '</p></div>';
  }

  // ---------- Share ----------
  function buildShareText() {
    var tip = state.tipPercent || 0;
    var balances = R.computeBalances(state.participants, state.expenses, { tipPercent: tip });
    var totals = R.eventTotals(state.expenses, tip);
    var sorted = balances.slice().sort(function (a, b) { return b.balance - a.balance; });
    var L = [];
    L.push('*' + (state.eventName || 'Cuenta') + '* 🧾');
    L.push('Total: ' + fmt(totals.total));
    if (tip > 0) L.push('(incluye propina ' + fmt(totals.tip) + ' · ' + tip + '%)');
    L.push('');
    L.push('*Saldos*');
    sorted.forEach(function (b) {
      var s = b.balance > 0 ? ('le deben ' + fmt(b.balance)) : b.balance < 0 ? ('debe ' + fmt(-b.balance)) : 'al día';
      L.push('• ' + b.name + ': ' + s);
    });
    var t = R.simplifyDebts(balances);
    if (t.length) {
      L.push('');
      L.push('*Para saldar*');
      t.forEach(function (x) { L.push('• ' + x.fromName + ' → ' + fmt(x.amount) + ' → ' + x.toName); });
    }
    L.push('');
    L.push('Hecho con Paga aí po!');
    return L.join('\n');
  }
  function shareWhatsApp() {
    var text = buildShareText();
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () { openWa(text); });
    } else { openWa(text); }
  }
  function openWa(text) {
    // noopener: la ventana nueva no puede controlar esta página.
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  }
  function copySummary() {
    var text = buildShareText();
    var btn = $('copySum');
    function done() { if (btn) { var o = btn.textContent; btn.textContent = '¡Copiado!'; setTimeout(function () { btn.textContent = o; }, 1400); } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text); done(); });
    } else { legacyCopy(text); done(); }
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
  }

  // ---------- Participants ----------
  function addPerson(name) {
    name = (name || '').trim().slice(0, 40);
    if (!name) return;
    state.participants.push({ id: uid(), name: name, color: AVATAR_COLORS[state.participants.length % AVATAR_COLORS.length] });
    save(); render();
  }
  function removePerson(id) {
    state.expenses.forEach(function (e) {
      if (e.paidBy === id) e.paidBy = null;
      e.participants = e.participants.filter(function (pid) { return pid !== id; });
    });
    state.expenses = state.expenses.filter(function (e) { return e.paidBy && e.participants.length; });
    state.participants = state.participants.filter(function (p) { return p.id !== id; });
    save(); render();
  }

  // ---------- Expense modal ----------
  function openExpense(id) {
    if (!state.participants.length) { state.tab = 'personas'; render(); return; }
    editingId = id || null;
    var e = id ? state.expenses.filter(function (x) { return x.id === id; })[0] : null;
    $('expTitle').textContent = e ? 'Editar gasto' : 'Nuevo gasto';
    $('expDesc').value = e ? (e.description || '') : '';
    $('expAmount').value = e ? (e.amount / factor()) : '';
    $('expAmount').step = cur().decimals === 0 ? '1' : '0.01';
    $('curSign').textContent = cur().sign;
    $('expErr').textContent = '';
    $('expDelete').hidden = !e;
    $('expTip').checked = e ? (e.tip !== false) : true;

    var selectedCat = e ? e.category : 'comida';
    $('catChips').innerHTML = CATEGORIES.map(function (c) {
      return '<button type="button" class="chip' + (c.id === selectedCat ? ' active' : '') + '" data-cat="' + c.id + '">' + c.icon + ' ' + c.label + '</button>';
    }).join('');

    var payer = e ? e.paidBy : state.participants[0].id;
    $('payerChips').innerHTML = state.participants.map(function (p) { return chipPerson(p, 'payer', p.id === payer); }).join('');

    var included = e ? e.participants.slice() : state.participants.map(function (p) { return p.id; });
    $('splitChips').innerHTML = state.participants.map(function (p) { return chipPerson(p, 'split', included.indexOf(p.id) !== -1); }).join('');

    $('expOverlay').classList.add('open');
    setTimeout(function () { $('expAmount').focus(); }, 80);
  }
  function chipPerson(p, kind, active) {
    return '<button type="button" class="chip' + (active ? ' active' : '') + '" data-' + kind + '="' + esc(p.id) + '">' +
      '<span class="av" style="background:' + esc(p.color) + '">' + esc(initials(p.name)) + '</span>' + esc(p.name) + '</button>';
  }
  function closeExpense() { $('expOverlay').classList.remove('open'); editingId = null; }

  function saveExpense(ev) {
    ev.preventDefault();
    var amount = parseAmount($('expAmount').value);
    var catEl = document.querySelector('#catChips .chip.active');
    var payerEl = document.querySelector('#payerChips .chip.active');
    var splitEls = document.querySelectorAll('#splitChips .chip.active');
    var err = $('expErr');

    if (amount <= 0) { err.textContent = 'Ingresa un monto mayor a 0.'; return; }
    if (!payerEl) { err.textContent = 'Elige quién pagó.'; return; }
    if (!splitEls.length) { err.textContent = 'Elige al menos una persona para dividir.'; return; }

    var obj = {
      id: editingId || uid(),
      description: $('expDesc').value.trim().slice(0, 60),
      amount: amount,
      category: catEl ? catEl.dataset.cat : 'otros',
      paidBy: payerEl.dataset.payer,
      participants: Array.prototype.map.call(splitEls, function (el) { return el.dataset.split; }),
      tip: $('expTip').checked
    };
    if (editingId) state.expenses = state.expenses.map(function (x) { return x.id === editingId ? obj : x; });
    else state.expenses.push(obj);
    save(); closeExpense(); state.tab = 'gastos'; render();
  }
  function deleteExpense() {
    if (!editingId) return;
    if (!confirm('¿Eliminar este gasto?')) return;
    state.expenses = state.expenses.filter(function (x) { return x.id !== editingId; });
    save(); closeExpense(); render();
  }

  // ---------- Currency ----------
  function changeCurrency(newCode) {
    if (!CURRENCIES[newCode] || newCode === state.currency) return;
    var oldF = factor();
    var newF = Math.pow(10, CURRENCIES[newCode].decimals);
    if (oldF !== newF) {
      // Reescala preservando el número que el usuario escribió (NO es tipo de cambio).
      state.expenses.forEach(function (e) { e.amount = Math.round(e.amount / oldF * newF); });
    }
    state.currency = newCode;
    save(); render();
  }

  // ---------- Example ----------
  function loadExample() {
    state.eventName = 'Asado del viernes';
    state.currency = 'CLP';
    state.tipPercent = 0;
    state.cloudId = null;
    state.codigo = null;
    state.participants = [];
    var ids = {};
    ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'].forEach(function (n, i) {
      var id = uid(); ids[n] = id;
      state.participants.push({ id: id, name: n, color: AVATAR_COLORS[i % AVATAR_COLORS.length] });
    });
    state.expenses = [
      { id: uid(), description: 'Carne y pan', amount: 20000, category: 'comida', paidBy: ids.Ana, participants: [ids.Ana, ids.Beto, ids.Caro, ids.Dani, ids.Eli] },
      { id: uid(), description: 'Cervezas', amount: 15000, category: 'alcohol', paidBy: ids.Beto, participants: [ids.Ana, ids.Beto, ids.Caro] },
      { id: uid(), description: 'Bebidas', amount: 6000, category: 'bebidas', paidBy: ids.Dani, participants: [ids.Dani, ids.Eli] }
    ];
    state.tab = 'resumen';
    save(); render();
  }
  function resetAll() {
    if (!confirm('Esto borra personas y gastos de esta salida. ¿Continuar?')) return;
    state.eventName = ''; state.tipPercent = 0; state.participants = []; state.expenses = []; state.tab = 'personas';
    state.cloudId = null; state.codigo = null;
    save(); render();
  }

  // ---------- Theme ----------
  function applyTheme() {
    if (state.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', state.theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#0b0f17' : '#6d5efc');
    }
  }
  function cycleTheme() {
    state.theme = state.theme === 'system' ? 'light' : state.theme === 'light' ? 'dark' : 'system';
    save(); applyTheme(); render();
  }

  // ---------- Menu ----------
  function openMenu() { $('menuOverlay').classList.add('open'); }
  function closeMenu() { $('menuOverlay').classList.remove('open'); }

  // ---------- Cuenta / Nube (Supabase) ----------
  function cloudReady() { return !!(window.Cloud && window.Cloud.available); }
  function refreshAccountUI(session) {
    var user = session && session.user;
    var email = user ? user.email : null;
    if (email) {
      $('accountLabel').textContent = 'Nube: ' + email;
      $('authLoggedOut').hidden = true;
      $('authLoggedIn').hidden = false;
      $('authEmailShown').textContent = email;
      var info = $('cloudSavedInfo');
      if (state.cloudId && state.codigo) {
        info.hidden = false;
        info.innerHTML = 'Evento en la nube · código <strong>' + esc(state.codigo) + '</strong>';
      } else { info.hidden = true; }
    } else {
      $('accountLabel').textContent = cloudReady() ? 'Entrar a la nube' : 'Nube no disponible';
      $('authLoggedOut').hidden = false;
      $('authLoggedIn').hidden = true;
    }
  }
  function openAuth() {
    closeMenu();
    $('authMsg').textContent = '';
    if (!cloudReady()) $('authMsg').textContent = 'La nube no está disponible (revisa tu conexión a internet).';
    $('authOverlay').classList.add('open');
  }
  function closeAuth() { $('authOverlay').classList.remove('open'); }
  function authCreds() { return { email: $('authEmail').value.trim(), pass: $('authPass').value }; }
  function authSignIn() {
    if (!cloudReady()) return;
    var c = authCreds();
    if (!c.email || !c.pass) { $('authMsg').textContent = 'Escribe correo y contraseña.'; return; }
    $('authMsg').textContent = 'Entrando…';
    window.Cloud.signIn(c.email, c.pass).then(function (res) {
      if (res.error) { $('authMsg').textContent = 'No se pudo entrar: ' + res.error.message; return; }
      $('authMsg').textContent = '✓ ¡Entraste!';
      $('authPass').value = ''; // onAuth refresca la UI
    }).catch(function (e) { $('authMsg').textContent = 'Error: ' + e.message; });
  }
  function authSignUp() {
    if (!cloudReady()) return;
    var c = authCreds();
    if (!c.email || !c.pass) { $('authMsg').textContent = 'Escribe correo y contraseña.'; return; }
    if (c.pass.length < 6) { $('authMsg').textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
    $('authMsg').textContent = 'Creando cuenta…';
    window.Cloud.signUp(c.email, c.pass).then(function (res) {
      if (res.error) { $('authMsg').textContent = 'No se pudo crear: ' + res.error.message; return; }
      if (res.data && res.data.session) {
        $('authMsg').textContent = '✓ ¡Cuenta creada!';
        $('authPass').value = '';
      } else {
        $('authMsg').textContent = 'Cuenta creada. Confírmala desde tu correo, o apaga "Confirm email" en Supabase para entrar al instante.';
      }
    }).catch(function (e) { $('authMsg').textContent = 'Error: ' + e.message; });
  }
  function authSignOut() { if (cloudReady()) window.Cloud.signOut(); }

  // ---------- Nube: datos (guardar / historial / compartir) ----------
  function assignColors(parts) {
    parts.forEach(function (p, i) { if (!p.color) p.color = AVATAR_COLORS[i % AVATAR_COLORS.length]; });
    return parts;
  }
  function applyLoadedEvent(d) {
    var ev = d.evento;
    state.cloudId = ev.id;
    state.codigo = ev.codigo;
    state.eventName = ev.nombre || '';
    state.currency = CURRENCIES[ev.moneda] ? ev.moneda : 'CLP';
    state.tipPercent = Number(ev.tip_percent) || 0;
    state.participants = assignColors((d.participantes || []).map(function (p) {
      return { id: p.id, name: p.nombre, color: p.color };
    }));
    state.expenses = (d.gastos || []).map(function (g) {
      return {
        id: g.id,
        description: g.descripcion || '',
        amount: Number(g.monto) || 0,
        category: g.categoria || 'otros',
        paidBy: g.pagado_por,
        tip: g.aplica_propina !== false,
        participants: (d.gasto_participante || [])
          .filter(function (x) { return x.gasto_id === g.id; })
          .map(function (x) { return x.participante_id; })
      };
    });
    state.tab = 'resumen';
    save(); render();
  }
  function cloudSave() {
    if (!cloudReady()) return;
    var btn = $('cloudSave');
    $('cloudMsg').textContent = '';
    btn.disabled = true; var orig = btn.textContent; btn.textContent = 'Guardando…';
    window.Cloud.saveEvent({
      cloudId: state.cloudId, codigo: state.codigo,
      eventName: state.eventName, currency: state.currency, tipPercent: state.tipPercent,
      participants: state.participants, expenses: state.expenses
    }).then(function (res) {
      btn.disabled = false; btn.textContent = orig;
      if (res.error) { $('cloudMsg').textContent = 'No se pudo guardar: ' + res.error.message; return; }
      state.cloudId = res.data.id; state.codigo = res.data.codigo; save();
      var info = $('cloudSavedInfo');
      info.hidden = false;
      info.innerHTML = 'Guardado ✓ · Código para compartir: <strong>' + esc(state.codigo || '') + '</strong>';
    }).catch(function (e) { btn.disabled = false; btn.textContent = orig; $('cloudMsg').textContent = 'Error: ' + e.message; });
  }
  function openEventsList() {
    if (!cloudReady()) return;
    closeAuth();
    var list = $('eventsList');
    list.innerHTML = '<div class="hint">Cargando…</div>';
    $('eventsOverlay').classList.add('open');
    window.Cloud.listEvents().then(function (res) {
      if (res.error) { list.innerHTML = '<div class="err-msg">Error: ' + esc(res.error.message) + '</div>'; return; }
      var rows = res.data || [];
      if (!rows.length) { list.innerHTML = emptyHTML('📂', 'Sin eventos guardados', 'Guarda uno con “Guardar en la nube”.'); return; }
      list.innerHTML = rows.map(function (ev) {
        return '<div class="exp-card" data-open="' + esc(ev.id) + '">' +
          '<div class="exp-icon">📅</div>' +
          '<div class="exp-main"><div class="exp-top"><span class="exp-desc">' + esc(ev.nombre || 'Salida') + '</span>' +
          '<span class="exp-amt" style="font-size:.78rem;color:var(--muted)">' + esc(ev.moneda || '') + '</span></div>' +
          '<div class="exp-sub">' + esc(ev.fecha || '') + ' · código ' + esc(ev.codigo || '') + '</div></div></div>';
      }).join('');
    }).catch(function (e) { list.innerHTML = '<div class="err-msg">Error: ' + esc(e.message) + '</div>'; });
  }
  function closeEventsList() { $('eventsOverlay').classList.remove('open'); }
  function openCloudEvent(id) {
    if (!cloudReady()) return;
    window.Cloud.loadEvent(id).then(function (res) {
      if (res.error) { alert('No se pudo abrir: ' + res.error.message); return; }
      applyLoadedEvent(res.data);
      closeEventsList();
    }).catch(function (e) { alert('Error: ' + e.message); });
  }
  function newCloudEvent() {
    state.eventName = ''; state.tipPercent = 0; state.participants = []; state.expenses = [];
    state.cloudId = null; state.codigo = null; state.tab = 'personas';
    $('cloudSavedInfo').hidden = true;
    save(); render(); closeAuth();
  }
  function joinByCodeUI() {
    if (!cloudReady()) return;
    var code = $('joinCode').value.trim().toUpperCase();
    if (!code) { $('cloudMsg').textContent = 'Escribe un código.'; return; }
    $('cloudMsg').textContent = 'Buscando…';
    window.Cloud.joinByCode(code).then(function (res) {
      if (res.error) { $('cloudMsg').textContent = 'No se pudo: ' + res.error.message; return; }
      $('cloudMsg').textContent = '';
      $('joinCode').value = '';
      openCloudEvent(res.data);
      closeAuth();
    }).catch(function (e) { $('cloudMsg').textContent = 'Error: ' + e.message; });
  }

  // ---------- Events ----------
  function singleSelect(sel, el) {
    document.querySelectorAll(sel + ' .chip').forEach(function (c) { c.classList.remove('active'); });
    el.classList.add('active');
  }
  function bind() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { state.tab = t.dataset.tab; save(); render(); });
    });
    $('eventName').addEventListener('input', function () { state.eventName = this.value; save(); });
    $('currencyHeader').addEventListener('change', function () { changeCurrency(this.value); });
    $('addPersonForm').addEventListener('submit', function (e) { e.preventDefault(); addPerson($('personName').value); $('personName').value = ''; $('personName').focus(); });
    $('peopleList').addEventListener('click', function (e) { var b = e.target.closest('[data-remove]'); if (b) removePerson(b.dataset.remove); });
    $('expList').addEventListener('click', function (e) { var c = e.target.closest('[data-edit]'); if (c) openExpense(c.dataset.edit); });
    $('fab').addEventListener('click', function () { openExpense(null); });

    $('expForm').addEventListener('submit', saveExpense);
    $('expCancel').addEventListener('click', closeExpense);
    $('expDelete').addEventListener('click', deleteExpense);
    $('catChips').addEventListener('click', function (e) { var c = e.target.closest('[data-cat]'); if (c) singleSelect('#catChips', c); });
    $('payerChips').addEventListener('click', function (e) { var c = e.target.closest('[data-payer]'); if (c) singleSelect('#payerChips', c); });
    $('splitChips').addEventListener('click', function (e) { var c = e.target.closest('[data-split]'); if (c) c.classList.toggle('active'); });
    $('selAll').addEventListener('click', function () { document.querySelectorAll('#splitChips .chip').forEach(function (c) { c.classList.add('active'); }); });
    $('selNone').addEventListener('click', function () { document.querySelectorAll('#splitChips .chip').forEach(function (c) { c.classList.remove('active'); }); });

    $('menuBtn').addEventListener('click', openMenu);
    $('menuClose').addEventListener('click', closeMenu);
    $('menuExample').addEventListener('click', function () { closeMenu(); loadExample(); });
    $('menuReset').addEventListener('click', function () { closeMenu(); resetAll(); });
    $('themeBtn').addEventListener('click', cycleTheme);

    // cuenta / nube
    $('menuAccount').addEventListener('click', openAuth);
    $('authCancel').addEventListener('click', closeAuth);
    $('authClose2').addEventListener('click', closeAuth);
    $('authSignIn').addEventListener('click', authSignIn);
    $('authSignUp').addEventListener('click', authSignUp);
    $('authSignOut').addEventListener('click', authSignOut);
    $('authOverlay').addEventListener('click', function (e) { if (e.target === this) closeAuth(); });

    // nube: datos
    $('cloudSave').addEventListener('click', cloudSave);
    $('cloudList').addEventListener('click', openEventsList);
    $('cloudNew').addEventListener('click', function () { if (confirm('¿Vaciar la pantalla para empezar un evento nuevo? Lo guardado en la nube no se borra.')) newCloudEvent(); });
    $('joinBtn').addEventListener('click', joinByCodeUI);
    $('eventsClose').addEventListener('click', closeEventsList);
    $('eventsList').addEventListener('click', function (e) { var c = e.target.closest('[data-open]'); if (c) openCloudEvent(c.dataset.open); });
    $('eventsOverlay').addEventListener('click', function (e) { if (e.target === this) closeEventsList(); });

    [['expOverlay', closeExpense], ['menuOverlay', closeMenu]].forEach(function (pair) {
      $(pair[0]).addEventListener('click', function (e) { if (e.target === this) pair[1](); });
    });
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (state.theme === 'system') applyTheme(); });
    }
  }

  function initCurrencySelect() {
    $('currencyHeader').innerHTML = Object.keys(CURRENCIES).map(function (k) {
      return '<option value="' + k + '">' + CURRENCIES[k].label + '</option>';
    }).join('');
  }

  // ---------- Init ----------
  load();
  initCurrencySelect();
  applyTheme();
  bind();
  render();

  // Nube: estado de sesión (si está configurada)
  if (cloudReady()) {
    window.Cloud.getSession().then(function (res) {
      refreshAccountUI(res && res.data ? res.data.session : null);
    }).catch(function () {});
    window.Cloud.onAuth(function (session) { refreshAccountUI(session); });
  } else {
    refreshAccountUI(null);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
