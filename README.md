# Oasis CMS (Railway-ready)

Web hiện tại là static export. Repo này bổ sung **trang quản trị `/admin`** + **Postgres DB** để chỉnh các thông tin chung (site name, hotline, email, social, copyright, hero...).

## Chạy local

Yêu cầu: Node.js 20+ và 1 Postgres (local hoặc Railway).

1) Cài deps

```bash
npm i
```

2) Tạo file `.env`

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
SESSION_SECRET="change-me"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin12345"
```

3) Migrate + seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

4) Chạy server

```bash
npm run dev
```

- Site: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`

## Deploy lên Railway

1) Tạo project Railway, add plugin **PostgreSQL**.
2) Set variables:
   - `DATABASE_URL` (Railway tự tạo khi add Postgres)
   - `SESSION_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `NODE_ENV=production`
3) Build/Start:
   - Build: `npm i && npx prisma generate`
   - Start: `npx prisma migrate deploy && npx prisma db seed && node src/server.js`

Gợi ý: Railway có thể chạy lệnh start như trên; lần deploy đầu sẽ tạo bảng + seed admin + default settings.

## Cách web nhận dữ liệu từ DB

File `assets/cms-config.js` gọi `GET /api/public/settings` và cập nhật các phần tử có `data-cms-*` trong HTML.

