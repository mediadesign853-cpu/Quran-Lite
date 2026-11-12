# اتصال Updater به electron/main.cjs

این تغییرها را روی `electron/main.cjs` فعلی اعمال کنید. منطق درج پاورقی Word/InDesign و سایر بخش‌های main.cjs را جایگزین یا حذف نکنید.

## 1) بالای فایل، بعد از requireهای فعلی

```js
const { startAutoUpdates } = require('./auto-updater.bundle.cjs');
```

## 2) تابع کنترل Origin و IPC

بعد از `let win;` و قبل از `function createWindow()` این تابع را اضافه کنید:

```js
function isTrustedRenderer(event) {
  if (!win || win.isDestroyed()) return false;

  const frame = event.senderFrame;
  if (
    event.sender !== win.webContents ||
    !frame ||
    frame !== win.webContents.mainFrame
  ) {
    return false;
  }

  try {
    const url = new URL(frame.url);
    return (
      url.protocol === 'app:' &&
      url.hostname === 'quran' &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

function isInternalAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === 'app:' &&
      url.hostname === 'quran' &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}
```

## 3) Listener مربوط به will-navigate

Listener فعلی را با این نسخه جایگزین کنید:

```js
win.webContents.on('will-navigate', (event, url) => {
  if (!isInternalAppUrl(url)) {
    event.preventDefault();
    openExternalHttp(url);
  }
});
```

## 4) Handlerهای IPC

درون `app.whenReady().then(...)`، Handlerهای موجود را نگه دارید و فقط به این صورت اصلاح کنید. دقت کنید که `ipcMain.handle('footnote:insert', ...)` فقط یک بار ثبت شود:

```js
ipcMain.on('pages:available', (event) => {
  if (!isTrustedRenderer(event)) {
    event.returnValue = false;
    return;
  }
  event.returnValue = pageImagesExist();
});

ipcMain.handle('footnote:insert', async (event, payload) => {
  if (!isTrustedRenderer(event)) {
    return { ok: false, message: 'درخواست نامعتبر است' };
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    return { ok: false, message: 'اطلاعات درج پاورقی معتبر نیست' };
  }

  const target = payload.target;
  const text = typeof payload.text === 'string' ? payload.text : '';
  const reference = typeof payload.reference === 'string' ? payload.reference : '';

  if (
    !['word', 'indesign'].includes(target) ||
    !text.trim() ||
    !reference.trim() ||
    text.length > 100000 ||
    reference.length > 2000
  ) {
    return { ok: false, message: 'متن آیه یا نشانی آن معتبر نیست' };
  }

  return insertNativeFootnote(target, { text, reference });
});
```

## 5) پروتکل app://

در `protocol.handle('app', ...)`، ابتدای Handler را طوری اصلاح کنید که Origin نیز کنترل شود:

```js
protocol.handle('app', (request) => {
  let parsedUrl;
  let pathname;

  try {
    parsedUrl = new URL(request.url);
    if (!isInternalAppUrl(parsedUrl.href)) {
      return new Response('forbidden', { status: 403 });
    }
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    return new Response('bad request', { status: 400 });
  }

  // ادامهٔ کد فعلی کنترل path traversal و readFile بدون تغییر بماند.
```

باقی کد فعلی `protocol.handle` را بعد از این قسمت نگه دارید.

## 6) راه‌اندازی Updater و پاک‌سازی Backup

در انتهای `app.whenReady().then(...)`، به‌جای فقط `createWindow();` از این کد استفاده کنید:

```js
createWindow();
startAutoUpdates(() => win);

// بعد از اینکه نسخهٔ جدید با موفقیت پنجره را بارگذاری کرد، Backup نسخهٔ قبلی را پاک کن.
if (process.env.PORTABLE_EXECUTABLE_FILE) {
  const previousExecutable = `${path.resolve(process.env.PORTABLE_EXECUTABLE_FILE)}.previous`;

  win.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      try {
        fs.rmSync(previousExecutable, { force: true });
      } catch (error) {
        // نگه‌داشتن Backup بهتر از متوقف‌کردن برنامه است.
        writeFootnoteLog('warning', {
          reason: 'portable-update-backup-cleanup-failed',
          message: error?.message || String(error),
        });
      }
    }, 120_000);
  });
}
```

> `startAutoUpdates` را فقط یک‌بار و بعد از ساخت پنجره فراخوانی کنید. اگر برنامه در حالت Portable باشد از Updater اختصاصی و اگر نصب NSIS باشد از electron-updater استفاده می‌شود.
