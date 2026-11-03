export const money = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(
    n,
  );
export function totals(cart, discount = 0, tax = 0) {
  const subtotal =
    Math.round(cart.reduce((s, x) => s + x.price * x.qty, 0) * 100) / 100;
  const reduction = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const net = subtotal - reduction;
  const vat = Math.round(net * tax) / 100;
  return {
    subtotal,
    discount: reduction,
    vat,
    total: Math.round((net + vat) * 100) / 100,
  };
}
export function thaiDay(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
export function addDays(day, count) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function previousRange(start, end) {
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  return { start: addDays(start, -days), end: addDays(start, -1) };
}
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
// Allocate order discounts in satang, including extras, without losing rounding cents.
export function lineNets(order) {
  const gross = order.items.map((i) => Math.round(i.price * i.qty * 100));
  const total = gross.reduce((s, n) => s + n, 0);
  const target = Math.max(0, total - Math.round(order.discount * 100));
  const raw = gross.map((n) => (total ? (n / total) * target : 0));
  const cents = raw.map(Math.floor);
  let left = target - cents.reduce((s, n) => s + n, 0);
  const indices = raw
    .map((n, i) => i)
    .sort((a, b) => raw[b] - cents[b] - (raw[a] - cents[a]));
  for (const i of indices) if (left-- > 0) cents[i]++;
  return cents.map((n) => n / 100);
}
export function buildReport(state, start, end) {
  const within = (x) => {
    const d = thaiDay(x.date);
    return d >= start && d <= end;
  };
  const all = state.orders.filter(within),
    orders = all.filter((o) => !o.voided);
  const expenses = state.expenses.filter(within);
  const sum = (key) => round(orders.reduce((s, o) => s + o[key], 0));
  const gross = sum("subtotal"),
    discount = sum("discount"),
    tax = sum("vat"),
    collected = sum("total");
  const byProduct = new Map(),
    byCategory = new Map(),
    byDay = new Map(),
    byHour = new Map(),
    payments = new Map();
  let units = 0;
  for (const order of orders) {
    payments.set(
      order.method,
      round((payments.get(order.method) || 0) + order.total),
    );
    const day = thaiDay(order.date);
    byDay.set(day, round((byDay.get(day) || 0) + order.total));
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(order.date)),
    );
    const h = byHour.get(hour) || { hour, bills: 0, collected: 0 };
    h.bills++;
    h.collected = round(h.collected + order.total);
    byHour.set(hour, h);
    const nets = lineNets(order);
    order.items.forEach((item, i) => {
      units += item.qty;
      const key = item.id;
      const p = byProduct.get(key) || {
        id: key,
        name: item.name,
        qty: 0,
        net: 0,
      };
      p.name = item.name;
      p.qty += item.qty;
      p.net = round(p.net + nets[i]);
      byProduct.set(key, p);
      // Never infer historical categories from the current editable product catalog.
      const category = item.category || "ไม่ระบุ (บิลเก่า)";
      const c = byCategory.get(category) || { name: category, qty: 0, net: 0 };
      c.qty += item.qty;
      c.net = round(c.net + nets[i]);
      byCategory.set(category, c);
    });
  }
  const expense = round(expenses.reduce((s, x) => s + x.amount, 0));
  return {
    start,
    end,
    orders,
    expenses,
    gross,
    discount,
    tax,
    collected,
    net: round(gross - discount),
    expense,
    afterExpenses: round(collected - expense),
    bills: orders.length,
    units,
    average: orders.length ? round(collected / orders.length) : 0,
    voidCount: all.length - orders.length,
    voidTotal: round(
      all.filter((o) => o.voided).reduce((s, o) => s + o.total, 0),
    ),
    products: [...byProduct.values()].sort(
      (a, b) => b.qty - a.qty || b.net - a.net,
    ),
    categories: [...byCategory.values()].sort((a, b) => b.net - a.net),
    days: [...byDay].sort(([a], [b]) => a.localeCompare(b)),
    hours: [...byHour.values()].sort((a, b) => a.hour - b.hour),
    payments: [...payments],
  };
}
export function csv(rows) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value ?? "");
            if (typeof value === "string" && /^[=+\-@\t\r]/.test(s))
              s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
