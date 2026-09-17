# PRD — Si-Scoring Kalteng (Scoring Perangkat Daerah)

## Original problem statement
Website scoring perangkat daerah dengan 3 tipe user (penilai, verifikator, perangkat). Data masuk diverifikasi verifikator dulu sebelum ke penilai. Hasil penilaian terlihat oleh perangkat. Jika ada perbaikan, ditolak & dikembalikan ke perangkat dengan catatan lalu mengulang langkah awal. Scoring berdasarkan "Permendagri 18/2016" (riset: regulasi penilaian kematangan yang relevan adalah Permendagri 99/2018, 11 variabel, skor 1-5, total 11-55).

## User choices
- Auth: JWT username/password, akun dibuat admin (role Admin ditambahkan → total 4 peran).
- Indikator: default hasil riset (11 variabel Permendagri 99/2018), editable admin.
- Skor: total + persentase berbobot + kategori kematangan.
- Data perangkat: Area (Kalteng) + Nama Perangkat + Urusan + upload file per indikator.
- Evaluasi tahunan; catatan/ grafik per tahun; opsi kunci waktu upload.

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT (bcrypt, PyJWT), httpOnly cookie + Bearer. Emergent Object Storage untuk berkas.
- Frontend: React 19, Tailwind + shadcn/ui, recharts, sonner. Auth context (token di localStorage).
- Tema: emerald/amber govtech, Plus Jakarta Sans + IBM Plex Sans.

## Personas
- Admin: kelola user, indikator, periode (kunci upload), lihat analitik.
- Perangkat: buat pengajuan, unggah berkas per variabel, lihat hasil/ catatan perbaikan.
- Verifikator: verifikasi / tolak dengan catatan (loop kembali ke perangkat).
- Penilai: nilai 11 variabel 1-5, finalisasi → rilis hasil.

## Status flow
draft → menunggu_verifikasi → (ditolak → perangkat) / menunggu_penilaian → selesai

## Implemented (2026-06)
- Auth 4 peran + seeding admin (riani.anggun.adp@gmail.com) & 3 demo user.
- CRUD user, indikator, periode; kunci upload & periode aktif.
- Alur pengajuan lengkap: buat → unggah per indikator → submit → verifikasi/tolak → nilai → hasil.
- Laporan kematangan: kategori, total, radar chart, rincian per variabel.
- Analitik: rata-rata per tahun & per area (recharts).
- Object storage upload + preview berkas.
- Tested E2E: backend 11/11 pytest, frontend smoke 100%.

## Backlog (P1/P2)
- P1: Notifikasi/reminder otomatis menjelang & saat jendela evaluasi dibuka/berakhir.
- P1: Export laporan PDF sertifikat kematangan.
- P2: Validasi start_date pada jendela upload; komparasi multi-tahun per perangkat.
- P2: Riwayat aktivitas (audit log) yang ditampilkan di UI.

## Next tasks
- Reminder/notifikasi evaluasi; export PDF hasil.
