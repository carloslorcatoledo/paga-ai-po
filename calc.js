/*
 * calc.js — El "corazón" de Reparte: la lógica de división de cuentas.
 *
 * Es un módulo PURO (sin interfaz, sin almacenamiento): recibe datos y
 * devuelve números. Eso lo hace fácil de probar (ver calc.test.js y test.html).
 *
 * Funciona en el navegador (<script src="calc.js">) y en Node (require),
 * gracias al pequeño envoltorio UMD de más abajo.
 *
 * CONVENCIÓN DE DINERO: todos los montos se manejan en ENTEROS, en la unidad
 * mínima de la moneda ("minor units"):
 *   - CLP (0 decimales): 1 unidad = 1 peso.    $12.000 -> 12000
 *   - USD (2 decimales): 1 unidad = 1 centavo.  $12,50  -> 1250
 * Trabajar con enteros evita los errores de redondeo típicos de los decimales.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api; // Node / CommonJS
  } else {
    root.Reparte = api;   // Navegador: window.Reparte
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Divide un monto entero entre varios participantes, repartiendo el residuo
   * de forma justa (los primeros participantes asumen el "sobrante" de a 1).
   *
   * Ejemplo CLP: splitExpense(10000, ['a','b','c'])
   *   -> { a: 3334, b: 3333, c: 3333 }   (suma exacta = 10000)
   *
   * @param {number} amount - monto total en unidades enteras (>= 0)
   * @param {string[]} participantIds - ids de quienes consumieron este ítem
   * @returns {Object<string, number>} cuota por participante (suman exactamente amount)
   */
  function splitExpense(amount, participantIds) {
    var shares = {};
    var n = participantIds.length;
    if (n === 0) return shares;
    var total = Math.round(amount);
    var base = Math.floor(total / n);
    var remainder = total - base * n; // 0 .. n-1 : pesos/centavos sobrantes
    for (var i = 0; i < n; i++) {
      shares[participantIds[i]] = base + (i < remainder ? 1 : 0);
    }
    return shares;
  }

  /**
   * Monto EFECTIVO de un gasto: subtotal + propina (si corresponde).
   * La propina es un porcentaje del evento; cada gasto puede excluirla con
   * `tip: false` (p. ej. un taxi). Se calcula sobre el subtotal, en enteros.
   * @param {{amount:number, tip?:boolean}} e
   * @param {number} tipPercent - porcentaje de propina (0 = sin propina)
   * @returns {number}
   */
  function effectiveAmount(e, tipPercent) {
    var amount = Math.round(e.amount);
    var applies = e.tip !== false; // sin el campo -> sí aplica
    if (!tipPercent || !applies) return amount;
    return Math.round(amount * (1 + tipPercent / 100));
  }

  /**
   * Totales del evento: subtotal (sin propina), propina y total.
   * @param {Array} expenses
   * @param {number} [tipPercent]
   * @returns {{subtotal:number, tip:number, total:number}}
   */
  function eventTotals(expenses, tipPercent) {
    tipPercent = tipPercent || 0;
    var subtotal = 0, total = 0;
    expenses.forEach(function (e) {
      subtotal += Math.round(e.amount);
      total += effectiveAmount(e, tipPercent);
    });
    return { subtotal: subtotal, tip: total - subtotal, total: total };
  }

  /**
   * Calcula, por cada participante: lo que pagó, lo que le corresponde (cuota)
   * y su saldo = pagó - le_corresponde. La propina se reparte de forma
   * proporcional al consumo de cada uno (va incluida en el monto efectivo).
   *   saldo > 0  -> le deben (es acreedor)
   *   saldo < 0  -> debe     (es deudor)
   *   saldo = 0  -> al día
   *
   * @param {Array<{id:string,name:string}>} participants
   * @param {Array<{amount:number,paidBy:string,participants:string[],tip?:boolean}>} expenses
   * @param {{tipPercent?:number}} [options]
   * @returns {Array<{id,name,paid,owes,balance}>}
   */
  function computeBalances(participants, expenses, options) {
    var tipPercent = (options && options.tipPercent) || 0;
    var paid = {};
    var owes = {};
    participants.forEach(function (p) { paid[p.id] = 0; owes[p.id] = 0; });

    expenses.forEach(function (e) {
      var amount = effectiveAmount(e, tipPercent); // subtotal + propina
      if (paid.hasOwnProperty(e.paidBy)) paid[e.paidBy] += amount;
      var shares = splitExpense(amount, e.participants || []);
      for (var pid in shares) {
        if (owes.hasOwnProperty(pid)) owes[pid] += shares[pid];
      }
    });

    return participants.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        paid: paid[p.id],
        owes: owes[p.id],
        balance: paid[p.id] - owes[p.id],
      };
    });
  }

  /**
   * Simplifica las deudas para minimizar el número de transferencias.
   * Heurística estándar: emparejar repetidamente al mayor deudor con el mayor
   * acreedor hasta saldar todo. Como trabaja sobre los SALDOS NETOS, las deudas
   * en cadena se resuelven solas: si A le debe a B y B le debe a C lo mismo,
   * B queda en 0 y el resultado es "A le paga directo a C".
   *
   * @param {Array<{id,name,balance}>} balances - salida de computeBalances
   * @returns {Array<{from,fromName,to,toName,amount}>} transferencias a realizar
   */
  function simplifyDebts(balances) {
    var creditors = [];
    var debtors = [];
    balances.forEach(function (b) {
      if (b.balance > 0) creditors.push({ id: b.id, name: b.name, amount: b.balance });
      else if (b.balance < 0) debtors.push({ id: b.id, name: b.name, amount: -b.balance });
    });
    // mayor primero
    creditors.sort(function (a, b) { return b.amount - a.amount; });
    debtors.sort(function (a, b) { return b.amount - a.amount; });

    var transfers = [];
    var i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      var d = debtors[i], c = creditors[j];
      var amt = Math.min(d.amount, c.amount);
      if (amt > 0) {
        transfers.push({
          from: d.id, fromName: d.name,
          to: c.id, toName: c.name,
          amount: amt,
        });
      }
      d.amount -= amt;
      c.amount -= amt;
      if (d.amount === 0) i++;
      if (c.amount === 0) j++;
    }
    return transfers;
  }

  return {
    splitExpense: splitExpense,
    effectiveAmount: effectiveAmount,
    eventTotals: eventTotals,
    computeBalances: computeBalances,
    simplifyDebts: simplifyDebts,
  };
});
