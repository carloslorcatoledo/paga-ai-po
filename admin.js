(function () {
  'use strict';

  var loginPanel = document.getElementById('loginPanel');
  var loginForm = document.getElementById('loginForm');
  var signInButton = document.getElementById('signInButton');
  var signOutButton = document.getElementById('signOutButton');
  var dashboard = document.getElementById('dashboard');
  var notice = document.getElementById('notice');
  var requestId = 0;
  var authReady = false;

  function showNotice(message, kind) {
    notice.textContent = message;
    notice.dataset.kind = kind || 'info';
    notice.hidden = !message;
  }

  function showLogin(message, kind) {
    requestId += 1;
    dashboard.hidden = true;
    loginPanel.hidden = false;
    signOutButton.hidden = true;
    showNotice(message || '', kind);
  }

  function formatCount(value) {
    var count = Number(value);
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Number.isFinite(count) ? count : 0);
  }

  function formatMoney(currency, amount) {
    var value = Number(amount) || 0;
    try {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency', currency: currency, maximumFractionDigits: 2
      }).format(value);
    } catch (error) {
      return formatCount(value) + ' ' + currency;
    }
  }

  function formatTimestamp(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function appendMoneyRows(amounts) {
    var list = document.getElementById('moneyList');
    list.replaceChildren();
    if (!amounts.length) {
      var empty = document.createElement('p');
      empty.className = 'empty-money';
      empty.textContent = 'Todavía no hay gastos guardados.';
      list.appendChild(empty);
      return;
    }
    amounts.forEach(function (item) {
      var entry = document.createElement('div');
      entry.className = 'money-item';
      var currency = document.createElement('span');
      currency.className = 'money-currency';
      currency.textContent = item.currency;
      var amount = document.createElement('strong');
      amount.className = 'money-amount';
      amount.textContent = formatMoney(item.currency, item.amount);
      entry.append(currency, amount);
      list.appendChild(entry);
    });
  }

  function appendDailyChart(rows) {
    var chart = document.getElementById('dailyChart');
    chart.replaceChildren();
    var series = [
      { key: 'registrations', label: 'Cuentas registradas', className: '' },
      { key: 'events', label: 'Eventos creados', className: 'events' },
      { key: 'active_accounts', label: 'Cuentas con actividad registrada', className: 'activity' }
    ];
    var maximum = rows.reduce(function (largest, row) {
      return Math.max(largest, series.reduce(function (max, item) { return Math.max(max, Number(row[item.key]) || 0); }, 0));
    }, 0);

    rows.forEach(function (row, index) {
      var column = document.createElement('div');
      column.className = 'day-column';
      var bars = document.createElement('div');
      bars.className = 'bars';
      bars.setAttribute('aria-hidden', 'true');
      series.forEach(function (item) {
        var value = Number(row[item.key]) || 0;
        var bar = document.createElement('span');
        bar.className = 'bar' + (item.className ? ' ' + item.className : '');
        bar.style.height = (value ? Math.max(4, value / Math.max(maximum, 1) * 100) : 2) + '%';
        bar.title = row.date + ': ' + item.label + ', ' + formatCount(value);
        bars.appendChild(bar);
      });
      var label = document.createElement('span');
      label.className = 'day-label';
      label.textContent = index % 5 === 0 || index === rows.length - 1 ? row.date.slice(8, 10) : '';
      column.append(bars, label);
      chart.appendChild(column);
    });
  }

  function renderStats(data) {
    var totals = data && data.totals ? data.totals : {};
    document.getElementById('accountTotal').textContent = formatCount(totals.accounts);
    document.getElementById('eventTotal').textContent = formatCount(totals.events);
    document.getElementById('participantTotal').textContent = formatCount(totals.participants);
    document.getElementById('expenseTotal').textContent = formatCount(totals.expenses);
    document.getElementById('updatedAt').textContent = formatTimestamp(data.generated_at);
    appendMoneyRows(Array.isArray(totals.amounts_by_currency) ? totals.amounts_by_currency : []);
    appendDailyChart(Array.isArray(data.daily) ? data.daily : []);
    loginPanel.hidden = true;
    dashboard.hidden = false;
    signOutButton.hidden = false;
    showNotice('', 'info');
  }

  function handleStatsError(error) {
    if (error && (error.code === '42501' || /Acceso administrativo denegado|permission denied/i.test(error.message || ''))) {
      showNotice('Esta cuenta no tiene acceso al panel. Cierra sesión para probar con la cuenta administradora.', 'error');
      loginPanel.hidden = true;
      dashboard.hidden = true;
      signOutButton.hidden = false;
      return;
    }
    if (error && (error.code === 'PGRST202' || error.code === '42883')) {
      showNotice('El panel aún no está habilitado en Supabase. Ejecuta el esquema SQL actualizado en SQL Editor.', 'error');
    } else {
      showNotice('No fue posible cargar las estadísticas. Comprueba la conexión y vuelve a intentarlo.', 'error');
    }
    loginPanel.hidden = true;
    dashboard.hidden = true;
    signOutButton.hidden = false;
  }

  async function loadStats() {
    var currentRequest = ++requestId;
    loginPanel.hidden = true;
    dashboard.hidden = true;
    signOutButton.hidden = false;
    showNotice('Cargando estadísticas…', 'info');
    var result;
    try {
      result = await window.Cloud.getAdminStats();
    } catch (error) {
      if (currentRequest === requestId) handleStatsError(error);
      return;
    }
    if (currentRequest !== requestId) return;
    if (result.error) {
      handleStatsError(result.error);
      return;
    }
    renderStats(result.data || {});
  }

  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    signInButton.disabled = true;
    showNotice('Iniciando sesión…', 'info');
    try {
      var result = await window.Cloud.signIn(
        document.getElementById('emailInput').value.trim(),
        document.getElementById('passwordInput').value
      );
      if (result.error) {
        showNotice('No se pudo iniciar sesión. Revisa el correo y la contraseña.', 'error');
        return;
      }
      await loadStats();
    } catch (error) {
      showNotice('No se pudo conectar con Supabase. Inténtalo nuevamente.', 'error');
    } finally {
      signInButton.disabled = false;
    }
  });

  signOutButton.addEventListener('click', async function () {
    signOutButton.disabled = true;
    try {
      var result = await window.Cloud.signOut();
      if (result.error) {
        showNotice('No se pudo cerrar sesión. Inténtalo nuevamente.', 'error');
        signOutButton.disabled = false;
        return;
      }
      showLogin('Sesión cerrada.');
    } catch (error) {
      showNotice('No se pudo cerrar sesión. Inténtalo nuevamente.', 'error');
      signOutButton.disabled = false;
    }
  });

  if (!window.Cloud || !window.Cloud.available) {
    showLogin('No se pudo conectar con Supabase. Revisa la configuración de la app.', 'error');
    return;
  }

  window.Cloud.onAuth(function (session, eventName) {
    if (!authReady) return;
    if (!session || eventName === 'SIGNED_OUT') showLogin('');
    else if (eventName === 'SIGNED_IN' || eventName === 'TOKEN_REFRESHED') loadStats();
  });

  window.Cloud.getSession().then(function (result) {
    authReady = true;
    if (result.error) showLogin('No se pudo recuperar la sesión. Inicia sesión nuevamente.', 'error');
    else if (result.data && result.data.session) loadStats();
    else showLogin('');
  }).catch(function () {
    authReady = true;
    showLogin('No se pudo recuperar la sesión. Inicia sesión nuevamente.', 'error');
  });
})();
