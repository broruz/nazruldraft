# Nazrul Nazir & Co - Sistem Pengurusan Kes (v1)

Panduan step-by-step untuk siapkan sistem ni. Ikut turutan.

## 1. Setup Database (Supabase)

1. Buka Supabase Dashboard > project kau > **SQL Editor** (menu kiri).
2. Klik **New Query**.
3. Buka fail `schema.sql` dalam folder ni, copy SEMUA isi dia, paste dalam SQL Editor.
4. Klik **RUN** (bawah kanan). Kalau berjaya, akan nampak "Success. No rows returned".

## 2. Setup Storage (untuk dokumen)

1. Pergi menu **Storage** (kiri).
2. Klik **New bucket**.
3. Nama bucket: `documents` (huruf kecil semua, penting - kena sama macam dalam code).
4. Public bucket: **OFF** (biar private).
5. Klik **Create bucket**.
6. Lepas tu balik ke **SQL Editor**, run query ni pulak (satu je baris ni, run berasingan):

```sql
create policy "staff_access_documents_storage" on storage.objects for all
  using (bucket_id = 'documents' and auth.uid() is not null)
  with check (bucket_id = 'documents' and auth.uid() is not null);
```

## 3. Masukkan Project URL & Key ke dalam code

1. Buka fail `js/supabase-config.js` (guna Notepad ke apa-apa text editor pun boleh).
2. Ganti `PASTE_PROJECT_URL_DI_SINI` dengan Project URL kau.
3. Ganti `PASTE_ANON_KEY_DI_SINI` dengan anon public key kau.
4. Kedua-dua ni ada di Supabase Dashboard > **Settings** > **API**.
5. Save fail.

## 4. Buat akaun staff pertama (kau sendiri)

Sistem ni tak ada signup page (sengaja - sebab private firm system, bukan sesiapa boleh daftar sendiri). Owner/admin yang add akaun staff melalui Supabase:

1. Pergi Supabase Dashboard > **Authentication** > **Users**.
2. Klik **Add user** > **Create new user**.
3. Isi emel dan password untuk diri kau sendiri dulu.
4. Tandakan **Auto Confirm User** (supaya tak payah verify emel).
5. Klik Create.
6. Sistem automatik akan create profile untuk akaun ni (role default: staff). Kalau nak jadikan diri kau 'owner', pergi SQL Editor dan run:

```sql
update profiles set role = 'owner' where id = (select id from auth.users where email = 'emel-kau@contoh.com');
```

Nanti nak tambah staff lain, ulang step yang sama.

## 5. Terbitkan (Deploy) Sistem

Cara paling senang - **Netlify Drop** (tak payah install apa-apa):

1. Pergi [app.netlify.com/drop](https://app.netlify.com/drop)
2. Login/sign up (boleh guna akaun Google).
3. **Drag & drop** SELURUH folder `nazrul-nazir-case-system` terus ke dalam page tu.
4. Netlify akan bagi kau link terus, contoh: `https://random-name-123.netlify.app`
5. (Pilihan) Boleh tukar nama link tu di Site settings > Change site name.

Selepas deploy, pergi ke link tu, log masuk guna akaun yang kau buat kat step 4.

## Apa yang dah siap dalam v1 ni

- Log masuk (Supabase Auth)
- Dashboard ringkasan (perkara aktif, tarikh akan datang, deadline, tugasan, fi tertunggak)
- Matters: add/edit, search, filter status, sort tarikh terdekat
- Case Management chronology per matter (auto-update tarikh/tindakan)
- Rekod bayaran (auto kira baki)
- Tasks: add, mark done, buka semula
- Calendar: senarai semua tarikh + link "Add to Google Calendar" + download .ics (Outlook/Apple)
- Documents: upload/download PDF/Word/Excel/image ikut matter, kategori Cause Paper/Correspondence
- Notifications: bell icon, auto-compute dari data sebenar

## Apa yang BELUM ada (Phase 2 - perlukan AI API key)

- **Scan Note** (extract dari screenshot/gambar)
- **Extract from Cause Paper** (extract dari PDF/gambar cause paper)
- **Counsel AI** (chat assistant)

3 fungsi ni perlukan Supabase Edge Function + AI API key (contoh Claude atau OpenAI), sebab API key WAJIB disorok di server, tak boleh letak dalam frontend. Bila kau dah ready dengan sistem asas ni, cakap je, kita sambung fasa 2.

## Nota Keselamatan

- anon key dalam `supabase-config.js` **selamat** untuk expose - dia direka untuk frontend, keselamatan sebenar dikawal oleh RLS policy dalam `schema.sql`.
- JANGAN sesekali letak `service_role` key dalam mana-mana fail frontend.
- Setiap staff kena ada akaun sendiri (jangan share 1 akaun untuk semua orang) supaya audit trail (siapa buat apa) tepat.
