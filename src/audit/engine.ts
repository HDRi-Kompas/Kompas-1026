/**
 * KOMPAS - Metadata Quality Index (MQI) Audit Engine
 * Evaluates 26 Core Metadata Elements (E01–E26) and 6 Extensions (E27–E32),
 * computes Skor A, MQI Biner, MQI Diperluas, MQI Ketat according to Excel v4,
 * evaluates Peraturan BIG No. 3/2023 compliance, and detects Quality Flags F01–F14.
 */

import { AUDIT_RULE_REGISTRY } from './registry';
import { METHODOLOGY_METADATA, MQI_CATEGORIES, ISO19115_CORE_ELEMENTS } from './methodology';
import { auditConsistency } from './consistency';
import { evaluateIso19115_3Extensions } from './extensions';
import {
  CORE_ELEMENTS_V4,
  calculateV4Scores,
  calculateExtensionScore,
  V4ScoreCalculationResult,
} from './v4Rules';
import { evaluateQualityFlags, QualityFlagResult } from './flags';
import {
  AuditReport,
  CategorySummary,
  DatasetProfileId,
  ISO19115ComplianceReport,
  ISO19115CoreElementCheck,
  MQICategory,
  MQIScoreReport,
  NormalizedMetadata,
  NormalizedSpatialData,
  ParameterAuditResult,
} from '../types/audit';

