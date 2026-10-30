/* SIMONLING – aplikasi utama (vanilla JS, tanpa build step) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const fmtTgl = s => { if (!s) return '-'; const [y, m, d] = s.split('-'); return `${+d} ${BULAN[+m - 1]} ${y}`; };
  const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const fmtNum = v => v == null ? '-' : (+v).toLocaleString('id-ID', { maximumFractionDigits: 3 });
  const today = () => new Date().toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

  let tahun = new Date().getFullYear();

  // ---------- Logika penaatan ----------
  const titikById = id => Store.get('titik', id);
  const bmFor = titik => Store.db.bakuMutu[titik.kelompok] || { parameter: [] };

  function cekParam(p, v) {
    if (v == null) return null;
    if (p.max != null && v > p.max) return false;
    if (p.min != null && v < p.min) return false;
    return true;
  }

  function evalHasil(h) {
    const t = titikById(h.titikId);
    if (!t) return { status: 'nodata', lewat: [] };
    const lewat = [];
    let ada = false;
    // Titik pembanding hanya acuan, tidak dinilai penaatannya.
    for (const p of bmFor(t).parameter) {
      const ok = cekParam(p, num(h.nilai[p.kode]));
      if (ok === null) continue;
      ada = true;
      if (!ok) lewat.push(p.kode);
    }
    if (t.jenis === 'pembanding') return { status: 'pembanding', lewat };
    return { status: !ada ? 'nodata' : lewat.length ? 'melebihi' : 'taat', lewat };
  }

  const periodeCount = t => REGULASI.frekuensi[t.frekuensi]?.periode || 12;
  const periodeIdx = (t, tgl) => Math.floor((+tgl.slice(5, 7) - 1) / (12 / periodeCount(t)));
  function periodeLabel(t, i) {
    const n = periodeCount(t);
    if (n === 12) return BULAN[i];
    if (n === 4) return 'TW ' + ['I', 'II', 'III', 'IV'][i];
    if (n === 2) return 'Smt ' + ['I', 'II'][i];
    return 'Tahunan';
  }
  // Status pelaksanaan tiap periode dalam satu tahun untuk satu titik.
  function statusPeriode(t, th = tahun) {
    const n = periodeCount(t);
    const now = new Date();
    const hasil = Store.list('hasil').filter(h => h.titikId === t.id && h.tanggal.startsWith(String(th)));
    return Array.from({ length: n }, (_, i) => {
      const hs = hasil.filter(h => periodeIdx(t, h.tanggal) === i).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      const endMonth = (i + 1) * (12 / n); // bulan terakhir periode (1-12)
      const lewatWaktu = th < now.getFullYear() || (th === now.getFullYear() && now.getMonth() + 1 > endMonth);
      const berjalan = th === now.getFullYear() && !lewatWaktu && now.getMonth() + 1 > endMonth - 12 / n;
      // Periode yang berakhir sebelum titik mulai dipantau tidak menjadi kewajiban.
      const sebelumMulai = t.mulai && `${th}-${String(endMonth).padStart(2, '0')}` < t.mulai.slice(0, 7);
      if (sebelumMulai && !hs.length) return { i, hasil: [], status: 'na' };
      if (t.jenis === 'pembanding') return { i, hasil: hs, status: hs.length ? 'pembanding' : 'belum' };
      if (hs.length) {
        const ev = hs.map(evalHasil);
        return { i, hasil: hs, status: ev.some(e => e.status === 'melebihi') ? 'melebihi' : 'taat' };
      }
      return { i, hasil: [], status: lewatWaktu ? 'terlewat' : berjalan ? 'berjalan' : 'belum' };
    });
  }

  function rekapAspek(aspek) {
    const titik = Store.list('titik').filter(t => t.aktif && t.aspek === aspek && t.jenis !== 'pembanding');
    let wajib = 0, terlaksana = 0, taat = 0, melebihi = 0, terlewat = 0;
    for (const t of titik) for (const p of statusPeriode(t)) {
      if (['belum', 'berjalan', 'na'].includes(p.status)) continue; // belum jatuh tempo / belum berlaku
      wajib++;
      if (p.status === 'terlewat') terlewat++;
      else { terlaksana++; p.status === 'taat' ? taat++ : melebihi++; }
    }
    return { titik: titik.length, wajib, terlaksana, taat, melebihi, terlewat,
      pctLaksana: wajib ? Math.round(terlaksana / wajib * 100) : null,
      pctTaat: terlaksana ? Math.round(taat / terlaksana * 100) : null };
  }

  // Limbah B3: stok & umur penyimpanan (FIFO) per kode limbah.
  function rekapLB3(sampai = today()) {
    const per = {};
    const rows = Store.list('lb3').filter(r => r.tanggal <= sampai).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    for (const r of rows) {
      const k = per[r.kode] ||= { kode: r.kode, masuk: 0, keluar: 0, antrian: [] };
      const j = +r.jumlah || 0;
      if (r.arah === 'masuk') { k.masuk += j; k.antrian.push({ tanggal: r.tanggal, sisa: j }); }
      else {
        k.keluar += j;
        let s = j;
        while (s > 0 && k.antrian.length) {
          const a = k.antrian[0];
          const ambil = Math.min(a.sisa, s);
          a.sisa -= ambil; s -= ambil;
          if (a.sisa <= 1e-9) k.antrian.shift();
        }
      }
    }
    const batas = Store.db.masaSimpanHari;
    return Object.values(per).map(k => {
      const tertua = k.antrian[0]?.tanggal || null;
      const umur = tertua ? daysBetween(tertua, sampai) : null;
      const sisaHari = umur == null ? null : batas - umur;
      const ref = REGULASI.limbahB3.find(x => x.kode === k.kode);
      return { ...k, nama: ref?.nama || k.kode, stok: k.masuk - k.keluar, tertua, umur, sisaHari,
        status: umur == null ? 'kosong' : sisaHari < 0 ? 'lewat' : sisaHari <= 14 ? 'segera' : 'aman' };
    }).sort((a, b) => (a.sisaHari ?? 1e9) - (b.sisaHari ?? 1e9));
  }

  // ---------- UI helper ----------
  const badge = (status, text) => `<span class="badge ${status}">${esc(text ?? LABEL_STATUS[status] ?? status)}</span>`;
  const jenisLabel = j => (REGULASI.jenisTitik[j] || j).replace('Titik ', '');
  const bmText = p => p.min != null && p.max != null ? `${p.min}–${p.max}` : p.max != null ? `≤${p.max}` : p.min != null ? `≥${p.min}` : '-';
  const LABEL_STATUS = { na: 'Sebelum mulai dipantau', pembanding: 'Pembanding', taat: 'Taat', melebihi: 'Melebihi BM', nodata: 'Tanpa data', terlewat: 'Tidak dilaksanakan', berjalan: 'Periode berjalan', belum: 'Belum jatuh tempo',
    aman: 'Aman', segera: '≤14 hari', lewat: 'Lewat masa simpan', kosong: 'Kosong' };

  function card(title, value, sub, cls = '') {
    return `<div class="card kpi ${cls}"><div class="kpi-title">${esc(title)}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub || ''}</div></div>`;
  }

  function openModal(title, bodyHTML, onOk, okText = 'Simpan') {
    const dlg = $('#modal');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHTML;
    $('#modalOk').textContent = okText;
    const form = $('#modalForm');
    form.onsubmit = e => {
      if (e.submitter?.value !== 'ok') return;
      try {
        if (onOk(new FormData(form), form) === false) e.preventDefault();
      } catch (err) { e.preventDefault(); alert(err.message); }
    };
    dlg.showModal();
  }

  const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;

  function download(name, text, type = 'application/json') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function toCSV(rows) {
    if (!rows.length) return '';
    const keys = [...new Set(rows.flatMap(Object.keys))];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [keys.map(q).join(';'), ...rows.map(r => keys.map(k => q(r[k])).join(';'))].join('\n');
  }

  // Grafik garis SVG sederhana dengan garis baku mutu.
  function lineChart(points, bm, satuan) {
    if (!points.length) return '<p class="muted">Belum ada data untuk grafik.</p>';
    const W = 640, H = 220, P = 36;
    const vals = points.map(p => p.v).concat([bm?.max, bm?.min].filter(x => x != null));
    const maxV = Math.max(...vals) * 1.15 || 1, minV = 0;
    const x = i => P + (points.length === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (points.length - 1));
    const y = v => H - P - (v - minV) / (maxV - minV) * (H - 2 * P);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
    const bmLine = v => v == null ? '' : `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" class="bm-line"/><text x="${W - P}" y="${y(v) - 4}" text-anchor="end" class="bm-text">BM ${fmtNum(v)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">
      <line x1="${P}" x2="${P}" y1="${P / 2}" y2="${H - P}" class="axis"/><line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" class="axis"/>
      <text x="4" y="${P / 2}" class="tick">${esc(satuan || '')}</text>
      ${bmLine(bm?.max)}${bmLine(bm?.min)}
      <path d="${path}" class="series"/>
      ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" class="${p.ok === false ? 'pt-bad' : 'pt'}"><title>${fmtTgl(p.t)}: ${fmtNum(p.v)}</title></circle>
        <text x="${x(i)}" y="${H - P + 14}" text-anchor="middle" class="tick">${p.t.slice(5, 7)}/${p.t.slice(2, 4)}</text>`).join('')}
    </svg>`;
  }

  function barChart(series, labels, legend) {
    const W = 640, H = 220, P = 36;
    const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser.data[i] || 0), 0));
    const maxV = Math.max(1, ...totals) * 1.1;
    const bw = (W - 2 * P) / labels.length * 0.6;
    const bx = i => P + (i + 0.2) * (W - 2 * P) / labels.length;
    let bars = '';
    labels.forEach((l, i) => {
      let acc = 0;
      series.forEach((ser, si) => {
        const v = ser.data[i] || 0;
        const h = v / maxV * (H - 2 * P);
        bars += `<rect x="${bx(i)}" y="${H - P - acc - h}" width="${bw}" height="${h}" class="bar s${si}"><title>${esc(ser.name)} ${l}: ${fmtNum(v)}</title></rect>`;
        acc += h;
      });
      bars += `<text x="${bx(i) + bw / 2}" y="${H - P + 14}" text-anchor="middle" class="tick">${esc(l)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart"><line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" class="axis"/>${bars}</svg>
      <div class="legend">${series.map((s, i) => `<span><i class="sw s${i}"></i>${esc(s.name)}</span>`).join('')}${legend || ''}</div>`;
  }

  // ---------- Halaman ----------
  const pages = {};

  pages.dashboard = () => {
    const asp = ['ald', 'emisi', 'ambien', 'alo'];
    const rek = Object.fromEntries(asp.map(a => [a, rekapAspek(a)]));
    const lb3 = rekapLB3();
    const lb3Warn = lb3.filter(r => r.status === 'lewat' || r.status === 'segera');
    const smp = Store.list('sampah').filter(s => s.tanggal.startsWith(String(tahun)));
    const totSmp = smp.reduce((s, r) => s + (+r.organik || 0) + (+r.anorganik || 0) + (+r.residu || 0), 0);
    const tpa = smp.reduce((s, r) => s + (+r.pengelolaan?.TPA || 0), 0);
    const dikelola = smp.reduce((s, r) => s + Object.values(r.pengelolaan || {}).reduce((a, b) => a + (+b || 0), 0), 0);
    const pctReduksi = dikelola ? Math.round((dikelola - tpa) / dikelola * 100) : null;

    const lewat = Store.list('hasil').filter(h => h.tanggal.startsWith(String(tahun)))
      .map(h => ({ h, e: evalHasil(h), t: titikById(h.titikId) }))
      .filter(x => x.e.status === 'melebihi').sort((a, b) => b.h.tanggal.localeCompare(a.h.tanggal));
    const terlewat = Store.list('titik').filter(t => t.aktif).flatMap(t => statusPeriode(t).filter(p => p.status === 'terlewat').map(p => ({ t, p })));

    const pctCls = v => v == null ? '' : v >= 100 ? 'good' : v >= 80 ? 'warn' : 'bad';
    return `
      <h2>Dashboard Pengelolaan Lingkungan ${tahun}</h2>
      <p class="muted">Ringkasan pelaksanaan pemantauan wajib (titik penaatan & pantau), tingkat penaatan baku mutu, serta pengelolaan limbah B3 dan sampah.</p>
      <div class="grid kpis">
        ${asp.map(a => card(REGULASI.aspek[a].nama,
          rek[a].pctLaksana == null ? '–' : rek[a].pctLaksana + '%',
          `Pelaksanaan ${rek[a].terlaksana}/${rek[a].wajib} periode jatuh tempo · ${rek[a].titik} titik<br>Penaatan BM: <b>${rek[a].pctTaat == null ? '–' : rek[a].pctTaat + '%'}</b>${rek[a].melebihi ? ` · <span class="txt-bad">${rek[a].melebihi} melebihi</span>` : ''}`,
          pctCls(rek[a].pctLaksana))).join('')}
        ${card('Limbah B3 di TPS', fmtNum(lb3.reduce((s, r) => s + r.stok, 0)) + ' kg',
          lb3Warn.length ? `<span class="txt-bad">${lb3Warn.length} jenis mendekati / lewat masa simpan</span>` : 'Semua dalam masa simpan', lb3Warn.some(r => r.status === 'lewat') ? 'bad' : lb3Warn.length ? 'warn' : 'good')}
        ${card('Timbulan Sampah ' + tahun, fmtNum(totSmp) + ' kg',
          `Tidak ke TPA (reduksi): <b>${pctReduksi == null ? '–' : pctReduksi + '%'}</b>`, pctReduksi == null ? '' : pctReduksi >= 50 ? 'good' : 'warn')}
      </div>

      <div class="grid two">
        <section class="card">
          <h3>⚠️ Hasil Melebihi Baku Mutu</h3>
          ${lewat.length ? `<table class="tbl"><thead><tr><th>Tanggal</th><th>Titik</th><th>Parameter</th></tr></thead><tbody>
            ${lewat.slice(0, 10).map(x => `<tr><td>${fmtTgl(x.h.tanggal)}</td><td>${esc(x.t?.kode)} – ${esc(x.t?.nama)}</td><td class="txt-bad">${esc(x.e.lewat.join(', '))}</td></tr>`).join('')}
          </tbody></table>` : '<p class="muted">Tidak ada pelampauan pada tahun ini. 👍</p>'}
        </section>
        <section class="card">
          <h3>⏰ Pemantauan Tidak Dilaksanakan</h3>
          ${terlewat.length ? `<table class="tbl"><thead><tr><th>Titik</th><th>Aspek</th><th>Periode</th></tr></thead><tbody>
            ${terlewat.slice(0, 10).map(x => `<tr><td>${esc(x.t.kode)} – ${esc(x.t.nama)}</td><td>${esc(REGULASI.aspek[x.t.aspek].nama)}</td><td>${periodeLabel(x.t, x.p.i)}</td></tr>`).join('')}
          </tbody></table>` : '<p class="muted">Semua periode yang jatuh tempo sudah dipantau.</p>'}
        </section>
        <section class="card">
          <h3>☣️ Status Masa Simpan Limbah B3</h3>
          ${lb3.filter(r => r.stok > 0).length ? `<table class="tbl"><thead><tr><th>Kode</th><th>Stok</th><th>Sisa hari</th><th>Status</th></tr></thead><tbody>
            ${lb3.filter(r => r.stok > 0).map(r => `<tr><td>${esc(r.kode)} – ${esc(r.nama)}</td><td>${fmtNum(r.stok)} kg</td><td>${r.sisaHari ?? '-'}</td><td>${badge(r.status)}</td></tr>`).join('')}
          </tbody></table>` : '<p class="muted">TPS kosong.</p>'}
        </section>
        <section class="card">
          <h3>🗑️ Timbulan Sampah Bulanan (kg)</h3>
          ${sampahChart(smp)}
        </section>
      </div>`;
  };

  function sampahChart(rows) {
    const series = REGULASI.sampah.jenis.map(j => ({ name: j, data: Array(12).fill(0) }));
    for (const r of rows) {
      const m = +r.tanggal.slice(5, 7) - 1;
      series[0].data[m] += +r.organik || 0;
      series[1].data[m] += +r.anorganik || 0;
      series[2].data[m] += +r.residu || 0;
    }
    return barChart(series, BULAN);
  }

  pages.jadwal = () => {
    const titik = Store.list('titik').filter(t => t.aktif);
    const filter = sessionStorage.getItem('jadwalAspek') || '';
    const rows = titik.filter(t => !filter || t.aspek === filter).sort((a, b) => a.aspek.localeCompare(b.aspek) || a.kode.localeCompare(b.kode));
    const icon = { na: '', pembanding: '◆', taat: '✔', melebihi: '✖', terlewat: '!', berjalan: '…', belum: '' };
    return `
      <h2>Pelaksanaan Pemantauan Lingkungan Wajib ${tahun}</h2>
      <p class="muted">Matriks realisasi vs kewajiban pemantauan per titik sesuai frekuensi. Klik sel untuk input / lihat hasil.</p>
      <div class="toolbar">
        <select id="fAspek">${opt('', 'Semua aspek', filter)}${Object.entries(REGULASI.aspek).map(([k, v]) => opt(k, v.nama, filter)).join('')}</select>
        <div class="legend">
          ${['taat', 'melebihi', 'terlewat', 'berjalan', 'belum', 'pembanding', 'na'].map(s => `<span><i class="cell-sw ${s}"></i>${LABEL_STATUS[s]}</span>`).join('')}
        </div>
      </div>
      <div class="card scroll">
        <table class="tbl matrix"><thead><tr><th>Titik</th><th>Jenis</th><th>Frek.</th>${BULAN.map(b => `<th>${b}</th>`).join('')}</tr></thead><tbody>
        ${rows.map(t => {
          const per = statusPeriode(t);
          const span = 12 / per.length;
          return `<tr><td><b>${esc(t.kode)}</b><br><small>${esc(t.nama)}</small></td><td>${esc(jenisLabel(t.jenis))}</td><td>${esc(REGULASI.frekuensi[t.frekuensi]?.label.split(' ')[0])}</td>
            ${per.map(p => `<td colspan="${span}" class="cell ${p.status}" data-titik="${t.id}" data-per="${p.i}" title="${periodeLabel(t, p.i)}: ${LABEL_STATUS[p.status]}">${icon[p.status]}${p.hasil.length ? `<small> ${p.hasil.map(h => +h.tanggal.slice(8)).join(',')}</small>` : ''}</td>`).join('')}</tr>`;
        }).join('') || `<tr><td colspan="15" class="muted">Belum ada titik. Tambahkan di menu Titik Penaatan.</td></tr>`}
        </tbody></table>
      </div>`;
  };
  pages.jadwal.bind = () => {
    $('#fAspek').onchange = e => { sessionStorage.setItem('jadwalAspek', e.target.value); render(); };
    $$('.matrix .cell').forEach(c => c.onclick = () => {
      const t = titikById(c.dataset.titik);
      const p = statusPeriode(t)[+c.dataset.per];
      if (p.hasil.length) location.hash = t.aspek + '?titik=' + t.id;
      else {
        const m = String(+c.dataset.per * (12 / periodeCount(t)) + 1).padStart(2, '0');
        formHasil(t.aspek, { titikId: t.id, tanggal: `${tahun}-${m}-01`, nilai: {} });
      }
    });
  };

  pages.titik = () => {
    const rows = Store.list('titik').slice().sort((a, b) => a.aspek.localeCompare(b.aspek) || a.kode.localeCompare(b.kode));
    return `
      <h2>Titik Penaatan & Titik Pantau</h2>
      <p class="muted">Daftar titik sesuai Persetujuan Teknis / PKPLH / RKL-RPL. Titik <b>penaatan</b> dievaluasi terhadap baku mutu sebagai kewajiban; titik <b>pantau</b> untuk pemantauan rutin.</p>
      <div class="toolbar"><button class="btn primary" id="addTitik">+ Tambah Titik</button></div>
      <div class="card scroll"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Aspek</th><th>Baku Mutu</th><th>Jenis</th><th>Frekuensi</th><th>Lokasi</th><th>Koordinat</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.map(t => `<tr class="${t.aktif ? '' : 'inactive'}">
          <td><b>${esc(t.kode)}</b>${t.contoh ? ' <span class="tag">contoh</span>' : ''}</td><td>${esc(t.nama)}</td><td>${esc(REGULASI.aspek[t.aspek]?.nama)}</td>
          <td>${esc(Store.db.bakuMutu[t.kelompok]?.label || t.kelompok)}</td><td>${esc(jenisLabel(t.jenis))}</td>
          <td>${esc(REGULASI.frekuensi[t.frekuensi]?.label)}</td><td>${esc(t.lokasi)}</td>
          <td>${t.lat && t.lng ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${t.lat},${t.lng}">${t.lat}, ${t.lng}</a>` : '-'}</td>
          <td>${t.aktif ? badge('taat', 'Aktif') : badge('nodata', 'Nonaktif')}</td>
          <td class="actions"><button class="btn sm" data-edit="${t.id}">Ubah</button><button class="btn sm danger" data-del="${t.id}">Hapus</button></td></tr>`).join('')}
      </tbody></table></div>`;
  };
  pages.titik.bind = () => {
    $('#addTitik').onclick = () => formTitik({ aspek: 'ald', kelompok: 'ald', jenis: 'penaatan', frekuensi: 'bulanan', aktif: true, mulai: today() });
    $$('[data-edit]').forEach(b => b.onclick = () => formTitik({ ...titikById(b.dataset.edit) }));
    $$('[data-del]').forEach(b => b.onclick = () => {
      const t = titikById(b.dataset.del);
      if (confirm(`Hapus titik ${t.kode}? Semua hasil pemantauan titik ini ikut terhapus.`)) { Store.remove('titik', t.id); render(); }
    });
  };

  function kelompokOptions(aspek, sel) {
    if (aspek === 'emisi') return Object.keys(REGULASI.sumberEmisi).map(k => opt(k, Store.db.bakuMutu[k]?.label || k, sel)).join('');
    return opt(aspek, Store.db.bakuMutu[aspek]?.label || aspek, sel);
  }

  function formTitik(t) {
    openModal(t.id ? 'Ubah Titik' : 'Tambah Titik', `
      <div class="form-grid">
        <label>Kode titik<input name="kode" required value="${esc(t.kode)}"></label>
        <label>Nama titik<input name="nama" required value="${esc(t.nama)}"></label>
        <label>Aspek<select name="aspek" id="fA">${Object.entries(REGULASI.aspek).map(([k, v]) => opt(k, v.nama, t.aspek)).join('')}</select></label>
        <label>Baku mutu / sumber<select name="kelompok" id="fK">${kelompokOptions(t.aspek, t.kelompok)}</select></label>
        <label>Jenis titik<select name="jenis">${Object.entries(REGULASI.jenisTitik).map(([k, v]) => opt(k, v, t.jenis)).join('')}</select></label>
        <label>Frekuensi wajib<select name="frekuensi">${Object.entries(REGULASI.frekuensi).map(([k, v]) => opt(k, v.label, t.frekuensi)).join('')}</select></label>
        <label>Lokasi / fasilitas<input name="lokasi" value="${esc(t.lokasi)}"></label>
        <label>Mulai dipantau<input name="mulai" type="date" value="${esc(t.mulai)}"></label>
        <label>Dasar kewajiban (no. PERTEK/PKPLH)<input name="dasar" value="${esc(t.dasar)}"></label>
        <label>Lintang (lat)<input name="lat" type="number" step="any" value="${esc(t.lat)}"></label>
        <label>Bujur (lng)<input name="lng" type="number" step="any" value="${esc(t.lng)}"></label>
        <label class="check"><input type="checkbox" name="aktif" ${t.aktif ? 'checked' : ''}> Aktif</label>
      </div>`, fd => {
      const o = Object.fromEntries(fd);
      Store.upsert('titik', { ...t, ...o, kode: o.kode.trim(), aktif: fd.has('aktif'), lat: num(o.lat), lng: num(o.lng), contoh: false });
      render();
    });
    $('#fA').onchange = e => { $('#fK').innerHTML = kelompokOptions(e.target.value); $('[name=frekuensi]').value = REGULASI.aspek[e.target.value].frekuensiDefault; };
  }

  // Halaman hasil pemantauan per aspek (ald / emisi / ambien)
  function hasilPage(aspek) {
    const info = REGULASI.aspek[aspek];
    const titik = Store.list('titik').filter(t => t.aspek === aspek).sort((a, b) => a.kode.localeCompare(b.kode));
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    const fTitik = qs.get('titik') || '';
    const rows = Store.list('hasil').filter(h => titik.some(t => t.id === h.titikId) && (!fTitik || h.titikId === fTitik) && h.tanggal.startsWith(String(tahun)))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    // grafik tren
    const chartTitik = titikById(fTitik) || titik[0];
    const params = chartTitik ? bmFor(chartTitik).parameter : [];
    const chartParam = qs.get('param') || params[0]?.kode;
    const p = params.find(x => x.kode === chartParam);
    const pts = chartTitik ? Store.list('hasil').filter(h => h.titikId === chartTitik.id && num(h.nilai[chartParam]) != null)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal)).slice(-24)
      .map(h => ({ t: h.tanggal, v: num(h.nilai[chartParam]), ok: p ? cekParam(p, num(h.nilai[chartParam])) : null })) : [];

    const groups = {};
    rows.forEach(h => (groups[titikById(h.titikId).kelompok] ||= []).push(h));

    return `
      <h2>${esc(info.nama)}</h2>
      <p class="muted">Acuan: ${esc(info.regulasi)}</p>
      <div class="toolbar">
        <select id="fTitik">${opt('', 'Semua titik', fTitik)}${titik.map(t => opt(t.id, `${t.kode} – ${t.nama}`, fTitik)).join('')}</select>
        <button class="btn primary" id="addHasil">+ Input Hasil Uji</button>
        <button class="btn" id="csvHasil">Unduh CSV</button>
      </div>
      ${chartTitik ? `<section class="card">
        <div class="chart-head"><h3>Tren ${esc(chartTitik.kode)} – ${esc(chartTitik.nama)}</h3>
          <select id="fParam">${params.map(x => opt(x.kode, x.kode, chartParam)).join('')}</select></div>
        ${lineChart(pts, p, p?.satuan)}
      </section>` : ''}
      ${Object.entries(groups).map(([kel, hs]) => {
        const bm = Store.db.bakuMutu[kel];
        return `<section class="card scroll"><h3>${esc(bm?.label || kel)}${bm?.verifikasi ? ' <span class="tag warn">verifikasi BM</span>' : ''}</h3>
        <table class="tbl"><thead><tr><th>Tanggal</th><th>Titik</th>${bm.parameter.map(p => `<th>${esc(p.kode)}<br><small>${esc(p.satuan)} · BM ${bmText(p)}</small></th>`).join('')}<th>Status</th><th>Lab / LHU</th><th></th></tr></thead><tbody>
        ${hs.map(h => { const t = titikById(h.titikId), e = evalHasil(h);
          const ref = t.jenis === 'pembanding';
          return `<tr class="${ref ? 'row-ref' : ''}"><td>${fmtTgl(h.tanggal)}</td><td>${esc(t.kode)}</td>
            ${bm.parameter.map(p => { const v = num(h.nilai[p.kode]); const ok = cekParam(p, v); return `<td class="${ok === false ? (ref ? 'cell-ref' : 'cell-bad') : ''}">${fmtNum(v)}</td>`; }).join('')}
            <td>${badge(e.status)}</td><td class="col-lab"><small>${esc(h.lab)}${h.lhu ? '<br>' + esc(h.lhu) : ''}</small></td>
            <td class="actions"><button class="btn sm" data-edit="${h.id}">Ubah</button><button class="btn sm danger" data-del="${h.id}">Hapus</button></td></tr>`; }).join('')}
        </tbody></table></section>`;
      }).join('') || `<div class="card muted">Belum ada hasil pemantauan pada ${tahun}.</div>`}`;
  }

  function bindHasil(aspek) {
    const setQS = (k, v) => {
      const qs = new URLSearchParams(location.hash.split('?')[1] || '');
      v ? qs.set(k, v) : qs.delete(k);
      if (k === 'titik') qs.delete('param');
      location.hash = aspek + (qs.toString() ? '?' + qs : '');
    };
    $('#fTitik').onchange = e => setQS('titik', e.target.value);
    $('#fParam') && ($('#fParam').onchange = e => setQS('param', e.target.value));
    $('#addHasil').onclick = () => formHasil(aspek, { titikId: $('#fTitik').value, tanggal: today(), nilai: {} });
    $('#csvHasil').onclick = () => {
      const rows = Store.list('hasil').filter(h => titikById(h.titikId)?.aspek === aspek).map(h => {
        const t = titikById(h.titikId);
        return { tanggal: h.tanggal, kode_titik: t.kode, nama_titik: t.nama, lab: h.lab, no_lhu: h.lhu, ...h.nilai, status: evalHasil(h).status };
      });
      download(`hasil-${aspek}.csv`, toCSV(rows), 'text/csv');
    };
    $$('[data-edit]').forEach(b => b.onclick = () => formHasil(aspek, JSON.parse(JSON.stringify(Store.get('hasil', b.dataset.edit)))));
    $$('[data-del]').forEach(b => b.onclick = () => { if (confirm('Hapus hasil ini?')) { Store.remove('hasil', b.dataset.del); render(); } });
  }

  function formHasil(aspek, h) {
    const titik = Store.list('titik').filter(t => t.aspek === aspek && (t.aktif || t.id === h.titikId));
    if (!titik.length) { alert('Tambahkan titik untuk aspek ini terlebih dahulu.'); location.hash = 'titik'; return; }
    const paramFields = tid => {
      const t = titikById(tid) || titik[0];
      return bmFor(t).parameter.map(p => `<label>${esc(p.kode)} <small>(${esc(p.satuan)}; BM ${bmText(p)})</small>
        <input name="p:${esc(p.kode)}" type="number" step="any" value="${esc(h.nilai[p.kode])}"></label>`).join('');
    };
    openModal(h.id ? 'Ubah Hasil Uji' : 'Input Hasil Uji – ' + REGULASI.aspek[aspek].nama, `
      <div class="form-grid">
        <label>Titik<select name="titikId" id="hT">${titik.map(t => opt(t.id, `${t.kode} – ${t.nama}`, h.titikId)).join('')}</select></label>
        <label>Tanggal sampling<input name="tanggal" type="date" required value="${esc(h.tanggal)}"></label>
        <label>Laboratorium<input name="lab" value="${esc(h.lab)}" placeholder="Lab terakreditasi KAN / teregistrasi KLHK"></label>
        <label>No. LHU<input name="lhu" value="${esc(h.lhu)}"></label>
      </div>
      <h4>Hasil parameter</h4>
      <div class="form-grid" id="hP">${paramFields(h.titikId)}</div>
      <label>Catatan / tindak lanjut<textarea name="catatan" rows="2">${esc(h.catatan)}</textarea></label>`, fd => {
      const nilai = {};
      for (const [k, v] of fd) if (k.startsWith('p:') && v !== '') nilai[k.slice(2)] = +v;
      if (!Object.keys(nilai).length) throw new Error('Isi minimal satu parameter.');
      Store.upsert('hasil', { ...h, titikId: fd.get('titikId'), tanggal: fd.get('tanggal'), lab: fd.get('lab'), lhu: fd.get('lhu'), catatan: fd.get('catatan'), nilai, contoh: false });
      render();
    });
    $('#hT').onchange = e => { $('#hP').innerHTML = paramFields(e.target.value); };
  }

  for (const a of ['ald', 'emisi', 'ambien', 'alo']) { pages[a] = () => hasilPage(a); pages[a].bind = () => bindHasil(a); }

  pages.lb3 = () => {
    const rek = rekapLB3();
    const rows = Store.list('lb3').filter(r => r.tanggal.startsWith(String(tahun))).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    // Neraca per triwulan (untuk pelaporan triwulanan)
    const kodes = [...new Set(Store.list('lb3').map(r => r.kode))];
    const neraca = kodes.map(k => {
      const tw = [0, 1, 2, 3].map(i => {
        const r = rows.filter(x => x.kode === k && Math.floor((+x.tanggal.slice(5, 7) - 1) / 3) === i);
        return { masuk: r.filter(x => x.arah === 'masuk').reduce((s, x) => s + +x.jumlah, 0), keluar: r.filter(x => x.arah === 'keluar').reduce((s, x) => s + +x.jumlah, 0) };
      });
      return { k, tw };
    });
    const namaKode = k => REGULASI.limbahB3.find(x => x.kode === k)?.nama || k;
    return `
      <h2>Pengelolaan Limbah B3</h2>
      <p class="muted">Logbook TPS Limbah B3, neraca, dan pengawasan masa simpan (PP 22/2021 & Permen LHK 6/2021). Batas masa simpan aktif: <b>${Store.db.masaSimpanHari} hari</b> — ubah di menu Baku Mutu. <br><small>${esc(REGULASI.masaSimpan.note)}</small></p>
      <div class="toolbar"><button class="btn primary" data-arah="masuk">+ Limbah Masuk TPS</button><button class="btn" data-arah="keluar">− Limbah Keluar (Manifest)</button><button class="btn" id="csvLb3">Unduh CSV</button></div>
      <section class="card scroll"><h3>Stok & Masa Simpan (per hari ini)</h3>
        <table class="tbl"><thead><tr><th>Kode</th><th>Jenis Limbah</th><th>Total Masuk</th><th>Total Keluar</th><th>Stok di TPS</th><th>Tgl. tertua tersimpan</th><th>Lama simpan</th><th>Sisa hari</th><th>Status</th></tr></thead><tbody>
        ${rek.map(r => `<tr><td><b>${esc(r.kode)}</b></td><td>${esc(r.nama)}</td><td>${fmtNum(r.masuk)}</td><td>${fmtNum(r.keluar)}</td><td><b>${fmtNum(r.stok)}</b></td><td>${fmtTgl(r.tertua)}</td><td>${r.umur ?? '-'} hari</td><td>${r.sisaHari ?? '-'}</td><td>${badge(r.status)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Belum ada data.</td></tr>'}
        </tbody></table></section>
      <section class="card scroll"><h3>Neraca Limbah B3 per Triwulan ${tahun} (kg)</h3>
        <table class="tbl"><thead><tr><th rowspan="2">Jenis</th>${['I', 'II', 'III', 'IV'].map(t => `<th colspan="2">TW ${t}</th>`).join('')}</tr><tr>${'<th>Masuk</th><th>Keluar</th>'.repeat(4)}</tr></thead><tbody>
        ${neraca.map(n => `<tr><td>${esc(n.k)} – ${esc(namaKode(n.k))}</td>${n.tw.map(t => `<td>${fmtNum(t.masuk)}</td><td>${fmtNum(t.keluar)}</td>`).join('')}</tr>`).join('')}
        </tbody></table></section>
      <section class="card scroll"><h3>Logbook ${tahun}</h3>
        <table class="tbl"><thead><tr><th>Tanggal</th><th>Arah</th><th>Kode</th><th>Jumlah</th><th>Sumber</th><th>Pengangkut / Penerima</th><th>No. Manifest</th><th>Keterangan</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${fmtTgl(r.tanggal)}</td><td>${r.arah === 'masuk' ? badge('aman', 'Masuk') : badge('segera', 'Keluar')}</td><td>${esc(r.kode)}</td><td>${fmtNum(r.jumlah)} ${esc(r.satuan)}</td><td>${esc(r.sumber)}</td><td>${esc(r.pihak)}</td><td>${esc(r.manifest)}</td><td>${esc(r.ket)}</td>
          <td class="actions"><button class="btn sm" data-edit="${r.id}">Ubah</button><button class="btn sm danger" data-del="${r.id}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted">Belum ada catatan.</td></tr>'}
        </tbody></table></section>`;
  };
  pages.lb3.bind = () => {
    $$('[data-arah]').forEach(b => b.onclick = () => formLb3({ arah: b.dataset.arah, tanggal: today(), satuan: 'kg', kode: 'B105d' }));
    $$('[data-edit]').forEach(b => b.onclick = () => formLb3({ ...Store.get('lb3', b.dataset.edit) }));
    $$('[data-del]').forEach(b => b.onclick = () => { if (confirm('Hapus catatan ini?')) { Store.remove('lb3', b.dataset.del); render(); } });
    $('#csvLb3').onclick = () => download('logbook-limbah-b3.csv', toCSV(Store.list('lb3').map(({ id, contoh, ...r }) => r)), 'text/csv');
  };
  function formLb3(r) {
    openModal(r.arah === 'masuk' ? 'Limbah B3 Masuk TPS' : 'Limbah B3 Keluar TPS', `
      <div class="form-grid">
        <label>Arah<select name="arah">${opt('masuk', 'Masuk TPS', r.arah)}${opt('keluar', 'Keluar TPS', r.arah)}</select></label>
        <label>Tanggal<input type="date" name="tanggal" required value="${esc(r.tanggal)}"></label>
        <label>Jenis limbah<select name="kode">${REGULASI.limbahB3.map(x => opt(x.kode, `${x.kode} – ${x.nama}`, r.kode)).join('')}</select></label>
        <label>Jumlah<input type="number" step="any" min="0" name="jumlah" required value="${esc(r.jumlah)}"></label>
        <label>Satuan<select name="satuan">${['kg', 'ton', 'liter', 'unit'].map(s => opt(s, s, r.satuan)).join('')}</select></label>
        <label>Sumber / fasilitas<input name="sumber" value="${esc(r.sumber)}"></label>
        <label>Pengangkut / penerima (berizin)<input name="pihak" value="${esc(r.pihak)}"></label>
        <label>No. manifest (Festronik)<input name="manifest" value="${esc(r.manifest)}"></label>
      </div>
      <label>Keterangan<textarea name="ket" rows="2">${esc(r.ket)}</textarea></label>
      <p class="muted"><small>Catatan: perhitungan stok & masa simpan menggunakan jumlah apa adanya; gunakan satuan yang konsisten per jenis limbah (disarankan kg).</small></p>`, fd => {
      const o = Object.fromEntries(fd);
      if (o.arah === 'keluar') {
        const stok = rekapLB3(o.tanggal).find(x => x.kode === o.kode)?.stok || 0;
        const lama = r.id && r.arah === 'keluar' && r.kode === o.kode ? +r.jumlah : 0;
        if (+o.jumlah > stok + lama + 1e-9 && !confirm(`Jumlah keluar (${o.jumlah}) melebihi stok tercatat (${fmtNum(stok + lama)}). Tetap simpan?`)) return false;
      }
      Store.upsert('lb3', { ...r, ...o, jumlah: +o.jumlah, contoh: false });
      render();
    });
  }

  pages.sampah = () => {
    const rows = Store.list('sampah').filter(r => r.tanggal.startsWith(String(tahun))).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const sum = k => rows.reduce((s, r) => s + (+r[k] || 0), 0);
    const tot = sum('organik') + sum('anorganik') + sum('residu');
    const pengel = Object.fromEntries(REGULASI.sampah.pengelolaan.map(p => [p, rows.reduce((s, r) => s + (+r.pengelolaan?.[p] || 0), 0)]));
    const totP = Object.values(pengel).reduce((a, b) => a + b, 0);
    return `
      <h2>Pengelolaan Sampah</h2>
      <p class="muted">Pencatatan timbulan & pengelolaan sampah non-B3 (${esc(REGULASI.sampah.regulasi)}).</p>
      <div class="toolbar"><button class="btn primary" id="addSampah">+ Catat Timbulan</button><button class="btn" id="csvSampah">Unduh CSV</button></div>
      <div class="grid kpis">
        ${card('Total timbulan ' + tahun, fmtNum(tot) + ' kg', `Organik ${fmtNum(sum('organik'))} · Anorganik ${fmtNum(sum('anorganik'))} · Residu ${fmtNum(sum('residu'))}`)}
        ${Object.entries(pengel).filter(([, v]) => v).map(([k, v]) => card(k, fmtNum(v) + ' kg', totP ? Math.round(v / totP * 100) + '% dari total dikelola' : '', k === 'TPA' ? 'warn' : 'good')).join('')}
      </div>
      <section class="card"><h3>Timbulan Bulanan (kg)</h3>${sampahChart(rows)}</section>
      <section class="card scroll"><h3>Catatan ${tahun}</h3>
        <table class="tbl"><thead><tr><th>Tanggal</th><th>Lokasi</th><th>Organik</th><th>Anorganik</th><th>Residu</th>${REGULASI.sampah.pengelolaan.map(p => `<th>${esc(p)}</th>`).join('')}<th></th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${fmtTgl(r.tanggal)}</td><td>${esc(r.lokasi)}</td><td>${fmtNum(r.organik)}</td><td>${fmtNum(r.anorganik)}</td><td>${fmtNum(r.residu)}</td>
          ${REGULASI.sampah.pengelolaan.map(p => `<td>${fmtNum(r.pengelolaan?.[p])}</td>`).join('')}
          <td class="actions"><button class="btn sm" data-edit="${r.id}">Ubah</button><button class="btn sm danger" data-del="${r.id}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="11" class="muted">Belum ada catatan.</td></tr>'}
        </tbody></table></section>`;
  };
  pages.sampah.bind = () => {
    $('#addSampah').onclick = () => formSampah({ tanggal: today(), pengelolaan: {} });
    $$('[data-edit]').forEach(b => b.onclick = () => formSampah(JSON.parse(JSON.stringify(Store.get('sampah', b.dataset.edit)))));
    $$('[data-del]').forEach(b => b.onclick = () => { if (confirm('Hapus catatan ini?')) { Store.remove('sampah', b.dataset.del); render(); } });
    $('#csvSampah').onclick = () => download('sampah.csv', toCSV(Store.list('sampah').map(({ id, contoh, pengelolaan, ...r }) => ({ ...r, ...pengelolaan }))), 'text/csv');
  };
  function formSampah(r) {
    openModal('Catat Timbulan Sampah', `
      <div class="form-grid">
        <label>Tanggal / periode<input type="date" name="tanggal" required value="${esc(r.tanggal)}"></label>
        <label>Lokasi / sumber<input name="lokasi" value="${esc(r.lokasi)}"></label>
        <label>Organik (kg)<input type="number" step="any" min="0" name="organik" value="${esc(r.organik)}"></label>
        <label>Anorganik (kg)<input type="number" step="any" min="0" name="anorganik" value="${esc(r.anorganik)}"></label>
        <label>Residu (kg)<input type="number" step="any" min="0" name="residu" value="${esc(r.residu)}"></label>
      </div>
      <h4>Pengelolaan (kg)</h4>
      <div class="form-grid">${REGULASI.sampah.pengelolaan.map(p => `<label>${esc(p)}<input type="number" step="any" min="0" name="m:${esc(p)}" value="${esc(r.pengelolaan?.[p])}"></label>`).join('')}</div>`, fd => {
      const pengelolaan = {};
      for (const [k, v] of fd) if (k.startsWith('m:') && v !== '') pengelolaan[k.slice(2)] = +v;
      Store.upsert('sampah', { ...r, tanggal: fd.get('tanggal'), lokasi: fd.get('lokasi'), organik: num(fd.get('organik')), anorganik: num(fd.get('anorganik')), residu: num(fd.get('residu')), pengelolaan, contoh: false });
      render();
    });
  }

  pages.baku = () => `
    <h2>Baku Mutu & Parameter</h2>
    <p class="muted">Nilai baku mutu yang dipakai untuk evaluasi penaatan otomatis. <b>Sesuaikan dengan Persetujuan Teknis / PKPLH yang berlaku</b> — terutama kelompok bertanda <span class="tag warn">verifikasi BM</span>. Kosongkan min/max jika tidak berlaku.</p>
    <form id="bmForm">
      ${Object.entries(Store.db.bakuMutu).map(([k, g]) => `<section class="card scroll"><h3>${esc(g.label)}${g.verifikasi ? ' <span class="tag warn">verifikasi BM</span>' : ''}</h3>
        <table class="tbl"><thead><tr><th>Parameter</th><th>Satuan</th><th>Min</th><th>Max</th></tr></thead><tbody>
        ${g.parameter.map((p, i) => `<tr><td>${esc(p.kode)}</td><td><input name="${k}|${i}|satuan" value="${esc(p.satuan)}"></td>
          <td><input type="number" step="any" name="${k}|${i}|min" value="${esc(p.min)}"></td><td><input type="number" step="any" name="${k}|${i}|max" value="${esc(p.max)}"></td></tr>`).join('')}
        </tbody></table>
        <label class="check"><input type="checkbox" name="${k}|verifikasi" ${g.verifikasi ? 'checked' : ''}> Tandai perlu verifikasi</label></section>`).join('')}
      <section class="card"><h3>Masa simpan Limbah B3</h3><label>Batas masa simpan di TPS (hari)<input type="number" min="1" name="masaSimpan" value="${Store.db.masaSimpanHari}"></label></section>
      <div class="toolbar"><button class="btn primary">Simpan Baku Mutu</button><button type="button" class="btn ghost" id="bmReset">Kembalikan ke nilai awal</button></div>
    </form>`;
  pages.baku.bind = () => {
    $('#bmForm').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const bm = JSON.parse(JSON.stringify(Store.db.bakuMutu));
      for (const [k, g] of Object.entries(bm)) {
        g.verifikasi = fd.has(`${k}|verifikasi`);
        g.parameter.forEach((p, i) => {
          p.satuan = fd.get(`${k}|${i}|satuan`);
          p.min = num(fd.get(`${k}|${i}|min`)) ?? undefined;
          p.max = num(fd.get(`${k}|${i}|max`)) ?? undefined;
        });
      }
      Store.setBakuMutu(bm);
      Store.setMasaSimpan(+fd.get('masaSimpan') || 90);
      alert('Baku mutu tersimpan.');
      render();
    };
    $('#bmReset').onclick = () => {
      if (!confirm('Kembalikan semua baku mutu ke nilai awal?')) return;
      Store.setBakuMutu(JSON.parse(JSON.stringify(REGULASI.bakuMutu)));
      Store.setMasaSimpan(REGULASI.masaSimpan.defaultHari);
      render();
    };
  };

  pages.data = () => {
    const n = c => Store.list(c).length;
    const contoh = ['titik', 'hasil', 'lb3', 'sampah'].reduce((s, c) => s + Store.list(c).filter(x => x.contoh).length, 0);
    return `
      <h2>Backup & Data</h2>
      <div class="card">
        <p>Data saat ini tersimpan <b>di browser ini</b> (localStorage): ${n('titik')} titik, ${n('hasil')} hasil uji, ${n('lb3')} catatan LB3, ${n('sampah')} catatan sampah.
        ${contoh ? `<br><span class="txt-warn">${contoh} entri adalah data <b>contoh fiktif</b> — hapus sebelum dipakai resmi.</span>` : ''}</p>
        <p class="muted">Lakukan backup rutin. Untuk pemakaian bersama banyak pengguna, hubungkan ke database/server (lihat README).</p>
        <div class="toolbar">
          <button class="btn primary" id="exp">⬇️ Backup (JSON)</button>
          <label class="btn">⬆️ Restore (JSON)<input type="file" id="imp" accept=".json,application/json" hidden></label>
          <label class="btn">➕ Tambah data dari file (JSON)<input type="file" id="merge" accept=".json,application/json" hidden></label>
          <button class="btn" id="delContoh">Hapus data contoh</button>
          <button class="btn danger" id="resetAll">Kosongkan semua data</button>
          <button class="btn ghost" id="resetSample">Muat ulang data contoh</button>
        </div>
      </div>`;
  };
  pages.data.bind = () => {
    $('#exp').onclick = () => download(`simonling-pep-rantau-${today()}.json`, Store.exportJSON());
    $('#imp').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { Store.importJSON(await f.text()); alert('Data berhasil dipulihkan.'); render(); }
      catch (err) { alert('Gagal: ' + err.message); }
    };
    $('#merge').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { alert(Store.mergeJSON(await f.text()) + ' entri ditambahkan.'); initYear(); render(); }
      catch (err) { alert('Gagal: ' + err.message); }
    };
    $('#delContoh').onclick = () => {
      if (!confirm('Hapus semua entri bertanda contoh?')) return;
      for (const c of ['hasil', 'lb3', 'sampah', 'titik']) Store.list(c).filter(x => x.contoh).forEach(x => Store.remove(c, x.id));
      render();
    };
    $('#resetAll').onclick = () => { if (confirm('Yakin kosongkan SEMUA data? Lakukan backup dulu.')) { Store.reset(false); render(); } };
    $('#resetSample').onclick = () => { if (confirm('Ganti semua data dengan data contoh?')) { Store.reset(true); render(); } };
  };

  // ---------- Router ----------
  function render() {
    const page = (location.hash.slice(1).split('?')[0]) || 'dashboard';
    const fn = pages[page] || pages.dashboard;
    $('#main').innerHTML = fn();
    fn.bind?.();
    $$('.sidebar a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    $('#sidebar').classList.remove('open');
    window.scrollTo(0, 0);
  }

  function initYear() {
    const years = new Set([new Date().getFullYear()]);
    for (const c of ['hasil', 'lb3', 'sampah']) Store.list(c).forEach(x => x.tanggal && years.add(+x.tanggal.slice(0, 4)));
    const sel = $('#tahun');
    sel.innerHTML = [...years].sort((a, b) => b - a).map(y => opt(y, y, tahun)).join('');
    sel.onchange = e => { tahun = +e.target.value; render(); };
  }

  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  window.addEventListener('hashchange', render);
  const _upsert = Store.upsert;
  Store.upsert = (...a) => { const r = _upsert(...a); initYear(); return r; };
  initYear();
  render();
})();
