# بستهٔ تغییرات به‌روزرسانی Quran Reader Lite

این بسته برای ساخت دو مسیر به‌روزرسانی در Windows است:

- نصب‌شده با NSIS: استفاده از `electron-updater` و `latest.yml`.
- نسخهٔ Portable: دریافت Manifest امضاشده با Ed25519، تأیید SHA-512 و جایگزینی EXE با PowerShell helper.

## فایل‌ها

- `electron/auto-updater.cjs`: منطق مشترک انتخاب NSIS یا Portable.
- `electron/portable-update-helper.ps1`: جایگزینی ایمن فایل Portable بعد از خروج برنامه.
- `scripts/generate-portable-update-keys.cjs`: ساخت جفت کلید Ed25519.
- `scripts/create-portable-update-manifest.cjs`: تولید Manifest و امضای Release.
- `scripts/verify-portable-update-key.cjs`: بررسی وجود کلید عمومی.
- `.github/workflows/release-windows.yml`: ساخت و انتشار هر دو نسخه و Upload متادیتای Portable.
- `MAIN-CJS-INTEGRATION.md`: تغییرهای لازم در main.cjs بدون حذف منطق Word/InDesign.

## نصب تغییرات

1. از سورس فعلی خود یک کپی نگه دارید.
2. فایل `electron/auto-updater.cjs` را جایگزین فایل فعلی کنید.
3. `electron/main.cjs` موجود در این بسته نسخهٔ کامل ادغام‌شده بر اساس ZIP ارسالی است؛ آن را با فایل محلی مقایسه کنید. این نسخه منطق Word/InDesign را حفظ می‌کند و اتصال Updater، کنترل IPC و Origin را اضافه می‌کند. اگر در فایل محلی تغییرهای دیگری دارید، آن‌ها را حفظ و فقط بخش‌های لازم را ادغام کنید.
4. فایل `electron/portable-update-helper.ps1` را به پوشهٔ `electron` کپی کنید.
5. اسکریپت‌های پوشهٔ `scripts` را به پروژه اضافه کنید.
6. `package.json`، `package-lock.json` و `electron-builder.yml` موجود در این بسته نسخه‌های کامل به‌روزشده بر مبنای ZIP ارسالی هستند.
7. Workflow را در مسیر دقیق `.github/workflows/release-windows.yml` قرار دهید. پوشه باید حروف کوچک داشته باشد. فایل قدیمی `.github/workFlows/releasWindows.yml` و فایل خالی `.github/workflow` را از مخزن حذف کنید. در ویندوز برای تغییر حروف پوشه، ابتدا آن را به نام میانی مثل `workflows-temp` تغییر دهید و سپس به `workflows` تغییر نام دهید.
8. خطوط فایل `GITIGNORE-ADD.txt` را به `.gitignore` اضافه کنید.
9. یک بار جفت کلید را بسازید و public key را Commit کنید.
10. مقدار private key را در GitHub Actions Secret قرار دهید.
11. `MAIN-CJS-INTEGRATION.md` را برای توضیح ادغام و کنترل نهایی نگه دارید؛ اگر main.cjs کامل این بسته را به‌کار می‌برید، تغییرهای همان سند از قبل در آن ادغام شده‌اند.

## ساخت کلید

```powershell
npm run generate:portable-keys
```

این دستور دو فایل می‌سازد:

- `.secrets/portable-update-private.pem` — خصوصی؛ هرگز Commit نشود.
- `electron/portable-update-public.pem` — عمومی؛ باید Commit شود.

در GitHub Repository به مسیر Settings → Secrets and variables → Actions بروید و Secret زیر را بسازید:

`PORTABLE_UPDATE_PRIVATE_KEY`

محتوای کامل فایل private PEM را در آن قرار دهید. برای تست محلی در PowerShell نیز می‌توانید اجرا کنید:

```powershell
$env:PORTABLE_UPDATE_PRIVATE_KEY = Get-Content -Raw .secrets/portable-update-private.pem
$env:GITHUB_REF_NAME = "v1.0.0"
npm run create:portable-manifest
```

از private key یک نسخهٔ پشتیبان آفلاین و امن نگه دارید. اگر این کلید گم شود، نسخه‌های قدیمی دیگر Manifestهای جدید را تأیید نمی‌کنند، مگر اینکه برنامه با کلید عمومی جدید دوباره منتشر شود.

