/*
 * Pruebas de la lógica de cálculo (calc.js).
 *
 * Cómo correrlas (requiere Node 18+):
 *   node --test
 *
 * ¿No tienes Node instalado? Abre test.html en el navegador: corre las mismas
 * pruebas sin instalar nada.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitExpense, effectiveAmount, eventTotals, computeBalances, simplifyDebts } = require('./calc.js');

// Escenario del plan reutilizable para las pruebas de propina.
const PARTS = [
  { id: 'ana', name: 'Ana' }, { id: 'beto', name: 'Beto' }, { id: 'caro', name: 'Caro' },
  { id: 'dani', name: 'Dani' }, { id: 'eli', name: 'Eli' },
];
const EXPS = [
  { amount: 20000, paidBy: 'ana', participants: ['ana', 'beto', 'caro', 'dani', 'eli'] },
  { amount: 15000, paidBy: 'beto', participants: ['ana', 'beto', 'caro'] },
  { amount: 6000, paidBy: 'dani', participants: ['dani', 'eli'] },
];

function sum(obj) {
  return Object.keys(obj).reduce((acc, k) => acc + obj[k], 0);
}

test('splitExpense: división exacta', () => {
  const r = splitExpense(20000, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(r, { a: 4000, b: 4000, c: 4000, d: 4000, e: 4000 });
  assert.equal(sum(r), 20000);
});

test('splitExpense: reparte el residuo (CLP $10.000 entre 3)', () => {
  const r = splitExpense(10000, ['a', 'b', 'c']);
  assert.deepEqual(r, { a: 3334, b: 3333, c: 3333 });
  assert.equal(sum(r), 10000); // nunca se pierde ni se inventa dinero
});

test('splitExpense: un solo participante', () => {
  assert.deepEqual(splitExpense(7777, ['a']), { a: 7777 });
});

test('splitExpense: sin participantes devuelve vacío', () => {
  assert.deepEqual(splitExpense(1000, []), {});
});

test('splitExpense: la suma siempre es exacta (muchos casos)', () => {
  for (let amount = 0; amount < 1000; amount++) {
    for (let n = 1; n <= 7; n++) {
      const ids = Array.from({ length: n }, (_, k) => 'p' + k);
      assert.equal(sum(splitExpense(amount, ids)), amount);
    }
  }
});

test('computeBalances: escenario del plan (2 no beben)', () => {
  // 5 amigos. Ana paga la pizza (todos), Beto paga las cervezas (solo bebedores).
  const participants = [
    { id: 'ana', name: 'Ana' },
    { id: 'beto', name: 'Beto' },
    { id: 'caro', name: 'Caro' },
    { id: 'dani', name: 'Dani' }, // no bebe
    { id: 'eli', name: 'Eli' },   // no bebe
  ];
  const expenses = [
    { description: 'Pizza', amount: 20000, paidBy: 'ana', participants: ['ana', 'beto', 'caro', 'dani', 'eli'] },
    { description: 'Cervezas', amount: 15000, paidBy: 'beto', participants: ['ana', 'beto', 'caro'] },
  ];
  const b = computeBalances(participants, expenses);
  const by = Object.fromEntries(b.map((x) => [x.id, x]));

  // Bebedores: 4000 (pizza) + 5000 (cerveza) = 9000. No bebedores: 4000.
  assert.equal(by.ana.owes, 9000);
  assert.equal(by.beto.owes, 9000);
  assert.equal(by.caro.owes, 9000);
  assert.equal(by.dani.owes, 4000);
  assert.equal(by.eli.owes, 4000);

  // Saldos = pagó - le_corresponde
  assert.equal(by.ana.balance, 20000 - 9000); // +11000 (le deben)
  assert.equal(by.beto.balance, 15000 - 9000); // +6000  (le deben)
  assert.equal(by.caro.balance, -9000);
  assert.equal(by.dani.balance, -4000);
  assert.equal(by.eli.balance, -4000);
});

test('computeBalances: los saldos siempre suman 0', () => {
  const participants = [
    { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' },
  ];
  const expenses = [
    { amount: 10000, paidBy: 'a', participants: ['a', 'b', 'c'] },
    { amount: 7777, paidBy: 'b', participants: ['b', 'c'] },
    { amount: 3333, paidBy: 'c', participants: ['a', 'c'] },
  ];
  const total = computeBalances(participants, expenses)
    .reduce((acc, x) => acc + x.balance, 0);
  assert.equal(total, 0);
});

test('simplifyDebts: salda todo el escenario del plan', () => {
  const balances = [
    { id: 'ana', name: 'Ana', balance: 11000 },
    { id: 'beto', name: 'Beto', balance: 6000 },
    { id: 'caro', name: 'Caro', balance: -9000 },
    { id: 'dani', name: 'Dani', balance: -4000 },
    { id: 'eli', name: 'Eli', balance: -4000 },
  ];
  const t = simplifyDebts(balances);

  // Nadie transfiere más de lo que debe / recibe más de lo que le deben.
  const recibido = {}, pagado = {};
  t.forEach((x) => {
    assert.ok(x.amount > 0);
    pagado[x.from] = (pagado[x.from] || 0) + x.amount;
    recibido[x.to] = (recibido[x.to] || 0) + x.amount;
  });
  assert.equal(recibido.ana, 11000);
  assert.equal(recibido.beto, 6000);
  assert.equal(pagado.caro, 9000);
  assert.equal(pagado.dani, 4000);
  assert.equal(pagado.eli, 4000);

  // Con 2 acreedores y 3 deudores, a lo sumo 4 transferencias (n-1).
  assert.ok(t.length <= balances.length - 1);
});

test('simplifyDebts: deuda en cadena A->B->C se paga directo A->C', () => {
  // B queda neto en 0: solo intermedió.
  const balances = [
    { id: 'A', name: 'A', balance: -100 },
    { id: 'B', name: 'B', balance: 0 },
    { id: 'C', name: 'C', balance: 100 },
  ];
  const t = simplifyDebts(balances);
  assert.equal(t.length, 1);
  assert.deepEqual(
    { from: t[0].from, to: t[0].to, amount: t[0].amount },
    { from: 'A', to: 'C', amount: 100 }
  );
});

test('integración: calcular y luego saldar deja todo en cero', () => {
  const participants = [
    { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
    { id: 'c', name: 'C' }, { id: 'd', name: 'D' },
  ];
  const expenses = [
    { amount: 23450, paidBy: 'a', participants: ['a', 'b', 'c', 'd'] },
    { amount: 9990, paidBy: 'c', participants: ['a', 'c'] },
    { amount: 4500, paidBy: 'b', participants: ['b', 'd'] },
  ];
  const balances = computeBalances(participants, expenses);
  const transfers = simplifyDebts(balances);

  // Aplicar las transferencias a los saldos debe dejar todo en 0.
  const net = Object.fromEntries(balances.map((x) => [x.id, x.balance]));
  transfers.forEach((t) => { net[t.from] += t.amount; net[t.to] -= t.amount; });
  Object.values(net).forEach((v) => assert.equal(v, 0));
});

// ---------- Propina / servicio ----------

test('effectiveAmount: aplica la propina sobre el subtotal', () => {
  assert.equal(effectiveAmount({ amount: 5000 }, 10), 5500);
  assert.equal(effectiveAmount({ amount: 5000 }, 0), 5000);
});

test('effectiveAmount: un gasto con tip:false queda exento (ej. taxi)', () => {
  assert.equal(effectiveAmount({ amount: 5000, tip: false }, 10), 5000);
  assert.equal(effectiveAmount({ amount: 5000, tip: true }, 10), 5500);
});

test('eventTotals: separa subtotal, propina y total', () => {
  assert.deepEqual(eventTotals(EXPS, 0), { subtotal: 41000, tip: 0, total: 41000 });
  assert.deepEqual(eventTotals(EXPS, 10), { subtotal: 41000, tip: 4100, total: 45100 });
});

test('computeBalances con propina 10%: valores correctos y saldos en 0', () => {
  const b = computeBalances(PARTS, EXPS, { tipPercent: 10 });
  const by = Object.fromEntries(b.map((x) => [x.id, x]));
  // Carne 22000/5=4400; Cervezas 16500/3=5500; Bebidas 6600/2=3300
  assert.equal(by.ana.owes, 9900);
  assert.equal(by.dani.owes, 7700);
  assert.equal(by.ana.balance, 12100); // pagó 22000 - debe 9900
  assert.equal(by.beto.balance, 6600);
  assert.equal(by.caro.balance, -9900);
  assert.equal(by.dani.balance, -1100);
  assert.equal(by.eli.balance, -7700);
  assert.equal(b.reduce((a, x) => a + x.balance, 0), 0);
});

test('la propina se reparte proporcional al consumo', () => {
  // A consume 1000 solo, B consume 2000 solo. Con 10%, B paga el doble de propina.
  const parts = [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }];
  const exps = [
    { amount: 1000, paidBy: 'A', participants: ['A'] },
    { amount: 2000, paidBy: 'B', participants: ['B'] },
  ];
  const sin = computeBalances(parts, exps, { tipPercent: 0 });
  const con = computeBalances(parts, exps, { tipPercent: 10 });
  const owes = (res, id) => res.find((x) => x.id === id).owes;
  const tipA = owes(con, 'A') - owes(sin, 'A'); // 100
  const tipB = owes(con, 'B') - owes(sin, 'B'); // 200
  assert.equal(tipA, 100);
  assert.equal(tipB, 200);
  assert.equal(tipB, tipA * 2);
});

test('computeBalances sin opciones = sin propina (compatibilidad)', () => {
  const a = computeBalances(PARTS, EXPS);
  const b = computeBalances(PARTS, EXPS, { tipPercent: 0 });
  assert.deepEqual(a, b);
});
