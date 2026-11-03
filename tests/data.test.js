import test from "node:test";
import assert from "node:assert/strict";
import { freshState, validateBackup, migrate } from "../data.js";
test("fresh install has no demo products", () =>
  assert.deepEqual(freshState().products, []));
test("legacy migration preserves sales/held/settings and removes stock without mutating original", () => {
  const old = {
    products: [
      {
        id: "1",
        name: "ลาเต้",
        category: "กาแฟ",
        price: 75,
        stock: 0,
        emoji: "☕",
      },
    ],
    orders: [],
    held: [],
    expenses: [],
    shift: null,
    settings: { name: "ร้านเดิม", tax: 0, address: "เดิม" },
  };
  const next = validateBackup(old);
  assert.equal(next.schemaVersion, 2);
  assert.equal(next.products[0].active, true);
  assert.equal(next.products[0].kind, "drink");
  assert.equal(next.products[0].stock, undefined);
  assert.equal(old.products[0].stock, 0);
  assert.equal(next.settings.name, "ร้านเดิม");
  assert.equal(next.settings.blendedExtra, 15);
});
test("current backup round trip preserves product photos and logo", () => {
  const s = freshState();
  const image = "data:image/png;base64,aGVsbG8=";
  s.settings.logo = image;
  s.products.push({
    id: "a",
    name: "ชา",
    category: "ชา",
    price: 50,
    image,
    kind: "drink",
    active: true,
  });
  const result = validateBackup(JSON.parse(JSON.stringify(s)));
  assert.equal(result.settings.logo, image);
  assert.equal(result.products[0].image, image);
});
test("malformed orders, image schemes, duplicate IDs and future schemas rejected", () => {
  const state = freshState();
  for (const patch of [
    { orders: [{ items: [] }] },
    { settings: { ...state.settings, logo: "javascript:alert(1)" } },
    { schemaVersion: 99 },
    {
      products: [
        { id: "a", name: "a", category: "a", price: 1 },
        { id: "a", name: "b", category: "a", price: 2 },
      ],
    },
    { held: [{ cart: [] }] },
  ])
    assert.throws(() => validateBackup({ ...state, ...patch }));
});
test("migration does not erase old paid order records", () => {
  const s = freshState();
  s.orders = [{ id: "old", total: 100 }];
  assert.deepEqual(migrate(s).orders, s.orders);
});