## تغییرهای package.json

- `esbuild` باید وابستگی مستقیم dev باشد؛ در پروژهٔ ارسالی نسخهٔ 0.21.5 از قبل در lockfile وجود داشت.
- اسکریپت‌های زیر را اضافه کنید:

```json
"generate:portable-keys": "node scripts/generate-portable-update-keys.cjs",
"verify:portable-key": "node scripts/verify-portable-update-key.cjs",
"create:portable-manifest": "node scripts/create-portable-update-manifest.cjs"
```

- دستور `dist:win` را به این شکل تغییر دهید:

```json
"dist:win": "npm run build && npm run prepare:electron && npm run verify:portable-key && electron-builder --config electron-builder.yml --win"
```

## تغییرهای electron-builder.yml

در `files` این مورد را اضافه کنید:

```yaml
  - electron/portable-update-public.pem
```

در `extraResources` این مورد را اضافه کنید:

```yaml
  - from: electron/portable-update-helper.ps1
    to: portable-update-helper.ps1
```

برای `nsis` نام خروجی مشخص باشد:

```yaml
nsis:
  artifactName: "${productName} Setup ${version}.${ext}"
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: always
  createStartMenuShortcut: true
  shortcutName: Quran Reader Lite
  deleteAppDataOnUninstall: false
```

برای `portable` نیز اضافه کنید:

```yaml
portable:
  artifactName: "${productName} Portable ${version}.${ext}"
```

Targetهای فعلی `nsis` و `portable` را در `win.target` حفظ کنید.

## تغییرهای .gitignore

چون پروژه `*.pem` را ignore می‌کند، این استثنا را بعد از آن اضافه کنید:

```gitignore
!electron/portable-update-public.pem
```

فایل خصوصی همچنان Ignore می‌ماند.

## انتشار نسخه

1. شمارهٔ نسخهٔ `package.json` را مثلاً به `1.0.1` تغییر دهید.
2. Commit کنید.
3. Tag دقیقاً منطبق بسازید:

```powershell
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

4. GitHub Actions ابتدا NSIS و Portable را می‌سازد و `electron-builder` فایل‌ها و `latest.yml` را در یک Release موقت (Draft) قرار می‌دهد.
5. سپس Manifest امضاشدهٔ Portable را می‌سازد و فایل زیر را در همان Release بارگذاری می‌کند.
6. در پایان، Workflow فقط پس از بارگذاری همهٔ فایل‌ها Release را منتشر می‌کند. این کار جلوی دیده‌شدن Release ناقص توسط Updater کاربران را می‌گیرد.

```text
latest-portable.json
```

`latest.yml` برای NSIS توسط electron-builder منتشر می‌شود. `latest-portable.json` مخصوص Updater نسخهٔ Portable است؛ محتوای Manifest به‌صورت Base64 همراه امضای Ed25519 در همان فایل قرار دارد.

## رفتار به‌روزرسانی Portable

- فایل دانلودی ابتدا با SHA-512 بررسی می‌شود.
- Manifest خام با کلید عمومی Ed25519 بررسی می‌شود.
- Helper فقط پس از خروج برنامه اجرا را ادامه می‌دهد.
- فایل جدید در همان پوشهٔ EXE مرحله‌بندی و دوباره Hash می‌شود.
- فایل قبلی با پسوند `.previous` نگهداری می‌شود.
- نسخهٔ جدید اجرا می‌شود؛ پس از بارگذاری موفق رابط، نسخهٔ قبلی با تأخیر حذف می‌شود.
- پوشهٔ `Quran Reader Lite Data` دست‌نخورده باقی می‌ماند.
- اگر پوشهٔ Portable قابل نوشتن نباشد، Update انجام نمی‌شود و نسخهٔ قبلی حفظ می‌شود.

## محدودیت‌ها و تست الزامی

این پیاده‌سازی را ابتدا روی یک پوشهٔ آزمایشی قابل نوشتن تست کنید؛ مخصوصاً روی USB و مسیرهای دارای فاصله یا حروف فارسی. اینجا امکان اجرای واقعی Installer و تست جایگزینی EXE روی Windows وجود نداشت.

برای اولین انتقال کاربران از نسخه‌ای که هنوز Updater ندارد، باید نسخهٔ جدید را یک بار دستی نصب/جایگزین کنند. از آن به بعد مسیرهای خودکار قابل استفاده‌اند.
