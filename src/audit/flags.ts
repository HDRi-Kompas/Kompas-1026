/**
 * KOMPAS - Quality Warning Flags (F01–F14)
 * Based on KOMPAS_data_audit_v4.xlsx (Sheet Penanda & Placeholder)
 * and Handover Tim Aplikasi KOMPAS (Revisi 29 Oktober 2026).
 */

import { NormalizedMetadata } from '../types/audit';

export interface QualityFlagResult {
  id: 'F01' | 'F02' | 'F03' | 'F04' | 'F05' | 'F06' | 'F07' | 'F08' | 'F09' | 'F10' | 'F11' | 'F12' | 'F13' | 'F14';
  name: string;
  description: string;
  isTriggered: boolean;
  evidence?: string;
  reason?: string;
}

export const PLACEHOLDER_DICTIONARY = [
  'Admin Admin',
  '-',
  'Belum Ada',
  'Not Specified',
  'None',
  'No information provided',
  'Dataset spasial untuk kebutuhan GIS',
  'Name of the responsible organization',
  'Address of the electronic mailbox',
  'Version of the format',
  'Alphanumeric value identifying an instance in the namespace',
  "General explanation of the data producer's knowledge",
  'Restrictions on the access and use of a resource or metadata',
  'Other restrictions and legal prerequisites',
  'diisi link webservice wms ketika sudah disebarluaskan',
];

export const QUALITY_FLAGS_DEFINITIONS: Record<QualityFlagResult['id'], { name: string; description: string }> = {
  F01: {
    name: 'Teks templat, salinan, atau bawaan',
    description: 'Isi elemen berupa teks definisi standar, salinan elemen lain (misal abstrak = judul atau abstrak = lineage), atau teks bawaan yang tidak spesifik.',
  },
  F02: {
    name: 'Bounding box tidak konsisten atau tidak informatif',
    description: 'Koordinat 0,0,0,0, tidak ada, di luar amplop wilayah Indonesia (bujur 90–145, lintang -15 s.d 10), atau terlalu luas untuk dataset lokal.',
  },
  F03: {
    name: 'Jalur lokal atau nama host pada metadata',
    description: 'Jalur berkas lokal (C:\\, file://, //) atau nama host perangkat lokal tercantum dalam metadata.',
  },
  F04: {
    name: 'Bukan XML ISO (ESRI atau rekaman CKAN)',
    description: 'Format data merupakan metadata ESRI XML (.shp.xml) atau rekaman JSON CKAN hasil harvest portal.',
  },
  F05: {
    name: 'Bahasa tidak sesuai isi atau bukan kode ISO',
    description: 'Kode bahasa "eng" untuk isi berbahasa Indonesia, atau teks bebas (misal "bahasa Indonesia") alih-alih kode ISO 639-2 ("ind").',
  },
  F06: {
    name: 'Kontak kosong, placeholder, atau non-institusional',
    description: 'Kontak nilReason=missing, "Belum Ada", "-", nama "Admin Admin", email domain non-institusi (gmail.com), atau domain tampak keliru.',
  },
  F07: {
    name: 'CRS tidak konsisten atau tidak valid',
    description: 'CRS metadata berbeda dari layanan yang disediakan, kode bukan EPSG valid, atau kode berisi teks templat.',
  },
  F08: {
    name: 'Tanggal tidak konsisten atau ambigu',
    description: 'Periode data tidak cocok dengan judul, tanggal metadata lebih awal dari tanggal sitasi data, atau terdapat tiga tanggal berbeda tanpa kejelasan.',
  },
  F09: {
    name: 'Pernyataan kualitas kontradiktif atau templat',
    description: 'Laporan DQ menggunakan unit templat, nilai ambang batas dilaporkan sebagai hasil terukur, atau nilai kelulusan tidak cocok dengan penjelasan.',
  },
  F10: {
    name: 'Teks rusak, terpotong, atau salah ketik',
    description: 'Fragmen teks tercampur, kalimat terpotong (misal berakhiran gantung), atau salah ejaan nyata pada elemen atau nama layer.',
  },
  F11: {
    name: 'Elemen ganda atau struktur bermasalah',
    description: 'Blok extent ganda dengan isi identik, elemen city ganda, atau perujukan codelist yang keliru (misal MD_ScopeCode pada elemen peran).',
  },
  F12: {
    name: 'Lisensi bawaan GeoNode',
    description: 'Teks lisensi bawaan GeoNode seperti "Public Domain (PD)" dengan rujukan situs copyright.gov (AS), atau "Not Specified".',
  },
  F13: {
    name: 'Nama standar menyebut ISO 19139',
    description: 'Elemen metadataStandardName mencantumkan spesifikasi implementasi XML (ISO 19139) alih-alih standar isi (SNI 8843-1:2019 / ISO 19115-1:2014).',
  },
  F14: {
    name: 'Penanda penolakan kurasi pada portal',
    description: 'Rekaman memuat status kurasi review_status: "rejected" atau catatan kurasi ekstra kegagalan format.',
  },
};

