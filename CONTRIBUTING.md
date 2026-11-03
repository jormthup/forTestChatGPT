# การพัฒนาและออกรุ่น

ใช้ checkout เดิมของงาน cloud ไม่สร้าง worktree เว้นแต่ผู้ใช้ขอ

## ทุกงานต้องแยก branch

1. ตรวจ `git status` และรักษางานที่มีอยู่ก่อน
2. `git fetch origin` และสร้าง branch จาก `origin/main` เช่น `fix/receipt-v0.1.2` หรือ `feature/menu-options-v0.2.0`
3. แก้เฉพาะงานนั้น ไม่ commit หรือ push งานพัฒนาเข้า main โดยตรง
4. อัปเดต version ใน package.json, เลขรุ่นใน data.js/index.html, README และ CHANGELOG
5. รัน `npm ci`, `npm test`, `npm run test:e2e`, `node --check app.js`, `git diff --check` และทดสอบ workflow ที่เกี่ยวข้องผ่าน browser
6. Push branch และเปิด PR ถ้ามีเครื่องมือ/สิทธิ์ หากผู้ใช้อนุญาต merge แล้วแต่เปิด PR ไม่ได้ ให้ตรวจ diff และ merge ด้วย `--no-ff` เพื่อรักษาขอบเขตงานไว้
7. Merge เฉพาะเมื่อทดสอบผ่านและได้รับอนุญาตในงานนั้น แล้วสร้าง annotated tag เช่น `v0.1.2` และ push main/tag โดยไม่ force-push
8. เก็บ branch ไว้เพื่อย้อนดู ไม่ลบประวัติหรือ tag รุ่นที่เผยแพร่แล้ว

## เลือกเลขรุ่น

- `0.1.x`: แก้ข้อผิดพลาดในเวอร์ชันทดลอง 1
- `0.2.0`: เพิ่มความสามารถชุดใหม่ โดยบันทึกการเปลี่ยนรูปแบบข้อมูลถ้ามี
- ยังไม่ใช้ `1.0.0` จนกว่าจะตกลงว่าพร้อมใช้จริง

## ตำแหน่งที่แก้

| งาน | ไฟล์ |
| --- | --- |
| หน้าขาย เมนู ชำระเงิน สต็อก รายงาน ตั้งค่า | app.js |
| คำนวณยอด วันรายงาน รวมรายงาน CSV | logic.js |
| ค่าเริ่มต้น เลขรุ่น ย้ายข้อมูล ตรวจ backup | data.js |
| อัปโหลด/ย่อรูป | media.js |
| รูปแบบและหน้าจอ tablet/mobile | style.css |
| หน้าเริ่มต้นและเส้นทาง assets | index.html |
| เซิร์ฟเวอร์สำหรับพัฒนา | server.js |
| ทดสอบการคำนวณและ static hosting | tests/ |
| CI | .github/workflows/ci.yml |

GitHub Pages เผยแพร่ main ที่ตั้งค่าไว้ ให้ตรวจสถานะ Pages หลัง merge การ push สำเร็จไม่เท่ากับ deployment สำเร็จ ห้ามล้างข้อมูลขายเพื่อทดสอบ ใช้ browser profile ใหม่หรือสำรอง JSON ก่อนเสมอ
