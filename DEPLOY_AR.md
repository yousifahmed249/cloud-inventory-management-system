# دليل النشر والتشغيل

هذا المشروع هو نظام إدارة مخزون كامل يعتمد على Node.js، مع قاعدة بيانات جاهزة لـ PostgreSQL، ومصادر احتياطية لـ SQLite، ونظام مصادقة JWT، ودعم Docker.

## المتطلبات

- Node.js 20+
- npm
- قاعدة بيانات PostgreSQL (للإنتاج)
- Docker (اختياري، للتشغيل داخل الحاويات)

## متغيرات البيئة

أنشئ ملف `.env` بناءً على `.env.example`، ثم اضبط القيم التالية:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=استبدلها بمفتاح طويل وعشوائي
POSTGRES_DB=inventory_db
POSTGRES_USER=inventory_user
POSTGRES_PASSWORD=inventory_pass
DATABASE_URL=postgresql://inventory_user:inventory_pass@localhost:5432/inventory_db
```

إذا لم تتوفر PostgreSQL، يقوم التطبيق تلقائيًا بالعودة إلى SQLite.

## التشغيل المحلي

```bash
npm install
npm start
```

حساب المدير الافتراضي:

- البريد الإلكتروني: admin@inventory.local
- كلمة المرور: admin123

## تشغيل PostgreSQL محليًا عبر Docker

```bash
docker compose up -d postgres
npm run db:init
npm start
```

## النشر الكامل عبر Docker

```bash
docker compose up --build
```

هذا يشغّل حاوية PostgreSQL وحاوية التطبيق معًا.

## تهيئة PostgreSQL

```bash
npm run db:init
```

هذا ينشئ المخطط المطلوب ويضيف حساب المدير الافتراضي.

## نشر الواجهة على GitHub Pages والـ API على Render

يستضيف GitHub Pages الملفات الثابتة فقط، ولا يشغّل خادم Express. انشر الخادم
وقاعدة PostgreSQL على Render، ثم اربط واجهة Pages به:

1. أنشئ Blueprint في Render من هذا المستودع. سيستخدم Render ملف `render.yaml`
   لإنشاء خدمة الـ API وقاعدة PostgreSQL.
2. في إعدادات البيئة لخدمة الـ API، اضبط `FRONTEND_ORIGINS` على عنوان أصل
   موقع GitHub Pages (لهذا المستودع:
   `https://yousifahmed249.github.io`). استخدم عنوان النطاق المخصص إذا كنت
   تستخدم نطاقًا خاصًا.
3. بعد نشر الـ API، انسخ رابط خدمته إلى `config.js`:

   ```js
   window.INVENTORY_API_URL = "https://your-api-service.onrender.com";
   ```

   لا تضف `/` في نهاية الرابط. احفظ التغيير وادفعه إلى المستودع حتى تنشر
   GitHub Pages الإعداد الجديد.
4. تحقق من عمل الخادم بفتح
   `https://your-api-service.onrender.com/api/health`.

ينشئ إعداد Render قيمة `JWT_SECRET` ويربط الخادم بقاعدة PostgreSQL. يجب أن
تطابق عناوين Pages والـ API النطاقات الفعلية المستخدمة في النشر.

## ملاحظات للإنتاج

- استخدم خدمة PostgreSQL مُدارة في بيئة الإنتاج.
- احتفظ بـ `JWT_SECRET` في متغيرات البيئة الآمنة.
- لا تضع ملف `.env` في المستودع العام.
- يفضّل النشر داخل حاويات أو عبر مزود استضافة مُدار.
