export const AREAS = [
  { name: "Provinsi Kalimantan Tengah", level: "provinsi" },
  { name: "Kabupaten Barito Selatan", level: "kabupaten" },
  { name: "Kabupaten Barito Timur", level: "kabupaten" },
  { name: "Kabupaten Barito Utara", level: "kabupaten" },
  { name: "Kabupaten Gunung Mas", level: "kabupaten" },
  { name: "Kabupaten Kapuas", level: "kabupaten" },
  { name: "Kabupaten Katingan", level: "kabupaten" },
  { name: "Kabupaten Kotawaringin Barat", level: "kabupaten" },
  { name: "Kabupaten Kotawaringin Timur", level: "kabupaten" },
  { name: "Kabupaten Lamandau", level: "kabupaten" },
  { name: "Kabupaten Murung Raya", level: "kabupaten" },
  { name: "Kabupaten Pulang Pisau", level: "kabupaten" },
  { name: "Kabupaten Seruyan", level: "kabupaten" },
  { name: "Kabupaten Sukamara", level: "kabupaten" },
  { name: "Kota Palangka Raya", level: "kabupaten" },
];
export const AREA_LEVEL = Object.fromEntries(AREAS.map((a) => [a.name, a.level]));

export const URUSAN = [
  "Bidang Pendidikan",
  "Bidang Kesehatan",
  "Bidang Pekerjaan Umum dan Penataan Ruang",
  "Bidang Perumahan dan Kawasan Permukiman",
  "Bidang Ketentraman dan Ketertiban Umum serta Perlindungan Masyarakat",
  "Bidang Sosial",
  "Bidang Tenaga Kerja",
  "Bidang Pemberdayaan Perempuan dan Perlindungan Anak",
  "Bidang Pangan",
  "Bidang Pertanahan",
  "Bidang Lingkungan Hidup",
  "Bidang Administrasi Kependudukan dan Pencatatan Sipil",
  "Bidang Pemberdayaan Masyarakat dan Desa",
  "Bidang Pengendalian Penduduk dan Keluarga Berencana",
  "Bidang Perhubungan",
  "Bidang Komunikasi dan Informatika",
  "Bidang Koperasi, Usaha Kecil dan Menengah",
  "Bidang Penanaman Modal",
  "Bidang Kepemudaan dan Olahraga",
  "Bidang Statistik",
  "Bidang Persandian",
  "Bidang Kebudayaan",
  "Bidang Perpustakaan",
  "Bidang Kearsipan",
  "Bidang Kelautan dan Perikanan",
  "Bidang Pariwisata",
  "Bidang Pertanian",
  "Bidang Kehutanan",
  "Bidang Energi dan Sumber Daya Mineral",
  "Bidang Perdagangan",
  "Bidang Perindustrian",
  "Bidang Transmigrasi",
];

// Urusan yang memiliki sub-urusan
export const SUB_URUSAN = {
  "Bidang Ketentraman dan Ketertiban Umum serta Perlindungan Masyarakat": [
    "Urusan Ketentraman dan Ketertiban Umum",
    "Sub Urusan Kebakaran",
  ],
};

export const STATUS_META = {
  draft: { label: "Draf", cls: "bg-slate-100 text-slate-700 border-slate-300", step: 0 },
  menunggu_verifikasi: { label: "Menunggu Verifikasi", cls: "bg-amber-100 text-amber-800 border-amber-300", step: 1 },
  ditolak: { label: "Dikembalikan (Perbaikan)", cls: "bg-red-100 text-red-700 border-red-300", step: 1 },
  menunggu_penilaian: { label: "Menunggu Penilaian", cls: "bg-blue-100 text-blue-800 border-blue-300", step: 2 },
  selesai: { label: "Selesai Dinilai", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", step: 3 },
};

export const TIPE_META = {
  A: { label: "Tipe A", cls: "bg-teal-500/10 text-teal-700 border-teal-500/30", hex: "#0d9488" },
  B: { label: "Tipe B", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", hex: "#059669" },
  C: { label: "Tipe C", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", hex: "#d97706" },
  BIDANG: { label: "Setingkat Bidang", cls: "bg-orange-500/10 text-orange-700 border-orange-500/30", hex: "#ea580c" },
  SUBBIDANG: { label: "Setingkat Subbidang/Seksi", cls: "bg-red-500/10 text-red-700 border-red-500/30", hex: "#dc2626" },
};

export const ROLE_META = {
  admin: { label: "Administrator", cls: "bg-purple-100 text-purple-800 border-purple-300" },
  perangkat: { label: "Perangkat Daerah", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  verifikator: { label: "Verifikator", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  penilai: { label: "Penilai", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

// Skor interval kelas PP 18/2016
export const SKOR_KELAS = [0, 200, 400, 600, 800, 1000];
