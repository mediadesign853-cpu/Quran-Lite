# قرآن ريدر لايت | Quran Reader Lite

**اللغات:** [English](README.md) | [فارسی](README.fa.md) | **العربية**

Quran Reader Lite هو تطبيق لسطح مكتب Windows لقراءة نص القرآن الكريم باللغة العربية والبحث فيه دون الحاجة إلى الاتصال بالإنترنت. بُني باستخدام **Electron وReact وTypeScript**. تحتوي نسخة Lite على نص القرآن العربي فقط، ولا تتضمن الترجمات أو التفاسير.

مصدر نص القرآن: [مشروع تنزيل](https://tanzil.net) — ترخيص CC BY 3.0.

## الميزات الرئيسية

- قراءة السور الـ114 والبحث في السور والآيات.
- عرض صور صفحات المصحف الـ604 المضمنة في نسخة المشروع الحالية.
- حفظ العلامات المرجعية وسجل البحث وآخر موضع للقراءة.
- واجهة بالعربية أو الفارسية، ومظهر فاتح أو داكن، مع إمكانية تغيير حجم النص.
- نسخ الآيات مع خيارات لأرقام الآيات والأقواس القرآنية والمراجع.
- إدراج حواشٍ فعلية في Microsoft Word أو Adobe InDesign على Windows.
- القراءة والبحث دون إنترنت؛ يلزم الاتصال بالإنترنت للحصول على التحديثات.
- إصداران لنظام Windows: مثبّت NSIS ونسخة Portable.
- تحديثات تلقائية، مع آلية تحقق بالتوقيع الرقمي لنسخة Portable.

## التثبيت والإعداد

1. افتح صفحة [إصدارات GitHub](https://github.com/mediadesign853-cpu/quran-lite/releases/latest).
2. نزّل أحد الملفين التاليين:
   - **Quran Reader Lite Setup** — يثبت التطبيق وينشئ الاختصارات.
   - **Quran Reader Lite Portable** — يعمل دون تثبيت.
3. في نسخة Portable، احتفظ بمجلد `Quran Reader Lite Data` بجانب ملف EXE. يحتوي هذا المجلد على إعدادات النسخة وعلاماتها المرجعية وسجلها. يجب أن يكون المجلد قابلاً للكتابة حتى يمكن تحديث ملف EXE بأمان.

**Word وInDesign:** إدراج الحواشي الفعلية متاح في تطبيق Windows المكتبي فقط. يتطلب تثبيت البرنامج المستهدف (Word أو InDesign) وتوفر Windows PowerShell 5.1. عند تعذّر الإدراج، افتح البرنامج المستهدف ثم حاول مرة أخرى.

## البناء والإصدار

### المتطلبات والبناء محلياً

استخدم **Node.js 22** وnpm. على Windows، نفّذ الأوامر التالية من مجلد المشروع:

```powershell
npm ci
npm run check
npm run dist:win
```

يتحقق `npm run check` من بيانات القرآن وأنواع TypeScript وقواعد ESLint وبناء الويب. أما `npm run dist:win` فيجهّز تطبيق Electron وينشئ حزمتَي Windows x64 داخل مجلد `release/`:

- `Quran Reader Lite Setup <version>.exe`
- `Quran Reader Lite Portable <version>.exe`

### مفاتيح تحديث Portable والبرامج النصية

يستخدم المشروع ثلاثة أوامر لتحديث نسخة Portable:

| الأمر | الوظيفة |
| --- | --- |
| `npm run generate:portable-keys` | إنشاء زوج مفاتيح Ed25519. يُنفّذ مرة واحدة عند إعداد نظام التحديث، وليس مع كل إصدار. |
| `npm run verify:portable-key` | التحقق من وجود المفتاح العام وصحة كونه مفتاح Ed25519. |
| `npm run create:portable-manifest` | حساب قيمة SHA-512 لملف Portable EXE وإنشاء ملف البيان الموقّع `latest-portable.json`. |

الاسم الدقيق لأمر إنشاء المفاتيح في هذا المشروع هو **`generate:portable-keys`**؛ ولا يوجد أمر باسم `generate:portable` في `package.json`.

ملفات المفاتيح:

- `electron/portable-update-public.pem` — المفتاح العام؛ يجب إضافته إلى مستودع Git.
- `.secrets/portable-update-private.pem` — المفتاح الخاص؛ لا ترفعه إلى Git ولا ترسله إلى أي شخص.

أضف محتوى المفتاح الخاص كاملاً إلى GitHub Repository Secrets بالاسم `PORTABLE_UPDATE_PRIVATE_KEY`. واحتفظ بنسخة احتياطية آمنة وغير متصلة بالإنترنت. لا تنشئ مفتاحاً جديداً لكل إصدار؛ فالنسخ المثبتة تثق بالمفتاح العام المضمّن في التطبيق.

يستخدم برنامج إنشاء Manifest المتغيرين `PORTABLE_UPDATE_PRIVATE_KEY` و`GITHUB_REF_NAME`. يضبط GitHub Actions هذين المتغيرين تلقائياً ويشغّل البرنامج بعد إنشاء ملف Portable.

### النشر باستخدام GitHub Actions

ملف سير العمل موجود في `.github/workflows/release-windows.yml`. ولا يعمل **إلا عند دفع Tag يبدأ بالحرف `v`**، مثل `v1.0.1`.

مع كل إصدار:

1. غيّر رقم الإصدار في `package.json` إلى رقم الإصدار الجديد (مثلاً `1.0.1`).
2. حدّث ملف Lock وشغّل الفحوصات:

```powershell
npm install --package-lock-only
npm run check
```

3. أنشئ Commit لتغييرات الإصدار وادفعها إلى الفرع `main`، ثم أنشئ Tag بالرقم نفسه وادفعه:

```powershell
git add package.json package-lock.json
git commit -m "Release v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

يستخدم GitHub Actions بيئة Windows ويجهز Node.js 22، ثم يثبت الحزم باستخدام `npm ci`، وينفذ `npm run check`، ويبني نسختَي NSIS وPortable. بعد ذلك ينشئ Manifest الموقّع لنسخة Portable ويرفعه. ولا يتم نشر إصدار GitHub نهائياً إلا بعد رفع الملفات المطلوبة.

السر المطلوب في المستودع هو `PORTABLE_UPDATE_PRIVATE_KEY`. ويستخدم سير العمل الرمز `GITHUB_TOKEN` الذي يوفره GitHub لرفع ملفات الإصدار.

## آلية التحديث التلقائي

- يفحص تطبيق Windows المكتبي وجود تحديث بعد نحو 15 ثانية من التشغيل، ثم يعيد الفحص كل 12 ساعة.
- يطلب التطبيق موافقة المستخدم قبل تنزيل التحديث؛ ولا يثبّت تحديثاً دون موافقته.
- **نسخة NSIS المثبتة:** تستخدم `electron-updater` وملف `latest.yml` المنشور مع إصدار GitHub.
- **نسخة Portable:** تنزّل `latest-portable.json` وتتحقق من توقيعه باستخدام Ed25519، ثم تتحقق من ملف EXE الذي تم تنزيله باستخدام SHA-512. بعد إغلاق التطبيق، تستبدل أداة PowerShell ملف EXE. ويُحتفظ بالملف السابق حتى يبدأ الإصدار الجديد بنجاح.
- يتطلب التحديث اتصالاً بالإنترنت. كما يجب أن يكون المجلد الذي يحتوي على ملف EXE في نسخة Portable قابلاً للكتابة. إذا فشل التحديث، تبقى النسخة الحالية محفوظة.

## ملاحظة أمنية

يحمي التحقق من توقيع Ed25519 وفحص SHA-512 **عملية تحديث نسخة Portable**. لكنهما لا يعادلان توقيع ناشر Windows من نوع Authenticode. ملفات EXE الحالية غير موقّعة بشهادة Authenticode؛ لذلك قد يعرض Windows SmartScreen تحذير «ناشر غير معروف». نزّل التطبيق من صفحة إصدارات GitHub الرسمية المذكورة أعلاه فقط.
