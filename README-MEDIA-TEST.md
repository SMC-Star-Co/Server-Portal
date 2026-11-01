# راهنمای آزمایش مدیریت مدیاهای فاکتور (فقط smc-server)

نسخه جدید در Branch `develop` است. `main`، سرور اصلی و `.env` تغییر نکرده‌اند.

## اول: پاک کردن فایل‌های قبلی قبل از Pull

ابتدا با `hostname` مطمئن شوید روی `smc-server` هستید. این پاک‌سازی تمامی مدیاهای آزمایشی قبلی سرور تست را حذف می‌کند، اما هیچ فاکتوری را حذف نمی‌کند.

```bash
docker exec postgres_db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM invoice_media;"'
docker exec postgres_db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE TABLE invoice_media RESTART IDENTITY;"'
test "$(realpath /root/portal-media)" = "/root/portal-media" && find /root/portal-media -maxdepth 1 -type f -delete
```

## دوم: دریافت و راه‌اندازی نسخه جدید

```bash
cd /root/portal
git status -sb
git pull --ff-only origin develop
docker compose up -d --no-deps --build app
docker exec nginx_web nginx -t && docker exec nginx_web nginx -s reload
docker compose ps
docker logs --tail 60 node_app
docker exec node_app node --test test/invoice-media.test.js
docker exec node_app zip -v | head -n 3
```

## قابلیت‌ها

- منوی داخلی مجزا «مدیریت مدیاها» در مدیریت فاکتور؛ بدون تغییر فرم‌های دیگر.
- دو بخش مستقل آپلود: فایل فاکتور و فایل سرور با انتخاب سریال موجود.
- عکس، ویدیو و اسناد (PDF، Word، Excel، PowerPoint و ...) بدون هیچ فشرده‌سازی یا تبدیل نگهداری می‌شوند.
- حداکثر حجم هر فایل ۵۰۰ مگابایت (۵۰۰ MiB)؛ آپلود جریانی.
- نام فایل فاکتور: `40428-01.jpg`، `40428-02.pdf` و ... .
- نام فایل سرور: `2M201002KG-01.jpg`، `2M201002KG-02.mp4` و ... .
- ترتیب گروه‌بندی سریال‌ها همان ترتیب موجود در مدیریت سریال‌هاست.
- هر گروه سریال با کلیک باز و بسته می‌شود؛ دانلود تک‌فایل و کل گروه با ZIP.
- مجوز آپلود/حذف فقط تکنسین؛ مشاهده/دانلود برای فروش.
- بعضی مرورگرها HEIC را پیش‌نمایش نمی‌کنند؛ فایل اصلی قابل دانلود است.

## ذخیره‌سازی

- محل فایل‌ها روی میزبان: `/root/portal-media`، داخل Node.js: `/app/media`.
- رکوردهای فایل در جدول `invoice_media` هستند. بکاپ باید هم PostgreSQL و هم مسیر فایل‌ها را شامل شود.
- سهمیه مجموع ۱۰۰ GiB تغییر نکرده است؛ سقف هر فایل ۵۰۰ MiB است.
