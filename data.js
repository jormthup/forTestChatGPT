export const STORAGE_KEY = "littlecup-pos-v1";
export const VERSION = "0.2.0";
export const defaultSettings = {
  name: "กาแฟจอมทัพ",
  address: "",
  phone: "",
  tax: 0,
  logo: "",
  qr: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  receiptFooter: "ขอบคุณที่แวะมา แล้วพบกันใหม่ ☕",
  blendedExtra: 15,
  oatExtra: 15,
};
export const freshState = () => ({
  schemaVersion: 2,
  products: [],
  orders: [],
  held: [],
  expenses: [],
  shifts: [],
  shift: null,
  settings: { ...defaultSettings },
});
export function migrate(data) {
  const next = structuredClone(data);
  next.schemaVersion = 2;
  next.settings = { ...defaultSettings, ...next.settings };
  next.products = next.products.map((p) => {
    const { stock, emoji, ...rest } = p;
    return {
      ...rest,
      image: p.image || "",
      description: p.description || "",
      kind: p.kind || (p.category === "เบเกอรี" ? "food" : "drink"),
      active: p.active !== false,
    };
  });
  next.shifts ??= [];
  return next;
}
export const safeImage = (value) =>
  !value ||
  (typeof value === "string" &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
const finite = (n, min = 0) => Number.isFinite(n) && n >= min;
const text = (x) => typeof x === "string";
const date = (x) => text(x) && Number.isFinite(Date.parse(x));
const item = (i) =>
  i &&
  text(i.id) &&
  text(i.name) &&
  finite(i.price) &&
  Number.isSafeInteger(i.qty) &&
  i.qty > 0;
const shift = (x) => x && text(x.id) && date(x.date) && finite(x.opening);
export function validateBackup(d) {
  if (
    !d ||
    !Array.isArray(d.products) ||
    !Array.isArray(d.orders) ||
    !Array.isArray(d.held) ||
    !Array.isArray(d.expenses)
  )
    throw Error("โครงสร้างไฟล์สำรองไม่ถูกต้อง");
  if (d.schemaVersion && d.schemaVersion > 2)
    throw Error("ไฟล์มาจากแอปรุ่นใหม่กว่า กรุณาอัปเดตแอปก่อน");
  const s = d.settings;
  if (
    !s ||
    !text(s.name) ||
    !s.name.trim() ||
    !finite(s.tax) ||
    s.tax > 20 ||
    !safeImage(s.logo) ||
    !safeImage(s.qr)
  )
    throw Error("ข้อมูลร้านไม่ถูกต้อง");
  for (const key of ["blendedExtra", "oatExtra"])
    if (s[key] !== undefined && !finite(s[key]))
      throw Error("ราคาตัวเลือกไม่ถูกต้อง");
  if (
    !d.products.every(
      (p) =>
        p &&
        text(p.id) &&
        text(p.name) &&
        text(p.category) &&
        finite(p.price) &&
        safeImage(p.image),
    )
  )
    throw Error("ข้อมูลเมนูไม่ถูกต้อง");
  if (new Set(d.products.map((p) => p.id)).size !== d.products.length)
    throw Error("รหัสเมนูซ้ำ");
  if (
    !d.orders.every(
      (o) =>
        o &&
        text(o.id) &&
        text(o.number) &&
        date(o.date) &&
        text(o.method) &&
        [
          "subtotal",
          "discount",
          "vat",
          "total",
          "received",
          "change",
          "taxRate",
        ].every((k) => finite(o[k])) &&
        Array.isArray(o.items) &&
        o.items.length &&
        o.items.every(item),
    )
  )
    throw Error("ข้อมูลบิลไม่ถูกต้อง");
  if (
    !d.held.every(
      (h) =>
        h &&
        text(h.id) &&
        Array.isArray(h.cart) &&
        h.cart.length &&
        h.cart.every(item) &&
        finite(h.discount) &&
        text(h.mode),
    )
  )
    throw Error("บิลพักไม่ถูกต้อง");
  if (
    !d.expenses.every(
      (x) => x && text(x.name) && date(x.date) && finite(x.amount),
    )
  )
    throw Error("รายจ่ายไม่ถูกต้อง");
  if (d.shift && !shift(d.shift)) throw Error("ข้อมูลกะไม่ถูกต้อง");
  if (
    d.shifts &&
    (!Array.isArray(d.shifts) ||
      !d.shifts.every(
        (x) =>
          shift(x) &&
          date(x.closed) &&
          finite(x.counted) &&
          Number.isFinite(x.expected) &&
          Number.isFinite(x.difference),
      ))
  )
    throw Error("ประวัติกะไม่ถูกต้อง");
  return migrate(d);
}
