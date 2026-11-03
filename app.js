import {
  money,
  totals,
  thaiDay,
  addDays,
  previousRange,
  buildReport,
  csv,
} from "./logic.js";
import {
  STORAGE_KEY,
  VERSION,
  freshState,
  validateBackup,
  safeImage,
} from "./data.js";
import { readImage } from "./media.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const today = () => thaiDay(Date.now());
let state, loadError, rawBackup;
try {
  rawBackup = localStorage.getItem(STORAGE_KEY);
  state = rawBackup ? validateBackup(JSON.parse(rawBackup)) : freshState();
} catch (e) {
  loadError = e;
}
let page = "sell",
  category = "ทั้งหมด",
  query = "",
  cart = [],
  discount = 0,
  mode = "กลับบ้าน";
let reportStart = today(),
  reportEnd = today(),
  reportPreset = "today";
function commit(mutator) {
  const next = structuredClone(state);
  try {
    mutator(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return true;
  } catch (e) {
    notify("บันทึกไม่สำเร็จ ข้อมูลเดิมยังอยู่ กรุณาสำรองหรือลดขนาดรูป");
    console.error(e.name);
    return false;
  }
}
let toastTimer;
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
function modal(html) {
  $("#modal").innerHTML = html;
  $("#modal").showModal();
}
function close() {
  $("#modal").close();
}
function download(data, name, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function photo(src, alt, className = "") {
  return src && safeImage(src)
    ? `<img class="${className}" src="${esc(src)}" alt="${esc(alt)}">`
    : '<span class="photo-placeholder" aria-label="ยังไม่มีรูป">▧</span>';
}
const categories = () => [
  ...new Set(state.products.filter((p) => p.active).map((p) => p.category)),
];
const activeOrders = () => state.orders.filter((o) => !o.voided);
function render() {
  const nav = [
    ["sell", "▦", "ขายหน้าร้าน"],
    ["orders", "▤", "รายการขาย"],
    ["products", "◈", "จัดการเมนู"],
    ["report", "◷", "รายงาน"],
    ["settings", "⚙", "ตั้งค่าร้าน"],
  ];
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><div class="brand">${state.settings.logo ? photo(state.settings.logo, "โลโก้ร้าน") : "☕"}</div>${nav.map(([id, icon, name]) => `<button class="nav ${page === id ? "active" : ""}" data-page="${id}"><span>${icon}</span>${name}</button>`).join("")}<small>ทดลอง · v${VERSION}</small></aside><main class="workspace"><header><div><p class="muted">${esc(state.settings.name)} / พื้นที่ทำงาน</p><h1>${{ sell: "พร้อมเสิร์ฟความสุข ☀", orders: "รายการขาย", products: "จัดการเมนูร้าน", report: "รายงานเพื่อวางแผนร้าน", settings: "ตั้งค่าร้าน" }[page]}</h1><p class="muted">${new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeZone: "Asia/Bangkok" }).format(new Date())}</p></div><span class="badge">● บันทึกบนอุปกรณ์นี้</span></header><section id="content"></section></main></div>`;
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        page = b.dataset.page;
        render();
      }),
  );
  ({
    sell: renderSell,
    orders: renderOrders,
    products: renderProducts,
    report: renderReport,
    settings: renderSettings,
  })[page]();
}
function renderSell() {
  if (category !== "ทั้งหมด" && !categories().includes(category))
    category = "ทั้งหมด";
  const products = state.products.filter(
    (p) =>
      p.active &&
      (category === "ทั้งหมด" || p.category === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const total = totals(cart, discount, state.settings.tax);
  $("#content").innerHTML =
    `<div class="selling"><div><input class="search" id="search" placeholder="⌕ ค้นหาเมนู…" aria-label="ค้นหาเมนู" value="${esc(query)}"><div class="toolbar">${["ทั้งหมด", ...categories()].map((c) => `<button class="chip ${category === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div><div class="grid">${products.map((p) => `<button class="product" data-product="${esc(p.id)}"><div class="art">${photo(p.image, p.name)}</div><p>${esc(p.name)}</p>${p.description ? `<div class="muted product-description">${esc(p.description)}</div>` : ""}<div class="price"><strong>${money(p.price)}</strong><span class="plus">+</span></div></button>`).join("")}</div>${products.length ? "" : `<div class="panel empty"><span>☕</span>${state.products.some((p) => p.active) ? "ไม่พบเมนูที่ค้นหา" : "ยังไม่มีเมนู เปิดหน้าจัดการเมนูเพื่อเพิ่มชื่อ ราคา และรูปสินค้าของร้าน"}</div>`}</div><aside class="panel cart"><div class="row"><h2>ออเดอร์ปัจจุบัน</h2><button class="textbtn danger" id="clear">ล้าง</button></div><div class="toolbar" style="margin-top:16px">${["กลับบ้าน", "ทานที่ร้าน"].map((m) => `<button class="chip ${mode === m ? "active" : ""}" data-mode="${m}">${m}</button>`).join("")}</div><div class="cart-items">${cart.length ? cart.map((x, i) => `<div class="line"><div class="row"><strong>${esc(x.name)}</strong><span>${money(x.price * x.qty)}</span></div><p class="muted">${esc(x.options)}</p>${x.note ? `<p class="muted">หมายเหตุ: ${esc(x.note)}</p>` : ""}<div class="qty"><button data-qty="${i}" data-delta="-1" aria-label="ลดจำนวน">−</button>${x.qty}<button data-qty="${i}" data-delta="1" aria-label="เพิ่มจำนวน">+</button></div></div>`).join("") : '<div class="empty"><span>☕</span>เลือกเมนูเพื่อเริ่มออเดอร์</div>'}</div><div class="summary"><div class="row"><span>ยอดรวม</span><span>${money(total.subtotal)}</span></div><div class="row"><label for="discount">ส่วนลด (บาท)</label><input id="discount" type="number" min="0" step="0.01" value="${discount}" style="width:100px"></div>${state.settings.tax ? `<div class="row"><span>VAT ${state.settings.tax}% (บวกเพิ่ม)</span><span>${money(total.vat)}</span></div>` : ""}<div class="row grand"><strong>ชำระทั้งหมด</strong><strong>${money(total.total)}</strong></div></div><button class="primary full" id="pay" ${cart.length ? "" : "disabled"}>รับชำระเงิน →</button><div class="row"><button class="full" id="hold" ${cart.length ? "" : "disabled"}>พักบิล</button><button class="full" id="held">บิลพัก (${state.held.length})</button></div></aside></div>`;
  $("#search").oninput = (e) => {
    const pos = e.target.selectionStart;
    query = e.target.value;
    renderSell();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  };
  document.querySelectorAll("[data-cat]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.cat;
        renderSell();
      }),
  );
  document
    .querySelectorAll("[data-product]")
    .forEach((b) => (b.onclick = () => productModal(b.dataset.product)));
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        renderSell();
      }),
  );
  document.querySelectorAll("[data-qty]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.qty;
        cart[i].qty += +b.dataset.delta;
        if (!cart[i].qty) cart.splice(i, 1);
        renderSell();
      }),
  );
  $("#discount").onchange = (e) => {
    discount = Math.max(0, +e.target.value || 0);
    renderSell();
  };
  $("#clear").onclick = () => {
    if (!cart.length || confirm("ล้างออเดอร์ปัจจุบัน?")) {
      cart = [];
      discount = 0;
      renderSell();
    }
  };
  $("#pay").onclick = payment;
  $("#hold").onclick = () => {
    if (
      commit((s) =>
        s.held.push({
          id: crypto.randomUUID(),
          cart: structuredClone(cart),
          discount,
          mode,
          time: new Date().toISOString(),
        }),
      )
    ) {
      cart = [];
      discount = 0;
      renderSell();
      notify("พักบิลแล้ว");
    }
  };
  $("#held").onclick = () => {
    modal(
      `<h2>บิลที่พักไว้</h2>${state.held.map((h, i) => `<div class="line row"><div>${h.cart.map((x) => esc(x.name) + " ×" + x.qty).join("<br>")}<p>${money(totals(h.cart, h.discount, state.settings.tax).total)}</p></div><button data-resume="${i}">เรียกบิล</button></div>`).join("") || '<p class="empty">ไม่มีบิลพัก</p>'}<button class="full" id="done">ปิด</button>`,
    );
    $("#done").onclick = close;
    document.querySelectorAll("[data-resume]").forEach(
      (b) =>
        (b.onclick = () => {
          if (cart.length) return notify("พักหรือล้างบิลปัจจุบันก่อน");
          const h = structuredClone(state.held[+b.dataset.resume]);
          if (commit((s) => s.held.splice(+b.dataset.resume, 1))) {
            cart = h.cart;
            discount = h.discount;
            mode = h.mode;
            close();
            renderSell();
          }
        }),
    );
  };
}
function productModal(id) {
  const p = state.products.find((p) => p.id === id),
    drink = p.kind === "drink";
  modal(
    `<div class="row modal-head"><h2>${esc(p.name)}</h2><button id="cancel" aria-label="ปิด">✕</button></div>${p.image ? `<div class="item-photo">${photo(p.image, p.name)}</div>` : ""}${p.description ? `<p class="muted">${esc(p.description)}</p>` : ""}<form class="form" id="add-form">${drink ? `<label>รูปแบบ</label><div class="option">${["เย็น", "ร้อน", "ปั่น (+" + state.settings.blendedExtra + ")"].map((v, i) => `<label><input type="radio" name="type" value="${i}" ${i === 0 ? "checked" : ""}>${v}</label>`).join("")}</div><label>ระดับความหวาน<select name="sweet"><option>หวานปกติ 100%</option><option>หวานน้อย 50%</option><option>หวานน้อยมาก 25%</option><option>ไม่หวาน 0%</option></select></label><label>นม<select name="milk"><option value="0">นมปกติ</option><option value="${state.settings.oatExtra}">นมโอ๊ต (+${state.settings.oatExtra})</option></select></label>` : ""}<label>หมายเหตุ<input name="note" maxlength="120" placeholder="เช่น แยกน้ำแข็ง"></label><button class="primary">เพิ่มลงออเดอร์ · เริ่มต้น ${money(p.price)}</button></form>`,
  );
  $("#cancel").onclick = close;
  $("#add-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      type = +f.get("type");
    cart.push({
      id: p.id,
      name: p.name,
      category: p.category,
      price:
        p.price +
        (drink
          ? (type === 2 ? state.settings.blendedExtra : 0) +
            Number(f.get("milk"))
          : 0),
      qty: 1,
      options: drink
        ? [
            ["เย็น", "ร้อน", "ปั่น"][type],
            f.get("sweet"),
            f.get("milk") === "0" ? "นมปกติ" : "นมโอ๊ต",
          ].join(" · ")
        : "",
      note: f.get("note"),
    });
    close();
    renderSell();
  };
}
function payment() {
  if (!cart.length) return;
  const t = totals(cart, discount, state.settings.tax),
    settings = state.settings;
  modal(
    `<h2>รับชำระเงิน</h2><p class="muted">${mode} · ${cart.reduce((s, x) => s + x.qty, 0)} รายการ</p><h1 style="margin:20px 0">${money(t.total)}</h1><form class="form" id="payment"><label>ช่องทางชำระ<select id="method" name="method"><option>เงินสด</option><option>โอนเงิน</option></select></label><div id="transfer-info" hidden><p class="note">ตรวจสอบยอดเงินเข้าจากธนาคารก่อนยืนยัน ระบบนี้บันทึกยอดเท่านั้น</p>${settings.qr ? `<div class="qr-view">${photo(settings.qr, "QR รับเงินของร้าน")}<p>ระบุยอด ${money(t.total)}</p></div>` : '<p class="muted">ยังไม่ได้เพิ่ม QR รับเงินในหน้าตั้งค่า</p>'}<p>${esc(settings.bankName)} ${esc(settings.accountNumber)}</p><p>${esc(settings.accountName)}</p></div><label id="cash-label">รับเงินมา<input id="cash" name="cash" type="number" min="${t.total}" step="0.01" value="${t.total}" required></label><p id="change">เงินทอน ${money(0)}</p><label>ชื่อลูกค้า / เลขโต๊ะ<input name="customer" maxlength="60" placeholder="ไม่ระบุก็ได้"></label><button class="primary">ยืนยันการชำระเงิน</button><button type="button" id="cancel">กลับ</button></form>`,
  );
  $("#cancel").onclick = close;
  $("#cash").oninput = () =>
    ($("#change").textContent =
      "เงินทอน " + money(Math.max(0, +$("#cash").value - t.total)));
  $("#method").onchange = () => {
    const cash = $("#method").value === "เงินสด";
    $("#cash-label").hidden = !cash;
    $("#transfer-info").hidden = cash;
    $("#change").hidden = !cash;
    $("#cash").required = cash;
    $("#cash").disabled = !cash;
  };
  $("#payment").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      method = f.get("method"),
      received = method === "เงินสด" ? Number(f.get("cash")) : t.total;
    if (!Number.isFinite(received) || received < t.total) return;
    const order = {
      id: crypto.randomUUID(),
      number: "LC-" + String(state.orders.length + 1).padStart(5, "0"),
      date: new Date().toISOString(),
      items: structuredClone(cart),
      ...t,
      taxRate: state.settings.tax,
      method,
      received,
      change: Math.round((received - t.total) * 100) / 100,
      customer: f.get("customer"),
      mode,
      shiftId: state.shift?.id || null,
      shop: {
        name: settings.name,
        address: settings.address,
        phone: settings.phone,
        receiptFooter: settings.receiptFooter,
      },
    };
    if (!commit((s) => s.orders.push(order))) return;
    cart = [];
    discount = 0;
    close();
    renderSell();
    receipt(order);
  };
}
function receipt(o) {
  const shop = o.shop || state.settings;
  modal(
    `<div class="receipt">${state.settings.logo ? photo(state.settings.logo, "โลโก้ร้าน", "receipt-logo") : ""}<h2>${esc(shop.name)}</h2><p>${esc(shop.address)}</p><p>${esc(shop.phone)}</p><p>ใบเสร็จรับเงิน${o.voided ? " · ยกเลิกแล้ว" : ""}</p><p>${esc(o.number)}<br>${new Date(o.date).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p><hr><p>${esc(o.mode)} ${esc(o.customer)}</p>${o.items.map((x) => `<div class="row"><span>${esc(x.name)} ×${x.qty}</span><span>${money(x.price * x.qty)}</span></div><small>${esc(x.options)} ${esc(x.note)}</small>`).join("")}<hr><div class="row"><span>ก่อนส่วนลด</span><span>${money(o.subtotal)}</span></div><div class="row"><span>ส่วนลด</span><span>${money(o.discount)}</span></div><div class="row"><span>VAT ${o.taxRate}%</span><span>${money(o.vat)}</span></div><div class="row"><strong>ยอดสุทธิ</strong><strong>${money(o.total)}</strong></div><div class="row"><span>${esc(o.method)}</span><span>${money(o.received)}</span></div><div class="row"><span>เงินทอน</span><span>${money(o.change)}</span></div><hr><p>${esc(shop.receiptFooter || "")}</p><p><small>เอกสารนี้ไม่ใช่ใบกำกับภาษีเต็มรูปแบบ</small></p></div><button class="primary full no-print" id="print">พิมพ์ใบเสร็จ</button><button class="full no-print" id="done">ปิด</button>`,
  );
  $("#print").onclick = () => window.print();
  $("#done").onclick = close;
}
function renderOrders() {
  $("#content").innerHTML =
    `<div class="panel"><div class="row"><h2>ประวัติทั้งหมด (${state.orders.length})</h2><button id="export">ส่งออก CSV</button></div><div class="table-wrap"><table><thead><tr><th>บิล / เวลา</th><th>ลูกค้า</th><th>ชำระผ่าน</th><th>ยอดสุทธิ</th><th>สถานะ / เหตุผล</th><th></th></tr></thead><tbody>${[
      ...state.orders,
    ]
      .reverse()
      .map(
        (o) =>
          `<tr><td><strong>${esc(o.number)}</strong><p class="muted">${new Date(o.date).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></td><td>${esc(o.customer) || "ทั่วไป"}</td><td>${esc(o.method)}</td><td>${money(o.total)}</td><td>${o.voided ? "ยกเลิก · " + esc(o.voidReason) : "ชำระแล้ว"}</td><td><button data-receipt="${esc(o.id)}">ใบเสร็จ</button> ${o.voided ? "" : `<button class="textbtn danger" data-void="${esc(o.id)}">ยกเลิก</button>`}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table>${state.orders.length ? "" : '<p class="empty">ยังไม่มีรายการขาย</p>'}</div></div>`;
  document
    .querySelectorAll("[data-receipt]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          receipt(state.orders.find((o) => o.id === b.dataset.receipt))),
    );
  document.querySelectorAll("[data-void]").forEach(
    (b) =>
      (b.onclick = () => {
        const reason = prompt(
          "เหตุผลการยกเลิก (หักออกจากรายงาน ไม่ได้คืนเงินผ่านธนาคาร)",
        );
        if (!reason?.trim()) return;
        if (
          commit((s) =>
            Object.assign(
              s.orders.find((o) => o.id === b.dataset.void),
              {
                voided: true,
                voidReason: reason.trim(),
                voidDate: new Date().toISOString(),
              },
            ),
          )
        )
          renderOrders();
      }),
  );
  $("#export").onclick = () =>
    download(
      csv([
        [
          "เลขบิล",
          "เวลา UTC",
          "ยอดก่อนส่วนลด",
          "ส่วนลด",
          "VAT",
          "รับชำระ",
          "ช่องทาง",
          "สถานะ",
          "เหตุผลยกเลิก",
        ],
        ...state.orders.map((o) => [
          o.number,
          o.date,
          o.subtotal,
          o.discount,
          o.vat,
          o.total,
          o.method,
          o.voided ? "ยกเลิก" : "ชำระแล้ว",
          o.voidReason || "",
        ]),
      ]),
      "sales.csv",
    );
}
let showArchived = false;
function renderProducts() {
  const products = state.products.filter((p) => showArchived || p.active);
  $("#content").innerHTML =
    `<div class="panel"><div class="row"><div><h2>เมนูร้าน (${products.length})</h2><p class="muted">เพิ่มข้อมูลและรูปของร้านทีละรายการ · ไม่มีระบบสต็อก</p></div><button class="primary" id="new">+ เพิ่มเมนู</button></div><label class="check-line"><input id="show-archived" type="checkbox" ${showArchived ? "checked" : ""}> แสดงเมนูที่ซ่อนด้วย</label><div class="table-wrap"><table><thead><tr><th>รูป / เมนู</th><th>หมวดหมู่ / แท็ก</th><th>ราคา</th><th>สถานะ</th><th></th></tr></thead><tbody>${products.map((p) => `<tr><td><div class="catalog-item"><div class="catalog-photo">${photo(p.image, p.name)}</div><div><strong>${esc(p.name)}</strong><p class="muted">${esc(p.description)}</p></div></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.active ? "แสดงหน้าขาย" : "ซ่อน"}</td><td><button data-edit="${esc(p.id)}">แก้ไข</button> <button class="textbtn" data-toggle="${esc(p.id)}">${p.active ? "ซ่อนเมนู" : "แสดงเมนู"}</button></td></tr>`).join("")}</tbody></table>${products.length ? "" : '<p class="empty">เริ่มด้วยปุ่ม + เพิ่มเมนู เพื่อใส่ข้อมูลและรูปสินค้าของคุณ</p>'}</div></div>`;
  $("#show-archived").onchange = (e) => {
    showArchived = e.target.checked;
    renderProducts();
  };
  $("#new").onclick = () => editProduct();
  document
    .querySelectorAll("[data-edit]")
    .forEach((b) => (b.onclick = () => editProduct(b.dataset.edit)));
  document.querySelectorAll("[data-toggle]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          commit((s) => {
            const p = s.products.find((p) => p.id === b.dataset.toggle);
            p.active = !p.active;
          })
        )
          renderProducts();
      }),
  );
}
function editProduct(id) {
  const p = state.products.find((p) => p.id === id) || {
    name: "",
    category: "",
    price: 0,
    image: "",
    description: "",
    kind: "drink",
    active: true,
  };
  let image = p.image;
  modal(
    `<h2>${id ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}</h2><form class="form" id="product-form" style="margin-top:20px"><div id="product-preview" class="upload-preview">${photo(image, "รูปสินค้า")}</div><label>รูปสินค้า<input id="product-image" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="remove-image">ลบรูป</button><p class="muted">รองรับรูปไม่เกิน 8 MB ระบบย่อก่อนบันทึก · หากไม่มีรูปจะแสดงช่องว่างแทน</p><label>ชื่อเมนู<input name="name" value="${esc(p.name)}" maxlength="60" required></label><label>รายละเอียด<input name="description" value="${esc(p.description)}" maxlength="180"></label><label>หมวดหมู่ / แท็กบนหน้าขาย<input name="category" list="categories" value="${esc(p.category)}" maxlength="30" placeholder="เลือกหรือพิมพ์หมวดใหม่ เช่น กาแฟพิเศษ" required></label><datalist id="categories">${[...new Set(state.products.map((p) => p.category))].map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist><p class="muted">พิมพ์ชื่อใหม่แล้วบันทึก แท็กจะปรากฏบนหน้าขายอัตโนมัติ</p><label>ประเภทสินค้า<select name="kind"><option value="drink" ${p.kind === "drink" ? "selected" : ""}>เครื่องดื่ม (เลือกความหวาน/นม/รูปแบบ)</option><option value="food" ${p.kind === "food" ? "selected" : ""}>อาหาร / ขนม (ไม่มีตัวเลือกเครื่องดื่ม)</option></select></label><label>ราคาฐาน (บาท)<input name="price" type="number" min="0" max="100000" step="0.01" value="${p.price}" required></label><button class="primary" id="save-product">บันทึกเมนู</button><button type="button" id="cancel">กลับ</button></form>`,
  );
  $("#cancel").onclick = close;
  $("#remove-image").onclick = () => {
    image = "";
    $("#product-image").value = "";
    $("#product-preview").innerHTML = photo("", "รูปสินค้า");
  };
  $("#product-image").onchange = async (e) => {
    if (!e.target.files[0]) return;
    const button = $("#save-product"),
      preview = $("#product-preview"),
      remove = $("#remove-image");
    button.disabled = true;
    remove.disabled = true;
    e.target.disabled = true;
    try {
      image = await readImage(e.target.files[0]);
      preview.innerHTML = photo(image, "รูปสินค้า");
    } catch (error) {
      e.target.value = "";
      notify(error.message);
    } finally {
      button.disabled = false;
      remove.disabled = false;
      e.target.disabled = false;
    }
  };
  $("#product-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const item = {
      id: id || crypto.randomUUID(),
      name: f.get("name").trim(),
      description: f.get("description").trim(),
      category: f.get("category").trim(),
      kind: f.get("kind"),
      price: +f.get("price"),
      image,
      active: p.active,
    };
    if (!item.name || !item.category || item.category === "ทั้งหมด")
      return notify("กรอกชื่อเมนูและหมวดหมู่ (ชื่อหมวดต้องไม่ใช่ “ทั้งหมด”)");
    if (
      commit((s) => {
        if (id) s.products[s.products.findIndex((p) => p.id === id)] = item;
        else s.products.push(item);
      })
    ) {
      close();
      renderProducts();
      notify("บันทึกเมนูแล้ว");
    }
  };
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>${rows.length ? "" : '<p class="empty">ไม่มีข้อมูลในช่วงวันที่นี้</p>'}</div>`;
}
function renderReport() {
  const r = buildReport(state, reportStart, reportEnd),
    previous = previousRange(reportStart, reportEnd),
    prev = buildReport(state, previous.start, previous.end);
  const change = prev.collected
    ? (((r.collected - prev.collected) / prev.collected) * 100).toFixed(1) + "%"
    : "ยังไม่มีฐานเปรียบเทียบ";
  const peak = [...r.hours].sort((a, b) => b.bills - a.bills)[0];
  const maxDay = Math.max(1, ...r.days.map(([, v]) => v));
  $("#content").innerHTML =
    `<div class="panel report-controls"><div class="toolbar">${[
      ["today", "วันนี้"],
      ["week", "7 วันล่าสุด"],
      ["month", "เดือนนี้"],
    ]
      .map(
        ([v, label]) =>
          `<button class="chip ${reportPreset === v ? "active" : ""}" data-period="${v}">${label}</button>`,
      )
      .join(
        "",
      )}</div><form id="range-form" class="range-form"><label>ตั้งแต่<input id="report-start" type="date" value="${reportStart}" required></label><label>ถึง<input id="report-end" type="date" value="${reportEnd}" required></label><button class="primary">ดูรายงาน</button></form><p class="muted">เวลาไทย · ${reportStart} ถึง ${reportEnd} · เปรียบเทียบ ${previous.start} ถึง ${previous.end} (จำนวนวันเท่ากัน)</p></div><div class="row report-actions"><p class="muted">นับตามวันที่ขาย ไม่รวมบิลยกเลิก · ยกเลิกบิลเก่าจะปรับยอดในวันที่ขายเดิม</p><button id="shift">${state.shift ? "ปิดกะ / นับเงิน" : "เปิดกะ"}</button></div><div class="stats">${[
      ["รับชำระรวม VAT", money(r.collected), "เทียบช่วงก่อน: " + change],
      [
        "ยอดขายสุทธิไม่รวม VAT",
        money(r.net),
        "ยอดก่อนส่วนลด " + money(r.gross),
      ],
      ["บิลสำเร็จ / จำนวนขาย", r.bills + " บิล", r.units + " หน่วย"],
      ["เฉลี่ยรับชำระต่อบิล", money(r.average), "รายจ่าย " + money(r.expense)],
    ]
      .map(
        ([label, value, note]) =>
          `<div class="panel stat"><span class="muted">${label}</span><strong>${value}</strong><p class="muted">${note}</p></div>`,
      )
      .join(
        "",
      )}</div><div class="two"><div class="panel"><div class="row"><h2>แนวโน้มรับชำระรายวัน</h2><button data-report-export="daily">CSV</button></div>${r.days.map(([day, v]) => `<div class="chart-row"><span>${day}</span><div class="bar"><i style="width:${(v / maxDay) * 100}%"></i></div><span>${money(v)}</span></div>`).join("") || '<p class="empty">ไม่มีข้อมูลการขาย</p>'}<p class="muted">แสดงวันที่มีการขาย วันที่ไม่มีบิลมียอด 0 บาท</p></div><div class="panel"><div class="row"><h2>สรุปยอดตรวจสอบ</h2><button data-report-export="summary">CSV</button></div>${[
      ["ยอดก่อนส่วนลด", r.gross],
      ["ส่วนลด", r.discount],
      ["ยอดขายสุทธิไม่รวม VAT", r.net],
      ["VAT", r.tax],
      ["รับชำระรวม VAT", r.collected],
      ["รายจ่ายเงินสด", r.expense],
      ["รับชำระหักรายจ่าย*", r.afterExpenses],
    ]
      .map(
        ([name, v]) =>
          `<div class="row line"><span>${name}</span><strong>${money(v)}</strong></div>`,
      )
      .join(
        "",
      )}<p class="muted">* ไม่ใช่กำไร ยังไม่หักต้นทุนสินค้า · บิลยกเลิก ${r.voidCount} บิล รวม ${money(r.voidTotal)}</p></div><div class="panel"><div class="row"><h2>เมนูขายดี</h2><button data-report-export="products">CSV</button></div>${table(
      ["เมนู", "จำนวนขาย", "สุทธิไม่รวม VAT*"],
      r.products.map((p) => [esc(p.name), p.qty, money(p.net)]),
    )}<p class="muted">* กระจายส่วนลดตามสัดส่วนราคา รวมราคาตัวเลือกเพิ่มเติม</p></div><div class="panel"><h2>ยอดตามหมวดหมู่</h2>${table(
      ["หมวดหมู่", "จำนวนขาย", "สุทธิไม่รวม VAT"],
      r.categories.map((c) => [esc(c.name), c.qty, money(c.net)]),
    )}<p class="muted">บิลเก่าที่ไม่ได้เก็บหมวดจะแสดง “ไม่ระบุ (บิลเก่า)”</p></div><div class="panel"><div class="row"><h2>ช่วงเวลาขายดี</h2><button data-report-export="hours">CSV</button></div><p class="note">${peak ? `ช่วงที่มีบิลมากที่สุด: ${String(peak.hour).padStart(2, "0")}:00–${String(peak.hour).padStart(2, "0")}:59 (${peak.bills} บิล) ใช้ช่วยวางแผนพนักงานและเตรียมร้าน` : "เมื่อเริ่มขายจะแสดงช่วงเวลาที่ลูกค้าใช้บริการมากที่สุด"}</p>${table(
      ["ช่วงเวลาไทย", "จำนวนบิล", "รับชำระรวม VAT"],
      r.hours.map((h) => [
        String(h.hour).padStart(2, "0") +
          ":00–" +
          String(h.hour).padStart(2, "0") +
          ":59",
        h.bills,
        money(h.collected),
      ]),
    )}</div><div class="panel"><h2>ช่องทางรับเงิน</h2>${table(
      ["ช่องทาง", "รับชำระรวม VAT"],
      r.payments.map(([name, v]) => [esc(name), money(v)]),
    )}<p class="muted">ยอดโอนเป็นรายการที่พนักงานยืนยันเอง ไม่มีการตรวจสอบกับธนาคารอัตโนมัติ</p></div><div class="panel"><div class="row"><h2>รายจ่ายในช่วงวันที่</h2><button id="expense">+ บันทึกรายจ่าย</button></div>${table(
      ["วันที่", "รายการ", "จำนวนเงิน"],
      r.expenses.map((x) => [thaiDay(x.date), esc(x.name), money(x.amount)]),
    )}<p class="muted">ปุ่มบันทึกลงวันที่ปัจจุบัน ไม่ใช่วันที่เริ่มช่วงรายงาน</p></div><div class="panel"><h2>ประวัติปิดกะในช่วงวันที่</h2>${table(
      ["วันที่ปิด", "คาดหมาย", "นับได้", "ส่วนต่าง"],
      state.shifts
        .filter(
          (s) =>
            thaiDay(s.closed) >= reportStart && thaiDay(s.closed) <= reportEnd,
        )
        .map((s) => [
          thaiDay(s.closed),
          money(s.expected),
          money(s.counted),
          money(s.difference),
        ]),
    )}<p class="muted">กะที่เปิดอยู่: ${state.shift ? new Date(state.shift.date).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "ยังไม่เปิดกะ"}</p></div></div>`;
  document.querySelectorAll("[data-period]").forEach(
    (b) =>
      (b.onclick = () => {
        reportPreset = b.dataset.period;
        reportEnd = today();
        reportStart =
          reportPreset === "week"
            ? addDays(reportEnd, -6)
            : reportPreset === "month"
              ? reportEnd.slice(0, 8) + "01"
              : reportEnd;
        renderReport();
      }),
  );
  $("#range-form").onsubmit = (e) => {
    e.preventDefault();
    const start = $("#report-start").value,
      end = $("#report-end").value;
    if (start > end) return notify("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด");
    if ((new Date(end) - new Date(start)) / 86400000 > 365)
      return notify("เลือกช่วงวันที่ไม่เกิน 366 วันต่อครั้ง");
    reportStart = start;
    reportEnd = end;
    reportPreset = "custom";
    renderReport();
  };
  document.querySelectorAll("[data-report-export]").forEach(
    (b) =>
      (b.onclick = () => {
        const kind = b.dataset.reportExport;
        const rows = {
          summary: [
            ["รายการ", "ค่า"],
            ["ตั้งแต่", r.start],
            ["ถึง", r.end],
            ["ยอดก่อนส่วนลด", r.gross],
            ["ส่วนลด", r.discount],
            ["สุทธิไม่รวม VAT", r.net],
            ["VAT", r.tax],
            ["รับชำระรวม VAT", r.collected],
            ["จำนวนบิล", r.bills],
            ["จำนวนหน่วย", r.units],
            ["เฉลี่ยต่อบิล", r.average],
            ["รายจ่าย", r.expense],
            ["บิลยกเลิก", r.voidCount],
            ["ยอดบิลยกเลิก", r.voidTotal],
            ...r.payments.map(([m, v]) => ["ช่องทาง: " + m, v]),
          ],
          products: [
            ["เมนู", "จำนวนขาย", "สุทธิไม่รวม VAT"],
            ...r.products.map((p) => [p.name, p.qty, p.net]),
          ],
          daily: [["วันที่ไทย", "รับชำระรวม VAT"], ...r.days],
          hours: [
            ["ชั่วโมงไทย", "จำนวนบิล", "รับชำระรวม VAT"],
            ...r.hours.map((h) => [h.hour, h.bills, h.collected]),
          ],
        };
        download(csv(rows[kind]), `report-${kind}-${r.start}-${r.end}.csv`);
      }),
  );
  $("#expense").onclick = expenseModal;
  $("#shift").onclick = shiftModal;
}
function expenseModal() {
  modal(
    '<h2>บันทึกรายจ่ายวันนี้</h2><p class="muted">จ่ายจากลิ้นชักเงินสด</p><form class="form" id="expense-form"><label>รายการ<input name="name" required maxlength="80"></label><label>จำนวนเงิน<input name="amount" type="number" min="0.01" max="10000000" step="0.01" required></label><button class="primary">บันทึก</button><button type="button" id="cancel">กลับ</button></form>',
  );
  $("#cancel").onclick = close;
  $("#expense-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!f.get("name").trim()) return notify("กรอกชื่อรายการ");
    if (
      commit((s) =>
        s.expenses.push({
          id: crypto.randomUUID(),
          name: f.get("name").trim(),
          amount: +f.get("amount"),
          date: new Date().toISOString(),
          shiftId: s.shift?.id || null,
        }),
      )
    ) {
      close();
      renderReport();
    }
  };
}
function shiftModal() {
  if (!state.shift) {
    modal(
      '<h2>เปิดกะ</h2><form class="form" id="shift-form"><label>เงินสดตั้งต้น<input name="amount" type="number" min="0" max="10000000" step="0.01" required value="0"></label><button class="primary">เปิดกะ</button><button type="button" id="cancel">กลับ</button></form>',
    );
    $("#cancel").onclick = close;
    $("#shift-form").onsubmit = (e) => {
      e.preventDefault();
      const opening = +new FormData(e.target).get("amount");
      if (
        commit((s) => {
          s.shift = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            opening,
          };
        })
      ) {
        close();
        renderReport();
      }
    };
    return;
  }
  const expected =
    Math.round(
      (state.shift.opening +
        activeOrders()
          .filter((o) => o.shiftId === state.shift.id && o.method === "เงินสด")
          .reduce((s, o) => s + o.total, 0) -
        state.expenses
          .filter((x) => x.shiftId === state.shift.id)
          .reduce((s, x) => s + x.amount, 0)) *
        100,
    ) / 100;
  modal(
    `<h2>ปิดกะ</h2><p>เงินสดที่ควรมี ${money(expected)}</p><p class="muted">หักรายจ่ายเงินสดในกะแล้ว</p><form class="form" id="shift-form"><label>เงินสดที่นับได้<input name="amount" type="number" min="0" max="10000000" step="0.01" required></label><button class="primary">ยืนยันปิดกะ</button><button type="button" id="cancel">กลับ</button></form>`,
  );
  $("#cancel").onclick = close;
  $("#shift-form").onsubmit = (e) => {
    e.preventDefault();
    const counted = +new FormData(e.target).get("amount");
    if (
      commit((s) => {
        s.shifts.push({
          ...s.shift,
          closed: new Date().toISOString(),
          expected,
          counted,
          difference: Math.round((counted - expected) * 100) / 100,
        });
        s.shift = null;
      })
    ) {
      close();
      renderReport();
      notify("ปิดกะแล้ว ส่วนต่าง " + money(counted - expected));
    }
  };
}
function renderSettings() {
  const s = state.settings;
  let logo = s.logo,
    qr = s.qr,
    busy = 0;
  const storageKB = Math.round(new Blob([JSON.stringify(state)]).size / 1024);
  $("#content").innerHTML =
    `<div class="settings-layout"><form id="settings-form" class="form"><div class="panel form"><h2>แบรนด์และข้อมูลร้าน</h2><div class="settings-media"><div id="logo-preview" class="logo-preview">${photo(logo, "โลโก้ร้าน")}</div><div><label>อัปโหลดโลโก้ร้าน<input id="logo-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="remove-logo">ลบโลโก้</button></div></div><p class="muted">แสดงในแถบเมนูและใบเสร็จ ระบบย่อรูปก่อนบันทึก</p><label>ชื่อร้าน<input name="name" value="${esc(s.name)}" required maxlength="80"></label><label>ที่อยู่ / ข้อมูลติดต่อ<input name="address" value="${esc(s.address)}" maxlength="200"></label><label>โทรศัพท์<input name="phone" type="tel" value="${esc(s.phone)}" maxlength="30"></label></div><div class="panel form"><h2>การขายและใบเสร็จ</h2><label>VAT บวกเพิ่ม (%)<input name="tax" type="number" min="0" max="20" step="0.01" value="${s.tax}" required></label><p class="muted">ตั้ง 0 หากไม่คิด VAT ตรวจสอบการจดทะเบียนก่อนใช้</p><div class="row"><label>เพิ่มราคาปั่น (บาท)<input name="blendedExtra" type="number" min="0" max="10000" step="0.01" value="${s.blendedExtra}" required></label><label>เพิ่มราคานมโอ๊ต (บาท)<input name="oatExtra" type="number" min="0" max="10000" step="0.01" value="${s.oatExtra}" required></label></div><label>ข้อความท้ายใบเสร็จ<input name="receiptFooter" value="${esc(s.receiptFooter)}" maxlength="180"></label><button type="button" id="receipt-preview">ดูตัวอย่างหัวและท้ายใบเสร็จ</button></div><div class="panel form"><h2>รับโอน / พร้อมเพย์</h2><label>ธนาคาร<input name="bankName" value="${esc(s.bankName)}" maxlength="60"></label><label>ชื่อบัญชี<input name="accountName" value="${esc(s.accountName)}" maxlength="100"></label><label>เลขบัญชี / พร้อมเพย์<input name="accountNumber" value="${esc(s.accountNumber)}" maxlength="40"></label><div id="qr-preview" class="upload-preview">${photo(qr, "QR รับเงิน")}</div><label>รูป QR รับเงิน<input id="qr-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="remove-qr">ลบ QR</button><p class="note">ใช้ QR จริงของร้าน ลูกค้าระบุยอดตามบิล พนักงานต้องตรวจเงินเข้าก่อนยืนยัน ข้อมูลบัญชีและ QR รวมอยู่ในไฟล์สำรองด้วย</p></div><button class="primary" id="save-settings">บันทึกการตั้งค่าทั้งหมด</button></form><aside class="panel data-panel"><h2>ข้อมูลและการสำรอง</h2><p class="note">บันทึกเฉพาะเครื่อง/เบราว์เซอร์นี้ ไม่มีซิงก์หรือระบบล็อกอินแอดมิน ผู้ใช้เครื่องนี้เข้าจัดการร้านได้ ควรใช้แท็บเดียวและสำรองทุกวัน</p><p class="muted">ข้อมูลปัจจุบันประมาณ ${storageKB} KB · รูปสินค้ารวมอยู่ในไฟล์สำรอง พื้นที่ browser มีจำกัด</p><button class="full" id="backup">↓ สำรองข้อมูล JSON</button><label class="form" style="margin-top:18px">กู้คืนไฟล์สำรอง JSON<input id="restore" type="file" accept="application/json,.json"></label><p class="muted">กู้คืนไฟล์รุ่นเก่าได้ โดยคงบิลและเมนูเดิม แล้วนำข้อมูลสต็อกออก</p><p class="muted">ประวัติปิดกะ ${state.shifts.length} กะ ดูรายละเอียดในรายงาน</p><p class="muted">พิมพ์ผ่านระบบปฏิบัติการ เครื่องพิมพ์ต้องรองรับ browser ของอุปกรณ์</p></aside></div>`;
  function upload(inputId, previewId, setter, options) {
    $(inputId).onchange = async (e) => {
      if (!e.target.files[0]) return;
      const button = $("#save-settings"),
        preview = $(previewId);
      const remove = $(
        inputId === "#logo-upload" ? "#remove-logo" : "#remove-qr",
      );
      busy++;
      button.disabled = true;
      remove.disabled = true;
      e.target.disabled = true;
      try {
        const image = await readImage(e.target.files[0], options);
        setter(image);
        preview.innerHTML = photo(image, "รูปตัวอย่าง");
      } catch (error) {
        e.target.value = "";
        notify(error.message);
      } finally {
        busy--;
        button.disabled = busy > 0;
        remove.disabled = false;
        e.target.disabled = false;
      }
    };
  }
  upload(
    "#logo-upload",
    "#logo-preview",
    (value) => {
      logo = value;
    },
    { size: 320 },
  );
  upload(
    "#qr-upload",
    "#qr-preview",
    (value) => {
      qr = value;
    },
    { size: 1000, qr: true },
  );
  $("#remove-logo").onclick = () => {
    logo = "";
    $("#logo-upload").value = "";
    $("#logo-preview").innerHTML = photo("", "โลโก้");
  };
  $("#remove-qr").onclick = () => {
    qr = "";
    $("#qr-upload").value = "";
    $("#qr-preview").innerHTML = photo("", "QR");
  };
  $("#receipt-preview").onclick = () => {
    const f = new FormData($("#settings-form"));
    modal(
      `<div class="receipt">${logo ? photo(logo, "โลโก้ร้าน", "receipt-logo") : ""}<h2>${esc(f.get("name"))}</h2><p>${esc(f.get("address"))}</p><p>${esc(f.get("phone"))}</p><hr><p>ตัวอย่างรูปแบบใบเสร็จ</p><p>รายการและยอดเงินจริงจะแสดงเมื่อขาย</p><hr><p>${esc(f.get("receiptFooter"))}</p><p class="muted">ยังไม่บันทึกการตั้งค่า</p></div><button class="full" id="done">ปิดตัวอย่าง</button>`,
    );
    $("#done").onclick = close;
  };
  $("#backup").onclick = () =>
    download(
      JSON.stringify(state, null, 2),
      "jomthup-backup-" + today() + ".json",
      "application/json",
    );
  $("#restore").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw Error("ไฟล์เกิน 20 MB");
      const data = validateBackup(JSON.parse(await file.text()));
      if (
        !confirm(
          "กู้คืนจะแทนที่ข้อมูลปัจจุบันทั้งหมด รวมเมนูและรูป ควรสำรองก่อน ดำเนินการต่อ?",
        )
      )
        return;
      if (
        !commit((s) => {
          for (const key of Object.keys(s)) delete s[key];
          Object.assign(s, data);
        })
      )
        return;
      cart = [];
      discount = 0;
      category = "ทั้งหมด";
      render();
      notify("กู้คืนข้อมูลแล้ว");
    } catch (error) {
      notify("กู้คืนไม่ได้: " + error.message);
    }
  };
  $("#settings-form").onsubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.target),
      name = f.get("name").trim();
    if (!name) return notify("กรอกชื่อร้าน");
    if (
      commit((next) => {
        next.settings = {
          ...s,
          name,
          address: f.get("address").trim(),
          phone: f.get("phone").trim(),
          tax: +f.get("tax"),
          blendedExtra: +f.get("blendedExtra"),
          oatExtra: +f.get("oatExtra"),
          receiptFooter: f.get("receiptFooter").trim(),
          bankName: f.get("bankName").trim(),
          accountName: f.get("accountName").trim(),
          accountNumber: f.get("accountNumber").trim(),
          logo,
          qr,
        };
      })
    ) {
      render();
      notify("บันทึกการตั้งค่าร้านแล้ว");
    }
  };
}
if (loadError) {
  $("#app").innerHTML =
    '<main class="panel" style="margin:30px"><h1>อ่านข้อมูลร้านไม่ได้</h1><p>ระบบยังไม่แก้ไขข้อมูลเดิม กรุณาดาวน์โหลดข้อมูลดิบเพื่อให้ตรวจสอบก่อนใช้งานต่อ</p><button id="raw-backup">ดาวน์โหลดข้อมูลเดิม</button></main>';
  $("#raw-backup").onclick = () =>
    download(rawBackup || "", "jomthup-recovery.json", "application/json");
} else render();
