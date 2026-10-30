/*
 * Referensi regulasi & baku mutu default.
 * Nilai di sini adalah NILAI AWAL dan dapat diubah dari menu "Baku Mutu".
 * Selalu sesuaikan dengan Persetujuan Teknis / PKPLH / dokumen lingkungan
 * (AMDAL/UKL-UPL, RKL-RPL) yang berlaku untuk masing-masing titik.
 */
const REGULASI = {
  aspek: {
    ald: {
      nama: 'Air Limbah Domestik',
      regulasi: 'Permen LHK No. P.68/2016 tentang Baku Mutu Air Limbah Domestik',
      frekuensiDefault: 'bulanan',
    },
    emisi: {
      nama: 'Emisi Sumber Tidak Bergerak',
      regulasi: 'Permen LH No. 13/2009 (Usaha/Kegiatan Migas) & Permen LHK No. 11/2021 (Mesin Pembakaran Dalam)',
      frekuensiDefault: 'semester',
    },
    ambien: {
      nama: 'Kualitas Udara Ambien',
      regulasi: 'PP No. 22/2021 Lampiran VII – Baku Mutu Udara Ambien',
      frekuensiDefault: 'semester',
    },
  },

  // Baku mutu per kelompok. min/max opsional; satuan untuk tampilan.
  bakuMutu: {
    ald: {
      label: 'Air Limbah Domestik (P.68/2016)',
      parameter: [
        { kode: 'pH', satuan: '-', min: 6, max: 9 },
        { kode: 'BOD', satuan: 'mg/L', max: 30 },
        { kode: 'COD', satuan: 'mg/L', max: 100 },
        { kode: 'TSS', satuan: 'mg/L', max: 30 },
        { kode: 'Minyak & Lemak', satuan: 'mg/L', max: 5 },
        { kode: 'Amoniak', satuan: 'mg/L', max: 10 },
        { kode: 'Total Coliform', satuan: 'jml/100 mL', max: 3000 },
        { kode: 'Debit', satuan: 'L/orang/hari', max: 100 },
      ],
    },
    emisi_genset: {
      label: 'Emisi Genset / Mesin Pembakaran Dalam',
      verifikasi: true,
      parameter: [
        { kode: 'NOx (sbg NO2)', satuan: 'mg/Nm³', max: 1000 },
        { kode: 'CO', satuan: 'mg/Nm³', max: 600 },
        { kode: 'SO2', satuan: 'mg/Nm³', max: 800 },
        { kode: 'Partikulat', satuan: 'mg/Nm³', max: 150 },
        { kode: 'Opasitas', satuan: '%', max: 20 },
      ],
    },
    emisi_heater: {
      label: 'Emisi Heater / Boiler (BBG)',
      verifikasi: true,
      parameter: [
        { kode: 'NOx (sbg NO2)', satuan: 'mg/Nm³', max: 400 },
        { kode: 'SO2', satuan: 'mg/Nm³', max: 150 },
        { kode: 'CO', satuan: 'mg/Nm³', max: 500 },
        { kode: 'Partikulat', satuan: 'mg/Nm³', max: 50 },
      ],
    },
    emisi_flare: {
      label: 'Emisi Flare',
      verifikasi: true,
      parameter: [
        { kode: 'Opasitas', satuan: '%', max: 40 },
      ],
    },
    ambien: {
      label: 'Udara Ambien (PP 22/2021 Lamp. VII)',
      parameter: [
        { kode: 'SO2', satuan: 'µg/Nm³ (1 jam)', max: 150 },
        { kode: 'NO2', satuan: 'µg/Nm³ (1 jam)', max: 200 },
        { kode: 'CO', satuan: 'µg/Nm³ (1 jam)', max: 10000 },
        { kode: 'O3', satuan: 'µg/Nm³ (1 jam)', max: 150 },
        { kode: 'HC (NMHC)', satuan: 'µg/Nm³ (3 jam)', max: 160 },
        { kode: 'PM10', satuan: 'µg/Nm³ (24 jam)', max: 75 },
        { kode: 'PM2.5', satuan: 'µg/Nm³ (24 jam)', max: 55 },
        { kode: 'TSP', satuan: 'µg/Nm³ (24 jam)', max: 230 },
        { kode: 'Pb', satuan: 'µg/Nm³ (24 jam)', max: 2 },
      ],
    },
  },

  sumberEmisi: {
    emisi_genset: 'Genset / Gas Engine',
    emisi_heater: 'Heater / Boiler',
    emisi_flare: 'Flare',
  },

  frekuensi: {
    bulanan: { label: 'Bulanan', periode: 12 },
    triwulan: { label: 'Triwulan (3 bulan)', periode: 4 },
    semester: { label: 'Semester (6 bulan)', periode: 2 },
    tahunan: { label: 'Tahunan', periode: 1 },
  },

  // Limbah B3 – kode umum (Lampiran IX PP 22/2021). Daftar dapat dilengkapi.
  limbahB3: [
    { kode: 'B105d', nama: 'Minyak pelumas bekas', kategori: 2 },
    { kode: 'B110d', nama: 'Kain majun bekas & sejenisnya', kategori: 2 },
    { kode: 'B104d', nama: 'Kemasan bekas B3', kategori: 2 },
    { kode: 'B109d', nama: 'Filter bekas', kategori: 2 },
    { kode: 'B107d', nama: 'Limbah elektronik / lampu TL', kategori: 2 },
    { kode: 'A102d', nama: 'Aki / baterai bekas', kategori: 1 },
    { kode: 'A108d', nama: 'Limbah terkontaminasi B3', kategori: 1 },
    { kode: 'A337-1', nama: 'Limbah medis / klinik', kategori: 1 },
    { kode: 'LAIN', nama: 'Lainnya (sebutkan di keterangan)', kategori: 1 },
  ],

  // Masa simpan maksimal di TPS LB3 (PP 22/2021 Ps. 285) – dalam hari.
  masaSimpan: {
    note: '90 hari (≥50 kg/hari); 180 hari (<50 kg/hari, kategori 1); 365 hari (<50 kg/hari, kategori 2 / sumber spesifik umum).',
    defaultHari: 90,
  },

  sampah: {
    regulasi: 'UU No. 18/2008 & PP No. 81/2012 tentang Pengelolaan Sampah Rumah Tangga & Sejenisnya',
    jenis: ['Organik', 'Anorganik', 'Residu'],
    pengelolaan: ['Kompos / Maggot', 'Bank Sampah', 'Daur Ulang (pihak ke-3)', 'TPA', 'Lainnya'],
  },
};
