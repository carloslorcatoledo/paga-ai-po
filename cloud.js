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
    signOut: function () { return client.auth.signOut(); },
    getSession: function () { return client.auth.getSession(); },
    ensureProfile: function () { return client.rpc('asegurar_perfil_usuario'); },
    logActivity: function (action, eventId) {
      return client.rpc('registrar_actividad_usuario', { _accion: action, _evento_id: eventId || null });
    },
    onAuth: function (cb) {
      return client.auth.onAuthStateChange(function (_event, session) { cb(session); });
    },
    subscribeEvent: function (eventId, onChange, onStatus) {
      if (activeEventChannel && activeEventId === eventId) return activeEventChannel;
      if (activeEventChannel) client.removeChannel(activeEventChannel);
      activeEventId = eventId;
      activeEventChannel = client.channel('evento-' + eventId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'evento', filter: 'id=eq.' + eventId }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participante', filter: 'evento_id=eq.' + eventId }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gasto', filter: 'evento_id=eq.' + eventId }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gasto_participante' }, onChange)
        .subscribe(function (status) { if (onStatus) onStatus(status); });
      return activeEventChannel;
    },
    unsubscribeEvent: function () {
      if (activeEventChannel) client.removeChannel(activeEventChannel);
      activeEventChannel = null; activeEventId = null;
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
      var parts = await client.from('participante').select('*').eq('evento_id', id);
      if (parts.error) return { error: parts.error };
      var gastos = await client.from('gasto').select('*').eq('evento_id', id);
      if (gastos.error) return { error: gastos.error };
      var gp = { data: [] };
      var gids = (gastos.data || []).map(function (g) { return g.id; });
      if (gids.length) {
        gp = await client.from('gasto_participante').select('*').in('gasto_id', gids);
        if (gp.error) return { error: gp.error };
      }
      return { data: { evento: ev.data, participantes: parts.data || [], gastos: gastos.data || [], gasto_participante: gp.data || [] } };
    },

    // Guarda el snapshot completo en una transacción con control de versión.
    saveEvent: async function (s) {
      var today = new Date();
      var date = s.eventDate || [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
      var result = await client.rpc('guardar_evento_snapshot', {
        _evento_id: s.cloudId || null,
        _expected_version: s.cloudId ? s.cloudVersion : null,
        _data: {
          nombre: s.eventName || 'Salida', fecha: date, moneda: s.currency || 'CLP', tip_percent: s.tipPercent || 0,
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

    // Unirse a un evento con su código (devuelve el id del evento).
    joinByCode: function (codigo) {
      return client.rpc('unirse_a_evento', { _codigo: codigo });
    }
  };
})();