/**
 * Evaluates F01 to F14 warning flags against a normalized metadata object and raw text.
 */
export function evaluateQualityFlags(metadata?: NormalizedMetadata, rawText = ''): QualityFlagResult[] {
  const flags: QualityFlagResult[] = [];

  const rawCorpus = rawText.toLowerCase();
  const title = (metadata?.title || '').trim().toLowerCase();
  const abstract = (metadata?.abstract || '').trim().toLowerCase();
  const purpose = (metadata?.purpose || '').trim().toLowerCase();
  const lineage = (metadata?.processing?.lineageStatement || '').trim().toLowerCase();
  const rawFormat = metadata?.rawFormat || 'unknown';

  // Helper to check placeholder presence in string
  function containsPlaceholder(text: string): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const ph of PLACEHOLDER_DICTIONARY) {
      if (lower.includes(ph.toLowerCase())) return ph;
    }
    return null;
  }

  // F01: Teks templat, salinan, atau bawaan
  let f01Triggered = false;
  let f01Evidence = '';
  if (title && abstract && (title === abstract || abstract.includes(title) && abstract.length <= title.length + 5)) {
    f01Triggered = true;
    f01Evidence = 'Abstrak identik atau menyalin persis judul dataset.';
  } else if (abstract && lineage && (abstract === lineage || lineage.includes(abstract))) {
    f01Triggered = true;
    f01Evidence = 'Pernyataan lineage identik atau menyalin abstrak.';
  } else {
    const phInPurpose = containsPlaceholder(purpose);
    const phInAbstract = containsPlaceholder(abstract);
    const phInLineage = containsPlaceholder(lineage);
    if (phInPurpose) {
      f01Triggered = true;
      f01Evidence = `Tujuan memuat teks templat: "${phInPurpose}"`;
    } else if (phInAbstract) {
      f01Triggered = true;
      f01Evidence = `Abstrak memuat teks templat: "${phInAbstract}"`;
    } else if (phInLineage) {
      f01Triggered = true;
      f01Evidence = `Lineage memuat teks templat: "${phInLineage}"`;
    }
  }
  flags.push({
    id: 'F01',
    ...QUALITY_FLAGS_DEFINITIONS.F01,
    isTriggered: f01Triggered,
    evidence: f01Triggered ? f01Evidence : undefined,
  });

  // F02: Bounding box tidak konsisten atau tidak informatif
  let f02Triggered = false;
  let f02Evidence = '';
  const bbox = metadata?.spatialExtent;
  if (
    !bbox ||
    bbox.westBoundLongitude === undefined ||
    bbox.eastBoundLongitude === undefined ||
    bbox.southBoundLatitude === undefined ||
    bbox.northBoundLatitude === undefined
  ) {
    f02Triggered = true;
    f02Evidence = 'Bounding box spasial tidak ditemukan dalam berkas metadata.';
  } else {
    const { westBoundLongitude: w, eastBoundLongitude: e, southBoundLatitude: s, northBoundLatitude: n } = bbox;
    if (w === 0 && e === 0 && s === 0 && n === 0) {
      f02Triggered = true;
      f02Evidence = 'Koordinat bounding box bernilai default kosong (0, 0, 0, 0).';
    } else if (w < 90 || e > 145 || s < -15 || n > 10) {
      // Outside Indonesian envelope with buffer
      f02Triggered = true;
      f02Evidence = `Koordinat [${w}, ${s}, ${e}, ${n}] berada di luar amplop wilayah Indonesia [90–145 BT, -15 s.d 10 LU].`;
    } else if ((e - w > 35) && (n - s > 15)) {
      // Covers almost entire national extent
      f02Triggered = true;
      f02Evidence = `Cakupan spasial [${w.toFixed(2)}..${e.toFixed(2)} BT, ${s.toFixed(2)}..${n.toFixed(2)} LU] mencakup seluruh Indonesia untuk dataset berlingkup lokal.`;
    }
  }
  flags.push({
    id: 'F02',
    ...QUALITY_FLAGS_DEFINITIONS.F02,
    isTriggered: f02Triggered,
    evidence: f02Triggered ? f02Evidence : undefined,
  });

  // F03: Jalur lokal atau nama host pada metadata
  let f03Triggered = false;
  let f03Evidence = '';
  const localPathRegex = /\b([a-zA-Z]:\\[^<"\s]+|file:\/\/[^\s<"']+|\/\/[a-zA-Z0-9_\-]+\\[^<"\s]+)/i;
  const localMatch = rawText.match(localPathRegex);
  const onlineUrl = metadata?.distribution?.onlineResourceUrl || '';
  if (localMatch) {
    f03Triggered = true;
    f03Evidence = `Ditemukan jalur berkas lokal: "${localMatch[1]}"`;
  } else if (/^[a-zA-Z]:\\/i.test(onlineUrl) || onlineUrl.startsWith('file://')) {
    f03Triggered = true;
    f03Evidence = `Tautan akses mengarah ke sistem berkas lokal: "${onlineUrl}"`;
  } else if (/desktop-[a-z0-9]+|laptop-[a-z0-9]+/i.test(rawText)) {
    f03Triggered = true;
    f03Evidence = 'Ditemukan bocoran nama host/perangkat keras lokal pada metadata.';
  }
  flags.push({
    id: 'F03',
    ...QUALITY_FLAGS_DEFINITIONS.F03,
    isTriggered: f03Triggered,
    evidence: f03Triggered ? f03Evidence : undefined,
  });

  // F04: Bukan XML ISO (ESRI atau rekaman CKAN)
  const isNonIso = rawFormat === 'xml_esri' || rawFormat === 'json_catalog';
  flags.push({
    id: 'F04',
    ...QUALITY_FLAGS_DEFINITIONS.F04,
    isTriggered: isNonIso,
    evidence: isNonIso
      ? `Format berkas adalah ${rawFormat === 'xml_esri' ? 'ESRI XML (.shp.xml)' : 'JSON CKAN package_show'} (bukan skema XML ISO 19139 / 19115-3).`
      : undefined,
  });

  // F05: Bahasa tidak sesuai isi atau bukan kode ISO
  let f05Triggered = false;
  let f05Evidence = '';
  const lang = (metadata?.language || metadata?.metaMetadata?.metadataLanguage || '').toLowerCase().trim();
  if (lang === 'eng' && (title.includes('dan') || abstract.includes('dan') || abstract.includes('data') || abstract.includes('wilayah') || abstract.includes('laut'))) {
    f05Triggered = true;
    f05Evidence = 'Elemen bahasa mencantumkan "eng" (Inggris) padahal konten judul/abstrak berbahasa Indonesia.';
  } else if (lang.includes('indonesia') || lang.includes('bahasa') || (lang.length > 3 && !/^[a-z]{2,3}$/.test(lang))) {
    f05Triggered = true;
    f05Evidence = `Bahasa didefinisikan dengan teks bebas ("${lang}"), bukan kode standar ISO 639-2 ("ind").`;
  }
  flags.push({
    id: 'F05',
    ...QUALITY_FLAGS_DEFINITIONS.F05,
    isTriggered: f05Triggered,
    evidence: f05Triggered ? f05Evidence : undefined,
  });

  // F06: Kontak kosong, placeholder, atau non-institusional
  let f06Triggered = false;
  let f06Evidence = '';
  const contact = metadata?.contact;
  const email = (contact?.email || '').toLowerCase().trim();
  const contactOrg = (contact?.organization || '').trim();
  const contactName = (contact?.individualName || '').trim();
  if (!email && !contactOrg && !contactName) {
    f06Triggered = true;
    f06Evidence = 'Blok narahubung/kustodian tidak terisi atau berstatus nilReason=missing.';
  } else if (contactName.toLowerCase() === 'admin admin' || contactOrg.toLowerCase() === 'admin admin') {
    f06Triggered = true;
    f06Evidence = 'Nama kontak merupakan akun default CMS portal ("Admin Admin").';
  } else if (email === 'belum ada' || email === '-' || contactName === 'belum ada' || contactName === '-') {
    f06Triggered = true;
    f06Evidence = 'Sarana kontak berisi teks stub placeholder ("Belum Ada" / "-").';
  } else if (email.endsWith('@gmail.com') || email.endsWith('@yahoo.com')) {
    f06Triggered = true;
    f06Evidence = `Alamat email kustodian resmi menggunakan penyedia gratis non-institusional ("${email}").`;
  } else if (email.includes('@kkp.co.id')) {
    f06Triggered = true;
    f06Evidence = `Alamat email menggunakan domain komersial ("${email}"), bukan domain instansi pemerintah (@kkp.go.id).`;
  }
  flags.push({
    id: 'F06',
    ...QUALITY_FLAGS_DEFINITIONS.F06,
    isTriggered: f06Triggered,
    evidence: f06Triggered ? f06Evidence : undefined,
  });

  // F07: CRS tidak konsisten atau tidak valid
  let f07Triggered = false;
  let f07Evidence = '';
  const crsCode = (metadata?.spatialExtent?.crsCode || '').trim();
  const crsName = (metadata?.spatialExtent?.crsName || '').trim();
  if (/alphanumeric value identifying an instance in the namespace/i.test(crsCode) || /alphanumeric/i.test(crsName)) {
    f07Triggered = true;
    f07Evidence = 'Kode referensi spasial berisi teks definisi templat ISO.';
  } else if (rawCorpus.includes('epsg:4326') && (rawCorpus.includes('epsg:32748') || rawCorpus.includes('epsg:32749') || rawCorpus.includes('epsg:3857'))) {
    f07Triggered = true;
    f07Evidence = 'CRS pada metadata (EPSG:4326) berbeda dengan CRS proyeksi pada URL layanan WMS/WFS.';
  }
  flags.push({
    id: 'F07',
    ...QUALITY_FLAGS_DEFINITIONS.F07,
    isTriggered: f07Triggered,
    evidence: f07Triggered ? f07Evidence : undefined,
  });

  // F08: Tanggal tidak konsisten atau ambigu
  let f08Triggered = false;
  let f08Evidence = '';
  const datePub = metadata?.temporalExtent?.publicationDate;
  const dateMeta = metadata?.metaMetadata?.metadataDate;
  const dateStart = metadata?.temporalExtent?.startDate;
  if (dateStart && title.match(/\b(20\d\d)\b/)) {
    const yearInTitle = parseInt(title.match(/\b(20\d\d)\b/)![1], 10);
    const startYear = parseInt(dateStart.slice(0, 4), 10);
    if (!isNaN(yearInTitle) && !isNaN(startYear) && Math.abs(yearInTitle - startYear) > 5) {
      f08Triggered = true;
      f08Evidence = `Tahun pada judul (${yearInTitle}) berbeda jauh dengan rentang temporal data (${startYear}).`;
    }
  }
  if (!f08Triggered && datePub && dateMeta && dateMeta < datePub) {
    f08Triggered = true;
    f08Evidence = `Tanggal berkas metadata (${dateMeta}) lebih awal dari tanggal publikasi dataset (${datePub}).`;
  }
  flags.push({
    id: 'F08',
    ...QUALITY_FLAGS_DEFINITIONS.F08,
    isTriggered: f08Triggered,
    evidence: f08Triggered ? f08Evidence : undefined,
  });

  // F09: Pernyataan kualitas kontradiktif atau templat
  let f09Triggered = false;
  let f09Evidence = '';
  if (/dq_completenessomission/i.test(rawText) && /temporal consistency/i.test(rawText)) {
    f09Triggered = true;
    f09Evidence = 'Laporan kualitas Completeness Omission memuat unit ukuran templat "temporal consistency".';
  } else if (/dq_temporalconsistency/i.test(rawText) && /<gco:record[^>]*>100<\/gco:record>/i.test(rawText) && !rawCorpus.includes('hari') && !rawCorpus.includes('bulan')) {
    f09Triggered = true;
    f09Evidence = 'Laporan konsistensi temporal bernilai 100 tanpa satuan dan tanpa metodologi pengujian.';
  } else if (/tidak kurang dari 60%/i.test(rawCorpus) || (/60%/i.test(rawCorpus) && /uji akurasi/i.test(rawCorpus))) {
    f09Triggered = true;
    f09Evidence = 'Ambang batas akurasi ("tidak kurang dari 60%") dilaporkan sebagai hasil pengukuran.';
  }
  flags.push({
    id: 'F09',
    ...QUALITY_FLAGS_DEFINITIONS.F09,
    isTriggered: f09Triggered,
    evidence: f09Triggered ? f09Evidence : undefined,
  });

  // F10: Teks rusak, terpotong, atau salah ketik
  let f10Triggered = false;
  let f10Evidence = '';
  if (rawCorpus.includes('jalur_penagkapan_ikant')) {
    f10Triggered = true;
    f10Evidence = 'Terdapat salah ketik nama layer pada alternateTitle ("jalur_penagkapan_ikant").';
  } else if (/ditambah dengan proses, metode, distribusi oleh/i.test(rawCorpus)) {
    f10Triggered = true;
    f10Evidence = 'Ditemukan kalimat terpotong gantung dalam uraian abstrak / tujuan.';
  } else if (rawCorpus.includes('pengolahanan')) {
    f10Triggered = true;
    f10Evidence = 'Ditemukan typo ("pengolahanan") pada pernyataan silsilah data.';
  } else if (/sr/i.test(metadata?.keywords?.join(' ') || '') && (metadata?.keywords || []).length <= 2) {
    f10Triggered = true;
    f10Evidence = 'Kata kunci memuat singkatan terpotong / tidak bermakna ("sr").';
  }
  flags.push({
    id: 'F10',
    ...QUALITY_FLAGS_DEFINITIONS.F10,
    isTriggered: f10Triggered,
    evidence: f10Triggered ? f10Evidence : undefined,
  });

  // F11: Elemen ganda atau struktur bermasalah
  let f11Triggered = false;
  let f11Evidence = '';
  const extentMatches = rawText.match(/<(?:gmd:)?extent\b/gi);
  if (extentMatches && extentMatches.length > 1) {
    f11Triggered = true;
    f11Evidence = `Ditemukan ${extentMatches.length} blok extent (cakupan) dalam satu dokumen.`;
  } else if (rawCorpus.includes('md_scopecode') && rawCorpus.includes('rolecode')) {
    f11Triggered = true;
    f11Evidence = 'Elemen peran (role) salah menautkan codelist MD_ScopeCode alih-alih CI_RoleCode.';
  }
  flags.push({
    id: 'F11',
    ...QUALITY_FLAGS_DEFINITIONS.F11,
    isTriggered: f11Triggered,
    evidence: f11Triggered ? f11Evidence : undefined,
  });

  // F12: Lisensi bawaan GeoNode
  let f12Triggered = false;
  let f12Evidence = '';
  const constraints = (metadata?.distribution?.useConstraints || metadata?.distribution?.accessConstraints || '').toLowerCase();
  if (rawCorpus.includes('copyright.gov') || constraints.includes('copyright.gov')) {
    f12Triggered = true;
    f12Evidence = 'Teks lisensi bawaan GeoNode "Public Domain (PD)" dengan rujukan situs non-Indonesia (copyright.gov).';
  } else if (constraints.includes('not specified') || rawCorpus.includes('the original author did not specify a license')) {
    f12Triggered = true;
    f12Evidence = 'Lisensi bawaan GeoNode: "Not Specified: The original author did not specify a license."';
  }
  flags.push({
    id: 'F12',
    ...QUALITY_FLAGS_DEFINITIONS.F12,
    isTriggered: f12Triggered,
    evidence: f12Triggered ? f12Evidence : undefined,
  });

  // F13: Nama standar menyebut ISO 19139
  let f13Triggered = false;
  let f13Evidence = '';
  const stdName = (metadata?.metaMetadata?.standardName || '').toLowerCase();
  if (stdName.includes('19139')) {
    f13Triggered = true;
    f13Evidence = `Elemen metadataStandardName mencantumkan spesifikasi implementasi XML ("${metadata?.metaMetadata?.standardName}"), bukan standar isi SNI/ISO 19115.`;
  }
  flags.push({
    id: 'F13',
    ...QUALITY_FLAGS_DEFINITIONS.F13,
    isTriggered: f13Triggered,
    evidence: f13Triggered ? f13Evidence : undefined,
  });

  // F14: Penanda penolakan kurasi pada portal
  let f14Triggered = false;
  let f14Evidence = '';
  if (rawCorpus.includes('kurasi_notes_extra') || rawCorpus.includes('"review_status": "rejected"') || rawCorpus.includes('format data tidak sesuai')) {
    f14Triggered = true;
    f14Evidence = 'Rekaman portal memuat riwayat penolakan kurasi (review_status: "rejected" / "Format data tidak sesuai").';
  }
  flags.push({
    id: 'F14',
    ...QUALITY_FLAGS_DEFINITIONS.F14,
    isTriggered: f14Triggered,
    evidence: f14Triggered ? f14Evidence : undefined,
  });

  return flags;
}
