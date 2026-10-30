# SIMONLING – Sistem Monitoring Pengelolaan Lingkungan
**Pertamina EP Rantau Field** · aplikasi web internal

Monitoring pelaksanaan pemantauan lingkungan wajib dan pengelolaan limbah:

| Modul | Isi |
|---|---|
| **Dashboard** | % pelaksanaan pemantauan & % penaatan baku mutu per aspek, daftar pelampauan, periode yang tidak dipantau, status masa simpan LB3, timbulan sampah |
| **Pelaksanaan Pemantauan** | Matriks realisasi vs kewajiban per titik (bulanan/triwulan/semester/tahunan): taat, melebihi BM, tidak dilaksanakan, periode berjalan |
| **Titik Penaatan & Pantau** | Master titik: kode, aspek, baku mutu, frekuensi, lokasi, koordinat (link Google Maps), dasar kewajiban (PERTEK/PKPLH) |
| **Air Limbah Domestik** | Input hasil uji, evaluasi otomatis vs Permen LHK P.68/2016, grafik tren + garis BM, ekspor CSV |
| **Emisi Sumber Tidak Bergerak** | Genset/gas engine, heater/boiler, flare – Permen LH 13/2009 & Permen LHK 11/2021 |
| **Kualitas Udara Ambien** | PP 22/2021 Lampiran VII |
| **Limbah B3** | Logbook masuk/keluar TPS, no. manifest Festronik, stok, umur simpan (FIFO) & peringatan masa simpan, neraca per triwulan |
| **Sampah** | Timbulan organik/anorganik/residu, pengelolaan (kompos, bank sampah, daur ulang, TPA), % reduksi |
| **Baku Mutu** | Semua nilai BM & batas masa simpan dapat diubah |
| **Backup & Data** | Backup/restore JSON, hapus data contoh |

> ⚠️ **Penting**
> - Data awal adalah **contoh fiktif** (bertanda "contoh"). Hapus di menu *Backup & Data* sebelum dipakai resmi.
> - Nilai baku mutu emisi (bertanda *verifikasi BM*) **wajib disesuaikan** dengan Persetujuan Teknis / PKPLH yang berlaku. Semua BM tetap perlu dicek terhadap dokumen lingkungan (AMDAL/UKL-UPL, RKL-RPL) masing-masing titik.

## Menjalankan
Tidak perlu instalasi/build. Buka `index.html` di browser, atau jalankan server lokal:

```bash
python3 -m http.server 8080
```

lalu buka http://localhost:8080.

### Publikasi via GitHub Pages
Settings → Pages → *Deploy from a branch* → `main` / root. Untuk data internal perusahaan, pertimbangkan repo **private** dan hosting di server intranet.

## Penyimpanan data
Versi ini menyimpan data di **browser masing-masing pengguna** (localStorage) — cocok untuk uji coba / satu operator. Lakukan backup JSON secara rutin.

Untuk pemakaian bersama (multi-user, login, audit trail), modul `js/store.js` dapat diganti dengan backend (mis. Supabase/PostgreSQL, Firebase, atau API server internal) tanpa mengubah halaman lain.

## Struktur
```
index.html        kerangka halaman & navigasi
css/style.css     tampilan (mendukung mode gelap & mobile)
js/regulasi.js    referensi regulasi, baku mutu default, kode limbah B3
js/store.js       penyimpanan data + data contoh
js/app.js         logika penaatan, halaman, grafik
```

## Rencana pengembangan
- Backend database & login per peran (admin HSSE, operator lapangan, viewer)
- Upload dokumen LHU (PDF) per hasil uji
- Kebisingan, air permukaan/air tanah, air terproduksi
- Ekspor laporan semester RKL-RPL / PROPER (Excel/PDF)
- Notifikasi email jadwal sampling & masa simpan LB3
