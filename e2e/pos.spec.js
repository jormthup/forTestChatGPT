import { test, expect } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);
const upload = { name: "coffee.png", mimeType: "image/png", buffer: png };
async function addProduct(
  page,
  name = "ลาเต้จอมทัพ",
  category = "กาแฟพิเศษ",
  kind = "drink",
) {
  await page.locator('[data-page="products"]').click();
  await page.locator("#new").click();
  await page.locator("#product-image").setInputFiles(upload);
  await expect(page.locator("#product-preview img")).toBeVisible();
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="description"]').fill("สูตรของร้าน");
  await page.locator('[name="category"]').fill(category);
  await page.locator('[name="kind"]').selectOption(kind);
  await page.locator('[name="price"]').fill("75");
  await page.locator("#save-product").click();
  await expect(page.locator("dialog")).not.toBeVisible();
}
async function sell(page, method = "เงินสด") {
  await page.locator('[data-page="sell"]').click();
  await page.locator("[data-product]").first().click();
  await expect(page.locator('[name="qty"]')).toHaveCount(0);
  await page.locator("#add-form .primary").click();
  await page.locator("#pay").click();
  await page.locator("#method").selectOption(method);
  if (method === "เงินสด") await page.locator("#cash").fill("100");
  await page.locator("#payment .primary").click();
  await expect(page.locator(".receipt")).toBeVisible();
}
test("admin photo, new tag, checkout, period reports, CSV, logo and backup restore", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) =>
    d.type() === "prompt" ? d.accept("ทดสอบยกเลิก") : d.accept(),
  );
  await page.goto("/");
  await expect(page.locator("[data-product]")).toHaveCount(0);
  await addProduct(page);
  await page.locator('[data-page="sell"]').click();
  await expect(page.locator('[data-cat="กาแฟพิเศษ"]')).toBeVisible();
  await expect(page.locator(".product img")).toBeVisible();
  await expect(page.locator(".product")).not.toContainText("เหลือ");
  await sell(page);
  await expect(page.locator(".receipt")).toContainText("฿25.00");
  await page.locator("#done").click();
  await sell(page, "โอนเงิน");
  await page.locator("#done").click();
  await page.locator('[data-page="report"]').click();
  await expect(page.locator(".stats")).toContainText("2 บิล");
  await expect(page.locator(".stats")).toContainText("฿150.00");
  await expect(page.locator("#content")).not.toContainText("สต็อกใกล้หมด");
  await page.locator('[data-period="week"]').click();
  const csvDownload = page.waitForEvent("download");
  await page.locator('[data-report-export="products"]').click();
  expect((await csvDownload).suggestedFilename()).toContain("report-products-");
  await page.locator('[data-page="settings"]').click();
  await page.locator("#logo-upload").setInputFiles(upload);
  await expect(page.locator("#logo-preview img")).toBeVisible();
  await page.locator("#qr-upload").setInputFiles(upload);
  await expect(page.locator("#qr-preview img")).toBeVisible();
  await page.locator('[name="phone"]').fill("0812345678");
  await page.locator('[name="accountName"]').fill("กาแฟจอมทัพ");
  await page.locator('[name="receiptFooter"]').fill("แล้วพบกันใหม่");
  await page.locator("#receipt-preview").click();
  await expect(page.locator(".receipt")).toContainText("0812345678");
  await page.locator("#done").click();
  await page.locator("#save-settings").click();
  await expect(page.locator(".brand img")).toBeVisible();
  await page.reload();
  await expect(page.locator(".brand img")).toBeVisible();
  await page.locator('[data-page="settings"]').click();
  const data = await page.evaluate(() =>
    localStorage.getItem("littlecup-pos-v1"),
  );
  await page
    .locator("#restore")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(data),
    });
  await expect(page.locator("#toast")).toHaveText("กู้คืนข้อมูลแล้ว");
  await page.locator('[data-page="orders"]').click();
  await page.locator("[data-void]").first().click();
  await page.locator('[data-page="report"]').click();
  await expect(page.locator(".stats")).toContainText("1 บิล");
  await page.locator('[data-page="products"]').click();
  await page.locator("[data-toggle]").click();
  await page.locator('[data-page="sell"]').click();
  await expect(page.locator("[data-product]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("tablet and phone layouts, including reports/settings, do not overflow", async ({
  page,
}) => {
  await page.goto("/");
  await addProduct(page);
  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ["sell", "products", "report", "settings"]) {
      await page.locator(`[data-page="${tab}"]`).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${tab} at ${width}`,
      ).toBe(true);
    }
  }
});
test("legacy zero-stock menu remains sellable; old orders/held survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const item = {
      id: "old",
      name: "กาแฟเดิม",
      price: 60,
      qty: 1,
      options: "",
      note: "",
    };
    localStorage.setItem(
      "littlecup-pos-v1",
      JSON.stringify({
        products: [
          {
            id: "old",
            name: "กาแฟเดิม",
            category: "กาแฟ",
            price: 60,
            stock: 0,
            emoji: "☕",
          },
        ],
        orders: [
          {
            id: "old-order",
            number: "LC-00001",
            date: new Date().toISOString(),
            items: [item],
            subtotal: 60,
            discount: 0,
            vat: 0,
            total: 60,
            taxRate: 0,
            method: "เงินสด",
            received: 60,
            change: 0,
          },
        ],
        held: [
          {
            id: "held",
            cart: [item],
            discount: 0,
            mode: "กลับบ้าน",
            time: new Date().toISOString(),
          },
        ],
        expenses: [],
        shift: null,
        settings: { name: "ร้านเดิม", tax: 0 },
      }),
    );
  });
  await page.reload();
  await expect(page.locator("[data-product]")).toBeEnabled();
  await page.locator("#held").click();
  await page.locator("[data-resume]").click();
  await page.locator("#pay").click();
  await page.locator("#payment .primary").click();
  await page.locator("#done").click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("littlecup-pos-v1")),
  );
  expect(data.orders).toHaveLength(2);
  expect(data.orders[0].number).toBe("LC-00001");
  expect(data.products[0]).not.toHaveProperty("stock");
  expect(data.settings.name).toBe("ร้านเดิม");
});
test("storage failures do not create phantom menu entries", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-page="products"]').click();
  await page.locator("#new").click();
  await page.locator('[name="name"]').fill("ไม่ควรบันทึก");
  await page.locator('[name="category"]').fill("กาแฟ");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.locator("#save-product").click();
  await expect(page.locator("#toast")).toContainText("บันทึกไม่สำเร็จ");
  await page.locator("#cancel").click();
  await expect(page.locator("tbody tr")).toHaveCount(0);
});