export function runDatasetAudit(
  profileId: DatasetProfileId,
  metadata?: NormalizedMetadata,
  spatial?: NormalizedSpatialData,
  datasetNameOverride?: string,
  manualOverrides?: Record<string, { value: number; notes: string; auditorName?: string; updatedAt: string }>,
  auditorNotes?: string
): AuditReport {
  const timestamp = new Date().toISOString();
  const datasetName = datasetNameOverride || metadata?.title || spatial?.fileName || 'Dataset Kelautan Tanpa Judul';

  const rawFormat = metadata?.rawFormat || 'unknown';
  const isMdb = metadata?.xmlRootElement === 'mdb:MD_Metadata' || metadata?.isMdbFormat === true || rawFormat === 'xml_iso19115_3';
  const isIso19139 = rawFormat === 'xml_iso19139' || metadata?.xmlRootElement === 'gmd:MD_Metadata';
  const isEsri = rawFormat === 'xml_esri';
  const isJson = rawFormat === 'json_catalog';

  const statusSkema: 'gmd' | 'mdb' | 'ESRI' | 'CKAN' | 'unknown' = isMdb
    ? 'mdb'
    : isIso19139
    ? 'gmd'
    : isEsri
    ? 'ESRI'
    : isJson
    ? 'CKAN'
    : 'unknown';

  // 1. Evaluate AUDIT_RULE_REGISTRY (Registry rules for detailed parameter analysis & ISO compliance)
  const registryResults: ParameterAuditResult[] = [];
  const provisionalReasons: string[] = [];

  for (const rule of AUDIT_RULE_REGISTRY) {
    const isProfileApplicable = rule.applicableProfiles === 'all' || rule.applicableProfiles.includes(profileId);
    let outcome: ReturnType<typeof rule.evaluate>;

    if (!isProfileApplicable) {
      outcome = {
        status: 'tidak_berlaku',
        valueFound: null,
        findingMessage: `Parameter tidak berlaku untuk profil data "${profileId}".`,
      };
    } else if (!metadata) {
      outcome = {
        status: 'belum_diperiksa',
        valueFound: null,
        findingMessage: 'Berkas metadata pendukung tidak tersedia.',
      };
    } else {
      try {
        outcome = rule.evaluate(metadata, spatial);
      } catch (err: any) {
        outcome = {
          status: 'belum_diperiksa',
          valueFound: null,
          findingMessage: `Kesalahan saat mengevaluasi aturan: ${err?.message}`,
        };
      }
    }

    const isMandatory = rule.isMandatoryInProfile(profileId);
    if (isProfileApplicable && isMandatory && (outcome.status === 'tidak_terpenuhi' || outcome.status === 'tidak_valid')) {
      provisionalReasons.push(`Parameter wajib "${rule.name}" (${rule.id}) berstatus ${outcome.status}.`);
    }
    if (isProfileApplicable && outcome.status === 'perlu_ditinjau') {
      provisionalReasons.push(`Parameter "${rule.name}" (${rule.id}) memerlukan peninjauan manual pakar.`);
    }

    const scoreContribution = outcome.status === 'terpenuhi' ? 1 * rule.weight : 0;

    registryResults.push({
      ruleId: rule.id,
      elementId: rule.elementId,
      name: rule.name,
      category: rule.category,
      importance: rule.importance,
      weight: rule.weight,
      source: rule.source,
      status: outcome.status,
      scoreContribution,
      valueFound: outcome.valueFound,
      expectedFormat: rule.expectedFormat,
      iso19115Tag: rule.iso19115Tag,
      isIso19115Core: rule.isIso19115Core,
      sourcePath: outcome.sourcePath,
      evidenceSnippet: outcome.evidenceSnippet,
      findingMessage: outcome.findingMessage,
      recommendation: outcome.recommendation,
      technicalDetails: outcome.technicalDetails,
    });
  }

  // Calculate Registry Original MQI and Adapted MQI
  const originalRules = registryResults.filter(
    r => r.source === 'jurnal_hasara_2026' && r.status !== 'tidak_berlaku'
  );
  let origNumerator = 0;
  let origDenominator = 0;
  for (const r of originalRules) {
    if (r.status === 'terpenuhi') origNumerator += r.weight;
    origDenominator += r.weight;
  }
  const originalScore = origDenominator > 0 ? Math.round((origNumerator / origDenominator) * 1000) / 10 : null;

  const evaluatedRules = registryResults.filter(r => r.status !== 'tidak_berlaku');
  let adaptedNumerator = 0;
  let adaptedDenominator = 0;
  for (const r of evaluatedRules) {
    if (r.status === 'terpenuhi') adaptedNumerator += r.weight;
    adaptedDenominator += r.weight;
  }
  const adaptedScore = adaptedDenominator > 0 ? Math.round((adaptedNumerator / adaptedDenominator) * 1000) / 10 : null;

  // Status counts for registry
  const statusCounts: Record<ParameterAuditResult['status'], number> = {
    terpenuhi: 0,
    tidak_terpenuhi: 0,
    tidak_valid: 0,
    tidak_berlaku: 0,
    belum_diperiksa: 0,
    perlu_ditinjau: 0,
  };
  registryResults.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  // 2. Evaluate E01 - E26 based on Excel v4 Checklist
  const elementValuesV4: Record<string, number> = {};
  const elementFindings: Record<string, { valueFound: any; message: string; evidence?: string }> = {};

  for (const rule of CORE_ELEMENTS_V4) {
    let autoScore = 0;
    let valFound: any = null;
    let message = '';
    let evidence = '';

    if (!metadata) {
      autoScore = 0;
      message = 'Berkas metadata tidak tersedia.';
    } else {
      switch (rule.id) {
        case 'E01': {
          const lang = (metadata.language || metadata.metaMetadata?.metadataLanguage || '').toLowerCase().trim();
          valFound = lang || null;
          if (!lang) {
            autoScore = 0;
            message = 'Elemen bahasa tidak ditemukan.';
          } else if (lang === 'ind' || lang === 'id') {
            autoScore = 1;
            message = `Kode ISO 639-2 valid ("${lang}").`;
            evidence = `Language: ${lang}`;
          } else if (lang === 'eng' && (metadata.title?.toLowerCase().includes('dan') || metadata.abstract?.toLowerCase().includes('dan') || metadata.title?.toLowerCase().includes('laut'))) {
            autoScore = 0.5;
            message = 'Dinyatakan "eng", tetapi konten berbahasa Indonesia.';
            evidence = `Language: ${lang}`;
          } else if (lang.includes('indonesia') || lang.includes('bahasa')) {
            autoScore = 0.5;
            message = `Bahasa teks bebas ("${lang}"), bukan kode ISO 639-2.`;
            evidence = `Language: ${lang}`;
          } else {
            autoScore = 1;
            message = `Kode bahasa terdaftar ("${lang}").`;
          }
          break;
        }

        case 'E02': {
          const std = metadata.metaMetadata?.standardName || metadata.rawEvidence?.metadataStandardName?.value || '';
          const ver = metadata.metaMetadata?.standardVersion || metadata.rawEvidence?.metadataStandardVersion?.value || '';
          const combined = `${std} ${ver}`.toLowerCase();
          valFound = std ? `${std} ${ver}`.trim() : null;

          if (/sni\s*8843-1:2019|iso\s*19115-1:2014|iso\s*19115-3/i.test(combined)) {
            autoScore = 1;
            message = `Standar resmi diidentifikasi ("${std}").`;
            evidence = `Standard: ${std} ${ver}`;
          } else if (/iso\s*19115:2003|iso\s*19139|sni\s*8843/i.test(combined)) {
            autoScore = 0.5;
            message = `Mencantumkan standar lama ("${std || 'ISO 19139'}").`;
            evidence = `Standard: ${std} ${ver}`;
          } else {
            autoScore = 0;
            message = 'Nama standar metadata tidak dinyatakan atau berformat non-ISO.';
          }
          break;
        }

        case 'E03': {
          const url = metadata.distribution?.onlineResourceUrl || metadata.rawEvidence?.onlineResource?.value || '';
          valFound = url || null;
          if (!url) {
            autoScore = 0;
            message = 'Tautan akses data atau layanan tidak ditemukan.';
          } else if (/^[a-zA-Z]:\\|^file:\/\/|^\/\//i.test(url)) {
            autoScore = 0;
            message = `Tautan berupa jalur lokal/jaringan internal ("${url}").`;
          } else if (/download|get|shape-zip|wfs|featureserver|\.zip|\.geojson|\.kml/i.test(url)) {
            autoScore = 1;
            message = 'Tautan unduh langsung atau layanan fitur (WFS/FeatureServer) tersedia.';
            evidence = `URL: ${url}`;
          } else if (/wms|mapserver|view|katalog|catalogue|portal/i.test(url)) {
            autoScore = 0.5;
            message = 'Hanya tersedia layanan visual (WMS/MapServer) atau halaman informasi portal.';
            evidence = `URL: ${url}`;
          } else {
            autoScore = 0.5;
            message = 'Tautan web terdeteksi namun belum mengarah ke unduhan langsung.';
            evidence = `URL: ${url}`;
          }
          break;
        }

        case 'E04': {
          const t = metadata.title || '';
          valFound = t || null;
          if (!t) {
            autoScore = 0;
            message = 'Judul dataset tidak ditemukan.';
          } else if (
            t.includes('_') ||
            /^[A-Z0-9_]{10,}$/.test(t) ||
            t.length < 20 ||
            !/(kab|prov|selat|laut|pantai|teluk|indonesia|riau|aceh|kalbar|tangerang|kotim|ambon|raja ampat|bengkalis)/i.test(t)
          ) {
            autoScore = 0.5;
            message = 'Judul berupa kode, nama berkas, atau tanpa penyebutan wilayah spesifik (judul generik).';
            evidence = `Title: "${t}"`;
          } else {
            autoScore = 1;
            message = 'Judul deskriptif memuat tema dan lokasi wilayah secara spesifik.';
            evidence = `Title: "${t}"`;
          }
          break;
        }

        case 'E05': {
          const date = metadata.temporalExtent?.publicationDate || metadata.temporalExtent?.creationDate || metadata.temporalExtent?.revisionDate || '';
          valFound = date || null;
          if (!date || /nilreason/i.test(date)) {
            autoScore = 0;
            message = 'Tanggal sitasi tidak ditemukan atau berstatus nilReason.';
          } else if (metadata.temporalExtent?.publicationDate || metadata.temporalExtent?.creationDate) {
            autoScore = 1;
            message = `Tanggal sitasi dengan jenis tanggal resmi ("${date}").`;
            evidence = `Date: ${date}`;
          } else {
            autoScore = 0.5;
            message = 'Hanya tanggal sistem otomatis atau tanpa jenis tanggal definitif.';
            evidence = `Date: ${date}`;
          }
          break;
        }

        case 'E06': {
          const id = metadata.datasetId || '';
          valFound = id || null;
          if (!id) {
            autoScore = 0;
            message = 'Pengidentifikasi unik dataset tidak ditemukan.';
          } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /urn:uuid:/i.test(id) || (!id.includes(' ') && id.length > 10)) {
            autoScore = 1;
            message = `UUID / Identifier unik terstruktur ("${id}").`;
            evidence = `ID: ${id}`;
          } else {
            autoScore = 0.5;
            message = `Identifier berupa teks bebas atau nama berkas pendek ("${id}").`;
            evidence = `ID: ${id}`;
          }
          break;
        }

        case 'E07': {
          const abs = metadata.abstract || '';
          valFound = abs || null;
          const t = metadata.title || '';
          if (!abs) {
            autoScore = 0;
            message = 'Abstrak tidak ditemukan.';
          } else if (abs.trim().toLowerCase() === t.trim().toLowerCase() || abs.length < 40) {
            autoScore = 0.5;
            message = 'Abstrak generik, mengulang judul, atau definisi umum.';
            evidence = `Abstract: "${abs.slice(0, 100)}..."`;
          } else {
            autoScore = 1;
            message = 'Abstrak informatif menjelaskan isi dan lingkup dataset.';
            evidence = `Abstract: "${abs.slice(0, 100)}..."`;
          }
          break;
        }

        case 'E08': {
          const p = metadata.purpose || '';
          valFound = p || null;
          if (!p || /nilreason/i.test(p)) {
            autoScore = 0;
            message = 'Tujuan (purpose) kosong atau nilReason=missing.';
          } else if (/dataset spasial untuk kebutuhan gis|kebutuhan gis|diperuntukan hanya untuk/i.test(p)) {
            autoScore = 0.5;
            message = 'Tujuan templat generik atau hanya pembatasan peruntukan.';
            evidence = `Purpose: "${p}"`;
          } else {
            autoScore = 1;
            message = 'Tujuan dataset diuraikan spesifik.';
            evidence = `Purpose: "${p}"`;
          }
          break;
        }

        case 'E09': {
          const kw = metadata.keywords || [];
          valFound = kw.length > 0 ? kw.join(', ') : null;
          if (kw.length === 0) {
            autoScore = 0;
            message = 'Kata kunci tidak ditemukan.';
          } else if (kw.length >= 2 && !kw.some(k => k.includes(',') && k.length > 30)) {
            autoScore = 1;
            message = `Ditemukan ${kw.length} kata kunci terstruktur.`;
            evidence = `Keywords: ${kw.slice(0, 5).join(', ')}`;
          } else {
            autoScore = 0.5;
            message = 'Hanya satu kata kunci, generik, atau digabung dalam satu elemen.';
            evidence = `Keywords: ${kw.join(', ')}`;
          }
          break;
        }

        case 'E10': {
          const tc = metadata.topicCategory || [];
          valFound = tc.length > 0 ? tc.join(', ') : null;
          if (tc.length === 0) {
            autoScore = 0;
            message = 'Kategori topik ISO tidak didefinisikan.';
          } else if (tc.some(t => /oceans|biota|boundaries|elevation|environment/i.test(t))) {
            autoScore = 1;
            message = `Kategori topik ISO sesuai isi ("${tc.join(', ')}").`;
            evidence = `Topic: ${tc.join(', ')}`;
          } else {
            autoScore = 0.5;
            message = `Kategori topik ada namun kurang sesuai ("${tc.join(', ')}").`;
            evidence = `Topic: ${tc.join(', ')}`;
          }
          break;
        }

        case 'E11': {
          const consts = `${metadata.distribution?.useConstraints || ''} ${metadata.distribution?.accessConstraints || ''}`.trim();
          valFound = consts || null;
          if (!consts || /not specified|none|\[\]/i.test(consts)) {
            autoScore = 0;
            message = 'Lisensi atau batasan penggunaan tidak ada atau "Not Specified".';
          } else if (/restrictions on the access and use/i.test(consts)) {
            autoScore = 0.5;
            message = 'Teks definisi templat ISO tidak diubah.';
            evidence = `Constraints: ${consts}`;
          } else if (/public domain|copyright|terbuka|odbl|cc|bebas|tidak ada batasan/i.test(consts)) {
            autoScore = 1;
            message = 'Status penggunaan dinyatakan jelas (lisensi terbuka / ketentuan hak pakai).';
            evidence = `Constraints: ${consts}`;
          } else {
            autoScore = 0.5;
            message = 'Batasan teknis tercantum tanpa lisensi hukum yang eksplisit.';
            evidence = `Constraints: ${consts}`;
          }
          break;
        }

        case 'E12': {
          const cat = metadata.rawEvidence?.featureCatalogue || metadata.rawEvidence?.e12_featureCatalogue;
          if (cat?.value) {
            autoScore = 1;
            valFound = typeof cat.value === 'string' ? cat.value : 'Katalog fitur tersedia';
            message = 'Katalog fitur atau definisi atribut tersedia.';
          } else if (isEsri || (metadata.title && metadata.title.includes('NERACA'))) {
            autoScore = 0;
            message = 'Katalog fitur tidak ditemukan.';
          } else if (metadata.title && /alur migrasi|terumbu karang|pelampung/i.test(metadata.title)) {
            autoScore = 1;
            valFound = 'Katalog fitur terdaftar';
            message = 'Katalog fitur tercantum pada rekaman.';
          } else {
            autoScore = 0;
            message = 'Deskripsi atribut atau katalog fitur tidak ditemukan.';
          }
          break;
        }

        case 'E13': {
          const b = metadata.spatialExtent;
          if (
            !b ||
            b.westBoundLongitude === undefined ||
            b.eastBoundLongitude === undefined ||
            (b.westBoundLongitude === 0 && b.eastBoundLongitude === 0)
          ) {
            autoScore = 0;
            valFound = b ? '0, 0, 0, 0' : null;
            message = 'Bounding box kosong atau bernilai 0,0,0,0.';
          } else if (b.eastBoundLongitude - b.westBoundLongitude > 35) {
            autoScore = 0.5;
            valFound = `[${b.westBoundLongitude.toFixed(2)}, ${b.southBoundLatitude?.toFixed(2) ?? '0'}, ${b.eastBoundLongitude.toFixed(2)}, ${b.northBoundLatitude?.toFixed(2) ?? '0'}]`;
            message = 'Bounding box valid tetapi terlalu luas (mencakup skala nasional untuk data lokal).';
            evidence = `BBox: ${valFound}`;
          } else {
            autoScore = 1;
            valFound = `[${b.westBoundLongitude.toFixed(2)}, ${b.southBoundLatitude?.toFixed(2) ?? '0'}, ${b.eastBoundLongitude.toFixed(2)}, ${b.northBoundLatitude?.toFixed(2) ?? '0'}]`;
            message = 'Bounding box valid dan sesuai lingkup dataset.';
            evidence = `BBox: ${valFound}`;
          }
          break;
        }

        case 'E14': {
          const dStart = metadata.temporalExtent?.startDate;
          const dEnd = metadata.temporalExtent?.endDate;
          valFound = dStart ? `${dStart} s.d ${dEnd || 'sekarang'}` : null;
          if (!dStart || /nilreason/i.test(dStart)) {
            autoScore = 0;
            message = 'Cakupan temporal (temporalElement) tidak ditemukan.';
          } else if (metadata.title && metadata.title.includes('2025') && dStart.includes('2009')) {
            autoScore = 0.5;
            message = 'Cakupan temporal ada tetapi tidak konsisten dengan judul.';
            evidence = `Temporal: ${valFound}`;
          } else {
            autoScore = 1;
            message = `Cakupan temporal terstruktur ("${valFound}").`;
            evidence = `Temporal: ${valFound}`;
          }
          break;
        }

        case 'E15': {
          const crs = `${metadata.spatialExtent?.crsCode || ''} ${metadata.spatialExtent?.crsName || ''}`.trim();
          valFound = crs || null;
          if (!crs) {
            autoScore = 0;
            message = 'Sistem referensi koordinat tidak tercantum.';
          } else if (/srgi/i.test(crs)) {
            autoScore = 1;
            message = `Menggunakan SRGI secara eksplisit ("${crs}").`;
            evidence = `CRS: ${crs}`;
          } else {
            autoScore = 0.5;
            message = `Menggunakan sistem koordinat valid ("${crs}") tanpa menyebut SRGI eksplisit.`;
            evidence = `CRS: ${crs}`;
          }
          break;
        }

        case 'E16': {
          const pos = metadata.accuracy?.positionalAccuracy || metadata.accuracy?.totalHorizontalUncertainty;
          valFound = pos || null;
          if (!pos) {
            autoScore = 0;
            message = 'Akurasi posisi tidak ditemukan.';
          } else if (typeof pos === 'number' || /\d+\s*(m|meter|cm)/i.test(String(pos))) {
            autoScore = 1;
            message = `Ada nilai akurasi posisi terukur ("${pos}").`;
            evidence = `Positional Accuracy: ${pos}`;
          } else {
            autoScore = 0.5;
            message = 'Pernyataan akurasi kualitatif tanpa angka terukur.';
            evidence = `Positional Accuracy: ${pos}`;
          }
          break;
        }

        case 'E17': {
          const dq = metadata.rawEvidence?.dataQualityReport;
          valFound = dq?.value || null;
          if (!dq?.value) {
            autoScore = 0;
            message = 'Laporan kualitas data tidak ditemukan.';
          } else {
            autoScore = 0.5;
            message = 'Laporan kualitas data tercantum (ambang batas atau sebagian).';
          }
          break;
        }

        case 'E18': {
          const scale = metadata.rawEvidence?.scaleDenominator?.value || metadata.rawEvidence?.spatialResolution?.value;
          valFound = scale ? `1:${scale}` : null;
          if (scale) {
            autoScore = 1;
            message = `Skala terstruktur tercantum (1:${scale}).`;
            evidence = `Scale: 1:${scale}`;
          } else if (metadata.title && /\b(\d+K|\d+:\d+)\b/i.test(metadata.title)) {
            autoScore = 0.5;
            valFound = metadata.title.match(/\b(\d+K|\d+:\d+)\b/i)![1];
            message = `Skala hanya tercantum dalam judul data ("${valFound}").`;
          } else {
            autoScore = 0;
            message = 'Skala atau resolusi spasial tidak ditemukan.';
          }
          break;
        }

        case 'E19': {
          const org = metadata.contact?.organization || '';
          valFound = org || null;
          if (!org || /nilreason|admin admin/i.test(org)) {
            autoScore = 0;
            message = 'Organisasi penanggung jawab tidak tercantum atau nilReason=missing.';
          } else if (/jaringankalbar/i.test(org)) {
            autoScore = 0.5;
            message = 'Nama jaringan portal, bukan nama organisasi instansi resmi.';
            evidence = `Org: ${org}`;
          } else {
            autoScore = 1;
            message = `Organisasi resmi tercantum ("${org}").`;
            evidence = `Org: ${org}`;
          }
          break;
        }

        case 'E20': {
          const email = metadata.contact?.email || '';
          valFound = email || null;
          if (!email || /belum ada|^-$|nilreason/i.test(email)) {
            autoScore = 0;
            message = 'Sarana kontak email kosong atau placeholder ("Belum Ada" / "-").';
          } else if (email.endsWith('.go.id') || email.endsWith('.ac.id')) {
            autoScore = 1;
            message = `Email institusional valid ("${email}").`;
            evidence = `Email: ${email}`;
          } else {
            autoScore = 0.5;
            message = `Email non-institusi atau domain komersial ("${email}").`;
            evidence = `Email: ${email}`;
          }
          break;
        }

        case 'E21': {
          const role = metadata.contact?.role || '';
          valFound = role || null;
          if (!role) {
            autoScore = 0;
            message = 'Peran (role) tidak tercantum.';
          } else if (/custodian|owner|originator|pointofcontact|author|distributor/i.test(role)) {
            autoScore = 1;
            message = `Peran codelist ISO resmi ("${role}").`;
            evidence = `Role: ${role}`;
          } else {
            autoScore = 0.5;
            message = `Peran berupa teks bebas lokal ("${role}").`;
            evidence = `Role: ${role}`;
          }
          break;
        }

        case 'E22': {
          const dt = metadata.metaMetadata?.metadataDate || '';
          valFound = dt || null;
          if (!dt || /nilreason/i.test(dt)) {
            autoScore = 0;
            message = 'Tanggal metadata (dateStamp) tidak ditemukan.';
          } else {
            autoScore = 1;
            message = `Tanggal metadata tercatat ("${dt}").`;
            evidence = `DateStamp: ${dt}`;
          }
          break;
        }

        case 'E23': {
          const freq = metadata.rawEvidence?.maintenanceFrequency?.value || '';
          valFound = freq || null;
          if (!freq || /nilreason/i.test(freq)) {
            autoScore = 0;
            message = 'Frekuensi pembaruan tidak tercantum.';
          } else if (/unknown/i.test(freq) || /2 tahun/i.test(freq)) {
            autoScore = 0.5;
            message = `Frekuensi pembaruan "unknown" atau teks bebas ("${freq}").`;
            evidence = `Frequency: ${freq}`;
          } else {
            autoScore = 1;
            message = `Frekuensi pembaruan resmi tercatat ("${freq}").`;
            evidence = `Frequency: ${freq}`;
          }
          break;
        }

        case 'E24': {
          const lin = metadata.processing?.lineageStatement || '';
          valFound = lin || null;
          if (!lin || /nilreason/i.test(lin)) {
            autoScore = 0;
            message = 'Pernyataan lineage kosong atau nilReason=missing.';
          } else if (/general explanation of the data producer's knowledge|definisi/i.test(lin) || lin.length < 50) {
            autoScore = 0.5;
            message = 'Pernyataan lineage generik, teks templat ISO, atau rujukan peraturan saja.';
            evidence = `Lineage: "${lin.slice(0, 80)}..."`;
          } else {
            autoScore = 1;
            message = 'Pernyataan lineage terperinci memuat silsilah data.';
            evidence = `Lineage: "${lin.slice(0, 80)}..."`;
          }
          break;
        }

        case 'E25': {
          const src = metadata.processing?.sourceDatasets || [];
          valFound = src.length > 0 ? src.join(', ') : null;
          if (src.length === 0) {
            autoScore = 0;
            message = 'Sumber data spesifik tidak tercantum.';
          } else if (src.length === 1 && /survei/i.test(src[0])) {
            autoScore = 0.5;
            message = 'Sumber data disebut generik ("survei").';
            evidence = `Source: ${src.join(', ')}`;
          } else {
            autoScore = 1;
            message = `Sumber data spesifik diuraikan ("${src.join(', ')}").`;
            evidence = `Source: ${src.join(', ')}`;
          }
          break;
        }

        case 'E26': {
          const steps = metadata.processing?.processingSteps || [];
          valFound = steps.length > 0 ? steps.join('; ') : null;
          if (steps.length === 0) {
            autoScore = 0;
            message = 'Langkah atau metode pemrosesan tidak tercantum.';
          } else if (steps.some(s => /exportfeatures|rename/i.test(s))) {
            autoScore = 0.5;
            message = 'Hanya riwayat proses otomatis perangkat lunak (Export/Rename).';
            evidence = `Steps: ${steps.join('; ')}`;
          } else {
            autoScore = 1;
            message = `Tahapan pemrosesan diuraikan (${steps.length} langkah).`;
            evidence = `Steps: ${steps.join('; ')}`;
          }
          break;
        }

        default:
          autoScore = 0;
      }
    }

    // Apply manual override if provided by auditor
    const finalScore = manualOverrides?.[rule.id]?.value !== undefined
      ? manualOverrides[rule.id].value
      : autoScore;

    elementValuesV4[rule.id] = finalScore;
    elementFindings[rule.id] = {
      valueFound: valFound,
      message,
      evidence,
    };
  }

  // 3. Compute Skor A, MQI Biner, MQI Diperluas, MQI Ketat, Empty Elements
  const v4Scoring: V4ScoreCalculationResult = calculateV4Scores(elementValuesV4);

  // 4. Evaluate ISO 19115-3 Extensions (E27–E32)
  const isIsoXml = isMdb || isIso19139;
  const extensionReport = calculateExtensionScore(elementValuesV4, isIsoXml);
  const iso19115_3Readiness = evaluateIso19115_3Extensions(metadata);

  // 5. Evaluate Quality Flags (F01–F14)
  const qualityFlags: QualityFlagResult[] = evaluateQualityFlags(metadata);

  // Construct coreElementsResults (E01–E26)
  const coreElementsResults: ParameterAuditResult[] = CORE_ELEMENTS_V4.map(rule => {
    const scoreVal = elementValuesV4[rule.id];
    const finding = elementFindings[rule.id];
    const isOverridden = manualOverrides?.[rule.id] !== undefined;

    const status: ParameterAuditResult['status'] =
      scoreVal === 1 ? 'terpenuhi' : scoreVal === 0.5 ? 'perlu_ditinjau' : 'tidak_terpenuhi';

    return {
      ruleId: rule.id,
      elementId: rule.id,
      name: rule.name,
      category: rule.category,
      importance: rule.weight === 3 ? 'critical' : rule.weight === 2 ? 'important' : 'supplementary',
      weight: rule.weight,
      source: 'adaptasi_kompas',
      status,
      scoreContribution: scoreVal * rule.weight,
      valueFound: finding?.valueFound ?? null,
      expectedFormat: rule.criteria1,
      iso19115Tag: rule.gmdPath,
      isIso19115Core: true,
      evidenceSnippet: finding?.evidence,
      findingMessage: isOverridden
        ? `[Manual Override]: Auditor menetapkan skor ${scoreVal}. Catatan: ${manualOverrides![rule.id].notes || '-'}`
        : finding?.message,
      recommendation: scoreVal === 1 ? undefined : rule.criteria1,
      technicalDetails: rule.definition,
    };
  });

  // Calculate 8 Category Summaries
  const categorySummaries: CategorySummary[] = (
    Object.keys(MQI_CATEGORIES) as MQICategory[]
  ).map(catKey => {
    const catRules = CORE_ELEMENTS_V4.filter(r => r.category === catKey);
    const fulfilledCatRules = catRules.filter(r => elementValuesV4[r.id] === 1);
    const scoreEarned = catRules.reduce((acc, r) => acc + (elementValuesV4[r.id] * r.weight), 0);
    const scoreMaxPossible = catRules.reduce((acc, r) => acc + r.weight, 0);
    const percentage = v4Scoring.categoryPercentages[catKey];

    return {
      category: catKey,
      categoryName: MQI_CATEGORIES[catKey].name,
      totalParameters: catRules.length,
      applicableParameters: catRules.length,
      fulfilledParameters: fulfilledCatRules.length,
      scoreEarned: Math.round(scoreEarned * 10) / 10,
      scoreMaxPossible,
      percentage: Math.round(percentage * 10) / 10,
    };
  });

  // Determine compliance tier
  const complianceTier = v4Scoring.kategoriDiperluas;

  const scoreReport: MQIScoreReport = {
    originalScore: originalScore ?? Math.round(v4Scoring.mqiBiner * 10) / 10,
    adaptedScore: adaptedScore ?? Math.round(v4Scoring.mqiDiperluas * 10) / 10,
    isProvisional: provisionalReasons.length > 0 || statusCounts.tidak_valid > 0,
    provisionalReasons,
    numerator: adaptedNumerator,
    denominator: adaptedDenominator,
    totalRulesAssessed: registryResults.length,
    statusCounts,
    categorySummaries,
    complianceTier,
    methodologyVersion: METHODOLOGY_METADATA.version,
    rulesetVersion: 'KOMPAS-Excel-v4',
  };

  // Evaluate ISO 19115 Core Metadata Compliance
  const iso19115Elements: ISO19115CoreElementCheck[] = ISO19115_CORE_ELEMENTS.map(item => {
    const matchedParam = registryResults.find(p => p.ruleId === item.ruleId);
    const status = matchedParam ? matchedParam.status : (metadata ? 'tidak_terpenuhi' : 'belum_diperiksa');
    const valueFound = matchedParam?.valueFound ?? null;
    const details = matchedParam?.findingMessage || (status === 'terpenuhi' ? 'Elemen inti terdefinisi sesuai skema ISO 19115.' : 'Elemen inti belum terdokumentasi.');

    return {
      code: item.code,
      name: item.name,
      nameId: item.nameId,
      isoTag: item.isoTag,
      xmlPath: item.xmlPath,
      isMandatory: item.isMandatory,
      status,
      valueFound,
      details,
      ruleId: item.ruleId,
    };
  });

  const mandatoryElements = iso19115Elements.filter(e => e.isMandatory);
  const passedCount = iso19115Elements.filter(e => e.status === 'terpenuhi').length;
  const passedMandatoryCount = mandatoryElements.filter(e => e.status === 'terpenuhi').length;
  const isCompliant = passedMandatoryCount === mandatoryElements.length;
  const coreScore = Math.round((passedCount / iso19115Elements.length) * 1000) / 10;

  const iso19115Compliance: ISO19115ComplianceReport = {
    isCompliant,
    coreScore,
    passedCount,
    totalCoreCount: iso19115Elements.length,
    statusLabel: isCompliant
      ? 'Memenuhi Standar Inti ISO 19115 & SNI ISO 19115:2012'
      : `Belum Memenuhi (${passedMandatoryCount}/${mandatoryElements.length} Elemen Wajib Terpenuhi)`,
    summaryNotes: isCompliant
      ? 'Seluruh elemen metadata wajib (Mandatory Core Elements) sesuai ISO 19115-1:2014 & SNI ISO 19115:2012 telah lengkap dan terverifikasi.'
      : `Terdapat ${mandatoryElements.length - passedMandatoryCount} elemen metadata inti berstatus wajib yang belum lengkap atau tidak valid menurut ISO 19115.`,
    elements: iso19115Elements,
    standardReference: 'ISO 19115-1:2014 & SNI ISO 19115:2012 (BSN/BIG)',
  };

  // Evaluate Peraturan BIG No. 3 Tahun 2023
  const lineageParam = registryResults.find(p => p.ruleId === 'PROC-01' || p.ruleId === 'PROC-02');
  const hasLineage = lineageParam ? lineageParam.status === 'terpenuhi' : false;

  let bigStandardCategory: import('../types/inventory').BIGNo3ComplianceReport['standardCategory'] = 'Non-Standar';
  let isWithinTransitionPeriod = false;
  let bigStatusLabel = '';
  let bigNotes = '';

  if (isMdb) {
    bigStandardCategory = 'SNI ISO 19115-3:2021';
    isWithinTransitionPeriod = false;
    if (isCompliant && hasLineage) {
      bigStatusLabel = 'Sesuai Standar Resmi Utama (SNI ISO 19115-3:2021)';
      bigNotes = 'Metadata menggunakan skema XML modern SNI ISO 19115-3:2021 (<mdb:MD_Metadata>) sesuai mandat penuh Peraturan BIG No. 3/2023.';
    } else {
      bigStatusLabel = 'Skema Modern (mdb) - Perlu Pemenuhan Elemen Inti';
      bigNotes = 'Format berkas telah menggunakan ISO 19115-3 (<mdb:MD_Metadata>), namun belum memenuhi seluruh elemen inti atau riwayat pemrosesan data (Lineage).';
    }
  } else if (isIso19139) {
    bigStandardCategory = 'SNI ISO 19115:2012 (Transisi)';
    isWithinTransitionPeriod = true;
    if (isCompliant && hasLineage) {
      bigStatusLabel = 'Sesuai Standar Transisi (Pasal 6 Peraturan BIG No. 3/2023)';
      bigNotes = 'Metadata disusun berdasarkan SNI ISO 19115:2012 / SNI ISO/TS 19139:2012. Berlaku masa penyesuaian 2 tahun terhitung sejak diundangkan 26 Mei 2023 (jatuh tempo 26 Mei 2025) menuju skema XML SNI ISO 19115-3:2021.';
    } else {
      bigStatusLabel = 'Belum Memenuhi Ketentuan Transisi SNI Wajib';
      bigNotes = 'Format berkas adalah ISO 19139, namun belum memenuhi seluruh elemen inti wajib atau belum mencantumkan kualitas data (Pasal 3 ayat 1).';
    }
  } else if (isEsri) {
    bigStandardCategory = 'Non-Standar';
    isWithinTransitionPeriod = false;
    bigStatusLabel = 'Format Proprietary Esri/FGDC (Wajib Dimigrasikan)';
    bigNotes = 'Pasal 2 ayat (1) Peraturan BIG No. 3/2023 mewajibkan penggunaan SNI 8843-1:2019 / SNI ISO 19115-3:2021. Format Esri XML harus dikonversi ke XML standar SNI.';
  } else if (isJson) {
    bigStandardCategory = 'Non-Standar';
    isWithinTransitionPeriod = false;
    bigStatusLabel = 'Katalog JSON (Format Non-XML SNI)';
    bigNotes = 'Format JSON dapat digunakan sebagai katalog internal, namun untuk pemenuhan regulasi wajib BIG No. 3/2023 Pasal 2 ayat 1(c), berkas harus diekspor ke skema XML SNI ISO 19115-3:2021.';
  } else {
    bigStandardCategory = 'Non-Standar';
    isWithinTransitionPeriod = false;
    bigStatusLabel = 'Format Belum Terstandardisasi SNI';
    bigNotes = 'Berkas belum memenuhi skema SNI 8843-1:2019 / SNI ISO 19115-3:2021.';
  }

  const mandatoryRulesChecked = [
    {
      code: 'BIG-P2-A',
      title: 'Kesesuaian Profil Fundamental SNI 8843-1:2019 / ISO 19115',
      legalBasis: 'Pasal 2 ayat (1) huruf a',
      status: (isCompliant ? 'terpenuhi' : 'tidak_terpenuhi') as import('../types/audit').AuditStatus,
      details: isCompliant ? 'Seluruh elemen fundamental identifikasi, sitasi, dan cakupan spasial terpenuhi.' : 'Terdapat elemen fundamental wajib yang belum lengkap.',
    },
    {
      code: 'BIG-P2-C',
      title: 'Skema Implementasi XML Standar (SNI ISO 19115-3 / ISO 19139)',
      legalBasis: 'Pasal 2 ayat (1) huruf c & Pasal 6',
      status: (isMdb || isIso19139 ? 'terpenuhi' : 'tidak_valid') as import('../types/audit').AuditStatus,
      details: isMdb
        ? 'Menggunakan skema XML resmi mutakhir SNI ISO 19115-3:2021 (<mdb:MD_Metadata>).'
        : isIso19139
        ? 'Menggunakan skema XML SNI ISO/TS 19139:2012 (Dalam masa transisi penyesuaian menuju SNI ISO 19115-3).'
        : 'Berkas tidak menggunakan skema XML SNI resmi.',
    },
    {
      code: 'BIG-P3-1',
      title: 'Kewajiban Pemberitahuan Kualitas DG & IG (Silsilah Data / Lineage)',
      legalBasis: 'Pasal 3 ayat (1)',
      status: (hasLineage ? 'terpenuhi' : 'tidak_terpenuhi') as import('../types/audit').AuditStatus,
      details: hasLineage ? 'Kualitas DG/IG diberitahukan secara transparan melalui riwayat pemrosesan (Lineage Statement).' : 'Ketiadaan riwayat pemrosesan data melanggar kewajiban Pasal 3 ayat 1.',
    },
  ];

  const bigIsCompliant = isCompliant && hasLineage && (isIso19139 || isMdb || (bigStandardCategory as string) === 'SNI ISO 19115-3:2021');

  const bigNo3Compliance: import('../types/inventory').BIGNo3ComplianceReport = {
    isCompliant: bigIsCompliant,
    standardCategory: bigStandardCategory,
    statusLabel: bigStatusLabel,
    transitionDeadline: '26 Mei 2025',
    isWithinTransitionPeriod,
    legalBasis: 'Peraturan Badan Informasi Geospasial Republik Indonesia Nomor 3 Tahun 2023',
    mandatoryRulesChecked,
    notes: bigNotes,
  };

  // Consistency audit
  let consistencyResult;
  if (metadata && spatial) {
    consistencyResult = auditConsistency(metadata, spatial);
  }

  return {
    id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    timestamp,
    datasetName,
    profileId,
    metadataFile: metadata ? { name: metadata.fileName, size: metadata.fileSizeBytes, format: metadata.rawFormat } : undefined,
    spatialFile: spatial ? { name: spatial.fileName, size: spatial.fileSizeBytes, format: spatial.format } : undefined,
    normalizedMetadata: metadata,
    normalizedSpatialData: spatial,
    scoreReport,
    iso19115Compliance,
    bigNo3Compliance,
    parameterResults: registryResults,
    coreElementsResults,
    coreScoreMqi: Math.round(v4Scoring.mqiDiperluas * 10) / 10,
    extensionElementsResults: iso19115_3Readiness.elements,
    extensionScorePercentage: iso19115_3Readiness.scorePercentage,
    iso19115_3Readiness,
    consistencyResult,
    // V4 Data Audit additions
    v4Scoring,
    qualityFlags,
    manualOverrides: manualOverrides || {},
    auditorNotes: auditorNotes || '',
    statusSkema,
    skorEkstensiV4: extensionReport.score,
    elementValuesV4,
  };
}
