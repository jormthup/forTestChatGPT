import test from "node:test";
import assert from "node:assert/strict";
import {
  totals,
  thaiDay,
  previousRange,
  buildReport,
  lineNets,
  csv,
} from "../logic.js";
import { freshState } from "../data.js";
test("discount before VAT, rounded to satang", () =>
  assert.deepEqual(totals([{ price: 75, qty: 2 }], 10, 7), {
    subtotal: 150,
    discount: 10,
    vat: 9.8,
    total: 149.8,
  }));
test("discount cannot produce negative total", () =>
  assert.equal(totals([{ price: 60, qty: 1 }], 100).total, 0));
test("Bangkok day crosses UTC boundary", () =>
  assert.equal(thaiDay("2026-11-02T18:00:00Z"), "2026-11-03"));
test("previous period is inclusive and equally long across month boundaries", () =>
  assert.deepEqual(previousRange("2026-03-01", "2026-03-07"), {
    start: "2026-02-22",
    end: "2026-02-28",
  }));
test("discount allocation preserves every satang", () => {
  const order = {
    items: [
      { price: 1, qty: 1 },
      { price: 1, qty: 1 },
      { price: 1, qty: 1 },
    ],
    discount: 0.01,
  };
  const nets = lineNets(order);
  assert.equal(Math.round(nets.reduce((s, v) => s + v, 0) * 100), 299);
  assert.deepEqual(lineNets({ ...order, discount: 3 }), [0, 0, 0]);
});
const makeOrder = (id, date, method, items, discount = 0) => ({
  id,
  date,
  method,
  items,
  ...totals(items, discount, 7),
});
test("reports exclude voids and outside dates; reconcile tax, products, categories and payments", () => {
  const state = freshState();
  const item = { id: "a", name: "ลาเต้", category: "กาแฟ", price: 75, qty: 2 };
  state.orders = [
    makeOrder("1", "2026-11-02T18:00:00Z", "เงินสด", [item], 10),
    makeOrder("2", "2026-11-03T10:00:00Z", "โอนเงิน", [{ ...item, qty: 1 }]),
    {
      ...makeOrder("3", "2026-11-03T11:00:00Z", "เงินสด", [item]),
      voided: true,
    },
    makeOrder("4", "2026-11-03T18:00:00Z", "เงินสด", [item]),
  ];
  state.expenses = [
    { name: "น้ำแข็ง", date: "2026-11-03T00:00:00Z", amount: 20 },
    { name: "นอกช่วง", date: "2026-11-04T00:00:00Z", amount: 99 },
  ];
  const r = buildReport(state, "2026-11-03", "2026-11-03");
  assert.equal(r.bills, 2);
  assert.equal(r.units, 3);
  assert.equal(r.gross, 225);
  assert.equal(r.discount, 10);
  assert.equal(r.net, 215);
  assert.equal(r.tax, 15.05);
  assert.equal(r.collected, 230.05);
  assert.equal(r.expense, 20);
  assert.equal(r.afterExpenses, 210.05);
  assert.equal(r.voidCount, 1);
  assert.equal(r.products[0].net, 215);
  assert.equal(r.products[0].qty, 3);
  assert.equal(r.categories[0].net, 215);
  assert.equal(
    r.payments.reduce((s, [, v]) => s + v, 0),
    r.collected,
  );
  assert.equal(r.hours[0].hour, 1);
});
test("legacy categories stay unknown rather than adopting edited current category", () => {
  const state = freshState();
  state.products = [{ id: "a", category: "ใหม่" }];
  state.orders = [
    makeOrder("1", "2026-11-03T00:00:00Z", "บัตร", [
      { id: "a", name: "เดิม", price: 20, qty: 1 },
    ]),
  ];
  const r = buildReport(state, "2026-11-03", "2026-11-03");
  assert.equal(r.categories[0].name, "ไม่ระบุ (บิลเก่า)");
  assert.equal(r.payments[0][0], "บัตร");
});
test("empty period has zero averages and totals", () => {
  const r = buildReport(freshState(), "2026-11-03", "2026-11-03");
  assert.equal(r.average, 0);
  assert.equal(r.collected, 0);
  assert.deepEqual(r.products, []);
});
test("CSV quotes Thai text and guards spreadsheet formulas", () => {
  const result = csv([["=1+1", 'กาแฟ,"เย็น"']]);
  assert.ok(result.includes("'="));
  assert.ok(result.includes('กาแฟ,""เย็น""'));
});
