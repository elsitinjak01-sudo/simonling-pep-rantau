/*
 * Penyimpanan data di browser (localStorage).
 * Untuk penggunaan multi-user, ganti modul ini dengan backend/API
 * (mis. Supabase, Firebase, atau server internal) dengan antarmuka yang sama.
 */
const Store = (() => {
  const KEY = 'simonling-pep-rantau-v1';

  const empty = () => ({
    titik: [],
    hasil: [],
    lb3: [],
    sampah: [],
    bakuMutu: JSON.parse(JSON.stringify(REGULASI.bakuMutu)),
    masaSimpanHari: REGULASI.masaSimpan.defaultHari,
  });

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return withDefaults(JSON.parse(raw));
    } catch (e) { console.warn('Gagal membaca data', e); }
    return seed();
  }

  // Lengkapi data lama dengan kelompok baku mutu yang baru ditambahkan.
  function withDefaults(obj) {
    const d = Object.assign(empty(), obj);
    d.bakuMutu = Object.assign(JSON.parse(JSON.stringify(REGULASI.bakuMutu)), obj.bakuMutu);
    return d;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { alert('Gagal menyimpan data di browser: ' + e.message); }
  }

  function list(col) { return db[col]; }
  function get(col, id) { return db[col].find(x => x.id === id); }
  function upsert(col, item) {
    if (!item.id) { item.id = uid(); db[col].push(item); }
    else {
      const i = db[col].findIndex(x => x.id === item.id);
      if (i >= 0) db[col][i] = item; else db[col].push(item);
    }
    save();
    return item;
  }
  function remove(col, id) {
    db[col] = db[col].filter(x => x.id !== id);
    if (col === 'titik') db.hasil = db.hasil.filter(h => h.titikId !== id);
    save();
  }

  function setBakuMutu(bm) { db.bakuMutu = bm; save(); }
  function setMasaSimpan(h) { db.masaSimpanHari = h; save(); }

  function exportJSON() { return JSON.stringify(db, null, 2); }
  function importJSON(text) {
    const obj = JSON.parse(text);
    if (!Array.isArray(obj.titik)) throw new Error('Format file tidak dikenali');
    db = withDefaults(obj);
    save();
  }
  // Tambahkan data dari file tanpa menghapus data yang sudah ada.
  function mergeJSON(text) {
    const obj = JSON.parse(text);
    let n = 0;
    for (const col of ['titik', 'hasil', 'lb3', 'sampah']) {
      for (const item of obj[col] || []) {
        if (!item.id || db[col].some(x => x.id === item.id)) continue;
        db[col].push(item);
        n++;
      }
    }
    if (!n) throw new Error('Tidak ada data baru di file ini.');
    save();
    return n;
  }
  function reset(withSample) {
    db = withSample ? seed() : empty();
    save();
  }

  // Data contoh agar tampilan tidak kosong. Kode titik & angka FIKTIF.
  function seed() {
    const d = empty();
    const y = new Date().getFullYear();
    const T = (kode, nama, aspek, kelompok, lokasi, lat, lng, jenis) => ({
      id: uid(), kode, nama, aspek, kelompok, lokasi, lat, lng, jenis,
      frekuensi: REGULASI.aspek[aspek].frekuensiDefault, aktif: true, contoh: true,
    });
    d.titik = [
      T('ALD-01', 'Outlet IPAL Domestik Kantor', 'ald', 'ald', 'Area Kantor', 4.35, 98.05, 'penaatan'),
      T('ALD-02', 'Outlet IPAL Mess / Camp', 'ald', 'ald', 'Mess Karyawan', 4.34, 98.06, 'penaatan'),
      T('EMS-01', 'Stack Genset #1', 'emisi', 'emisi_genset', 'Stasiun Pengumpul', 4.36, 98.04, 'penaatan'),
      T('EMS-02', 'Stack Heater', 'emisi', 'emisi_heater', 'Stasiun Pengumpul', 4.36, 98.04, 'penaatan'),
      T('EMS-03', 'Flare Stack', 'emisi', 'emisi_flare', 'Stasiun Pengumpul', 4.37, 98.04, 'penaatan'),
      T('UA-01', 'Udara Ambien Pemukiman Terdekat', 'ambien', 'ambien', 'Desa sekitar', 4.33, 98.07, 'pantau'),
      T('UA-02', 'Udara Ambien Area Operasi', 'ambien', 'ambien', 'Stasiun Pengumpul', 4.36, 98.05, 'pantau'),
    ];
    const add = (t, tgl, nilai) => d.hasil.push({ id: uid(), titikId: t.id, tanggal: tgl, lab: 'Lab Terakreditasi (contoh)', nilai, contoh: true });
    const [ald1, ald2, g, h, f, ua1, ua2] = d.titik;
    for (let m = 1; m <= 9; m++) {
      const mm = String(m).padStart(2, '0');
      add(ald1, `${y}-${mm}-10`, { pH: 7.1, BOD: 18 + m, COD: 55 + m * 2, TSS: 14 + m, 'Minyak & Lemak': 1.2, Amoniak: 3.4, 'Total Coliform': 900, Debit: 80 });
      if (m !== 4) add(ald2, `${y}-${mm}-12`, { pH: 7.4, BOD: m === 7 ? 38 : 22, COD: 70, TSS: 20, 'Minyak & Lemak': 2, Amoniak: 6, 'Total Coliform': 1500, Debit: 90 });
    }
    add(g, `${y}-04-20`, { 'NOx (sbg NO2)': 640, CO: 210, SO2: 120, Partikulat: 45, Opasitas: 10 });
    add(h, `${y}-04-21`, { 'NOx (sbg NO2)': 180, SO2: 20, CO: 60, Partikulat: 12 });
    add(f, `${y}-04-21`, { Opasitas: 15 });
    add(ua1, `${y}-05-03`, { SO2: 22, NO2: 31, CO: 1200, O3: 40, 'HC (NMHC)': 60, PM10: 38, 'PM2.5': 21, TSP: 85, Pb: 0.1 });
    add(ua2, `${y}-05-04`, { SO2: 35, NO2: 48, CO: 1800, O3: 52, 'HC (NMHC)': 90, PM10: 52, 'PM2.5': 30, TSP: 140, Pb: 0.2 });

    const lb = (tanggal, arah, kode, jumlah, ket) => d.lb3.push({ id: uid(), tanggal, arah, kode, jumlah, satuan: 'kg', sumber: 'Stasiun Pengumpul', pihak: arah === 'keluar' ? 'Transporter berizin (contoh)' : '', manifest: arah === 'keluar' ? 'MNF-CONTOH-001' : '', ket: ket || '', contoh: true });
    lb(`${y}-03-02`, 'masuk', 'B105d', 400);
    lb(`${y}-05-15`, 'keluar', 'B105d', 400);
    lb(`${y}-07-01`, 'masuk', 'B105d', 250);
    lb(`${y}-06-10`, 'masuk', 'B110d', 60);
    lb(`${y}-08-05`, 'masuk', 'A102d', 120);
    lb(`${y}-09-20`, 'masuk', 'B104d', 35);

    for (let m = 1; m <= 9; m++) {
      const mm = String(m).padStart(2, '0');
      d.sampah.push({ id: uid(), tanggal: `${y}-${mm}-28`, lokasi: 'Kantor & Mess', organik: 300 + m * 10, anorganik: 150 + m * 5, residu: 80, pengelolaan: { 'Kompos / Maggot': 250, 'Bank Sampah': 120, TPA: 160 }, contoh: true });
    }
    return d;
  }

  let db = load();
  save();

  return { list, get, upsert, remove, setBakuMutu, setMasaSimpan, exportJSON, importJSON, mergeJSON, reset, get db() { return db; } };
})();
