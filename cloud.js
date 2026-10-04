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
    signUp: function (email, password) {
      return client.auth.signUp({ email: email, password: password });
    },
    signIn: function (email, password) {
      return client.auth.signInWithPassword({ email: email, password: password });
    },
    signOut: function () { return client.auth.signOut(); },
    getSession: function () { return client.auth.getSession(); },
    onAuth: function (cb) {
      return client.auth.onAuthStateChange(function (_event, session) { cb(session); });
    },

    // --- Datos (requiere sesión; la RLS filtra por miembro) ---

    // Lista los eventos del usuario (los suyos y los que le compartieron).
    listEvents: function () {
      return client.from('evento').select('id,nombre,fecha,moneda,codigo').order('created_at', { ascending: false });
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

    // Guarda el evento actual (crea o reemplaza). Modelo "snapshot".
    saveEvent: async function (s) {
      var u = await client.auth.getUser();
      var user = u && u.data ? u.data.user : null;
      if (!user) return { error: { message: 'No hay sesión activa.' } };

      var eventoId = s.cloudId || null;
      var codigo = s.codigo || null;

      if (!eventoId) {
        var ins = await client.from('evento')
          .insert({ nombre: s.eventName || 'Salida', moneda: s.currency || 'CLP', tip_percent: s.tipPercent || 0, owner: user.id })
          .select('id,codigo').single();
        if (ins.error) return { error: ins.error };
        eventoId = ins.data.id; codigo = ins.data.codigo;
      } else {
        var upd = await client.from('evento')
          .update({ nombre: s.eventName || 'Salida', moneda: s.currency || 'CLP', tip_percent: s.tipPercent || 0 })
          .eq('id', eventoId);
        if (upd.error) return { error: upd.error };
        // Borrar hijos: primero gastos (por la FK pagado_por → participante), luego participantes.
        var dg = await client.from('gasto').delete().eq('evento_id', eventoId);
        if (dg.error) return { error: dg.error };
        var dp = await client.from('participante').delete().eq('evento_id', eventoId);
        if (dp.error) return { error: dp.error };
      }

      // Participantes (se mantiene el orden input→output; mapear por índice).
      var map = {};
      if (s.participants && s.participants.length) {
        var prows = s.participants.map(function (p) { return { evento_id: eventoId, nombre: p.name, color: p.color || null }; });
        var insP = await client.from('participante').insert(prows).select('id');
        if (insP.error) return { error: insP.error };
        s.participants.forEach(function (p, i) { map[p.id] = insP.data[i].id; });
      }

      // Gastos + gasto_participante.
      if (s.expenses && s.expenses.length) {
        var grows = s.expenses.map(function (e) {
          return {
            evento_id: eventoId, descripcion: e.description || null, monto: e.amount,
            categoria: e.category || 'otros', pagado_por: map[e.paidBy] || null,
            aplica_propina: e.tip !== false
          };
        });
        var insG = await client.from('gasto').insert(grows).select('id');
        if (insG.error) return { error: insG.error };
        var gmap = {};
        s.expenses.forEach(function (e, i) { gmap[e.id] = insG.data[i].id; });

        var gprows = [];
        s.expenses.forEach(function (e) {
          (e.participants || []).forEach(function (pid) {
            if (map[pid]) gprows.push({ gasto_id: gmap[e.id], participante_id: map[pid] });
          });
        });
        if (gprows.length) {
          var insGP = await client.from('gasto_participante').insert(gprows);
          if (insGP.error) return { error: insGP.error };
        }
      }

      return { data: { id: eventoId, codigo: codigo } };
    },

    // Unirse a un evento con su código (devuelve el id del evento).
    joinByCode: function (codigo) {
      return client.rpc('unirse_a_evento', { _codigo: codigo });
    }
  };
})();
