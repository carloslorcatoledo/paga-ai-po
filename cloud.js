/*
 * cloud.js — Capa de nube (Supabase): por ahora, autenticación.
 *
 * Expone window.Cloud. Si falta la config o la librería, Cloud.available = false
 * y la app sigue funcionando en modo local.
 *
 * La próxima capa agregará: guardar/leer eventos en la nube, tiempo real y
 * compartir por código.
 */
(function () {
  'use strict';

  var cfg = window.SUPABASE_CONFIG;
  var lib = window.supabase; // viene del script de @supabase/supabase-js
  var client = null;
  var activeEventChannel = null;
  var activeEventId = null;
  var activeEventPaymentsEnabled = false;

  if (cfg && cfg.url && cfg.publishableKey && lib && lib.createClient) {
    try {
      client = lib.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    } catch (e) { client = null; }
  }

  window.Cloud = {
    available: !!client,
    client: client,

    // --- Autenticación por correo + contraseña (no requiere SMTP) ---
    signUp: function (email, password, name) {
      return client.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: name } }
      });
    },
    signIn: function (email, password) {
      return client.auth.signInWithPassword({ email: email, password: password });
    },
    requestPasswordReset: function (email, redirectTo) {
      return client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    },
    updatePassword: function (password) {
      return client.auth.updateUser({ password: password });
    },
    signOut: function () { return client.auth.signOut(); },
    getSession: function () { return client.auth.getSession(); },
    ensureProfile: function () { return client.rpc('asegurar_perfil_usuario'); },
    logActivity: function (action, eventId) {
      return client.rpc('registrar_actividad_usuario', { _accion: action, _evento_id: eventId || null });
    },
    onAuth: function (cb) {
      return client.auth.onAuthStateChange(function (event, session) { cb(session, event); });
    },
    subscribeEvent: function (eventId, onChange, onStatus, includePayments) {
      includePayments = !!includePayments;
      if (activeEventChannel && activeEventId === eventId && activeEventPaymentsEnabled === includePayments) return activeEventChannel;
      if (activeEventChannel) client.removeChannel(activeEventChannel);
      activeEventId = eventId;
      activeEventPaymentsEnabled = includePayments;
      var channel = client.channel('evento-' + eventId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'evento', filter: 'id=eq.' + eventId }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participante', filter: 'evento_id=eq.' + eventId }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gasto', filter: 'evento_id=eq.' + eventId }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gasto_participante' }, onChange);
      if (includePayments) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'transferencia_pago', filter: 'evento_id=eq.' + eventId }, onChange);
      }
      activeEventChannel = channel.subscribe(function (status) { if (onStatus) onStatus(status); });
      return activeEventChannel;
    },
    unsubscribeEvent: function () {
      if (activeEventChannel) client.removeChannel(activeEventChannel);
      activeEventChannel = null; activeEventId = null; activeEventPaymentsEnabled = false;
    },

    // --- Datos (requiere sesión; la RLS filtra por miembro) ---

    // Lista los eventos del usuario (los suyos y los que le compartieron).
    listEvents: function () {
      return client.from('evento').select('id,nombre,fecha,moneda,codigo').order('fecha', { ascending: false });
    },

    // Trae un evento completo con sus participantes y gastos.
    loadEvent: async function (id) {
      var ev = await client.from('evento').select('*').eq('id', id).single();
      if (ev.error) return { error: ev.error };
      var parts = await client.from('participante').select('*').eq('evento_id', id).order('orden');
      if (parts.error && parts.error.code === '42703') parts = await client.from('participante').select('*').eq('evento_id', id);
      if (parts.error) return { error: parts.error };
      var gastos = await client.from('gasto').select('*').eq('evento_id', id).order('orden');
      if (gastos.error && gastos.error.code === '42703') gastos = await client.from('gasto').select('*').eq('evento_id', id);
      if (gastos.error) return { error: gastos.error };
      var gp = { data: [] };
      var gids = (gastos.data || []).map(function (g) { return g.id; });
      if (gids.length) {
        gp = await client.from('gasto_participante').select('*').in('gasto_id', gids).order('orden');
        if (gp.error && gp.error.code === '42703') gp = await client.from('gasto_participante').select('*').in('gasto_id', gids);
        if (gp.error) return { error: gp.error };
      }
      var payments = await client.rpc('obtener_pagos_transferencia', { _evento_id: id });
      if (payments.error && payments.error.code !== 'PGRST202') return { error: payments.error };
      return { data: { evento: ev.data, participantes: parts.data || [], gastos: gastos.data || [], gasto_participante: gp.data || [], transferencia_pagos: payments.data || [], paymentSchemaAvailable: !payments.error } };
    },

    // Guarda el snapshot completo en una transacción con control de versión.
    saveEvent: async function (s) {
      var today = new Date();
      var date = s.eventDate || [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
      var result = await client.rpc('guardar_evento_snapshot', {
        _evento_id: s.cloudId || null,
        _expected_version: s.cloudId ? s.cloudVersion : null,
        _data: {
          nombre: s.eventName || 'Evento', fecha: date, moneda: s.currency || 'CLP', tip_percent: s.tipPercent || 0,
          participantes: (s.participants || []).map(function (p) { return { id: p.id, nombre: p.name, color: p.color || null }; }),
          gastos: (s.expenses || []).map(function (e) {
            return {
              descripcion: e.description || null, monto: e.amount, categoria: e.category || 'otros',
              pagado_por: e.paidBy || null, aplica_propina: e.tip !== false, participantes: e.participants || []
            };
          })
        }
      });
      if (result.error) return { error: result.error };
      return { data: result.data };
    },

    updateTransferPayment: function (payment) {
      return client.rpc('actualizar_pago_transferencia', {
        _evento_id: payment.eventId,
        _pagador_key: payment.payerKey,
        _receptor_key: payment.receiverKey,
        _monto_deuda: payment.dueAmount,
        _monto_pagado: payment.paidAmount,
        _financial_fingerprint: payment.financialFingerprint
      });
    },

    // Unirse a un evento con su código (devuelve el id del evento).
    joinByCode: function (codigo) {
      return client.rpc('unirse_a_evento', { _codigo: codigo });
    }
  };
})();
