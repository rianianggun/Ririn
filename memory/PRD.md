# PRD — Si-Scoring Kalteng (Penilaian Tipologi Perangkat Daerah)

## Original problem statement
Website scoring perangkat daerah dengan peran penilai, verifikator, perangkat (+admin). Data diverifikasi verifikator sebelum ke penilai; hasil terlihat perangkat; jika ditolak dikembalikan dengan catatan & mengulang. Awalnya disebut "Permendagri 18/2016"; setelah riset model yang tepat = PP 18/2016 (tipologi perangkat daerah A/B/C).

## Model penilaian (PP 18/2016) — v2
- Faktor Umum (bobot 20%, 3 indikator: Jumlah Penduduk, Luas Wilayah, Jumlah APBD) — diunggah sekali per periode (disalin otomatis ke pengajuan lain).
- Faktor Teknis (bobot 80%) per level (provinsi/kabupaten) + urusan (32 "Bidang ...") + sub-urusan (khusus Bidang Trantibumlinmas: Ketentraman & Ketertiban Umum, Sub Urusan Kebakaran).
- Skor per indikator interval kelas: 200/400/600/800/1000.
- Total urusan = 0.2·rata2 umum + 0.8·rata2 teknis; opsi ×1,1 di Laporan.
- Tipe: A(>800), B(601–800), C(401–600), Bidang(301–400), Subbidang(≤300).

## Peran & isolasi area
- Admin: semua. Penilai: semua. Verifikator: hanya area-nya. Perangkat: hanya milik sendiri (area otomatis dari akun).
- 15 area: Provinsi Kalimantan Tengah + 13 kabupaten + Kota Palangka Raya.

## Status flow
draft → menunggu_verifikasi → (ditolak → perangkat, ulang) / menunggu_penilaian → selesai

## Architecture
- Backend FastAPI + MongoDB, JWT (bcrypt/PyJWT). Object storage utk berkas. openpyxl utk export Excel.
- Frontend React 19 + Tailwind/shadcn + recharts + sonner.

## Implemented
### v1 (2026-06, arsip): model kematangan Permendagri 99/2018 (diganti).
### v2 (2026-06): PP 18/2016
- Auth 4 peran, area wajib utk perangkat/verifikator; admin = riani.anggun.adp@gmail.com.
- Indikator terstruktur (umum/teknis per level+urusan+sub-urusan); Admin CRUD via menu.
- Pengajuan per urusan: unggah Faktor Umum (3) + Faktor Teknis (N); faktor umum disalin antar pengajuan.
- Verifikasi/tolak+catatan (isolasi area); loop perbaikan.
- Penilaian: centang OK, catatan, Data Hasil Validasi, Skor per indikator.
- Laporan Hasil Penilaian (penilai): pilih Area+Perangkat, opsi ×1,1, tabel per urusan (Total, Nilai Akhir, Tipe), simpan, unduh Excel. Perangkat lihat laporan area-nya.
- Pemberitahuan evaluasi (bell, dari periode aktif). Kunci jendela unggah.
- Tren skor per tahun + rata-rata per area (grafik). Jejak audit (admin).
- Diuji: backend 11/11 pytest, frontend smoke 100%.

## Backlog (P1/P2)
- P1: Lengkapi indikator teknis seluruh 32 urusan × 2 level (saat ini seed contoh: Pendidikan, Kesehatan, PU, Trantibum+Kebakaran); dukung impor Excel/PDF lampiran.
- P1: Reminder terjadwal otomatis (cron) menjelang buka/tutup periode + email.
- P2: Validasi start_date pada jendela unggah; unifikasi error login 422→401.
- P2: Sertifikat PDF tipologi; perbandingan multi-tahun per perangkat di grafik khusus.

## Next tasks
- Impor indikator lampiran; reminder terjadwal; lengkapi seluruh urusan.
