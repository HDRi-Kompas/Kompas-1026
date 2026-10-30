/**
 * KOMPAS - Core Rules E01–E26 & Extensions E27–E32 Specification
 * Based on KOMPAS_data_audit_v4.xlsx (Sheet Checklist & Bobot)
 * and Handover Tim Aplikasi KOMPAS (Revisi 29 Oktober 2026).
 */

import { MQICategory, NormalizedMetadata } from '../types/audit';

export type V4ScoreValue = 1 | 0.5 | 0;

export interface ElementRuleV4 {
  id: string; // E01 to E26, E27 to E32
  name: string;
  category: MQICategory;
  categoryName: string;
  weight: number;
  definition: string;
  criteria1: string;
  criteria05: string;
  criteria0: string;
  gmdPath: string;
  esriPath: string;
  ckanPath: string;
  mdbPath: string;
  requiresManualReview: boolean; // E04, E07, E08, E09, E24, E25, E26
}

export const CATEGORY_WEIGHTS_V4: Record<MQICategory, { name: string; weight: number }> = {
  CAT_GENERAL: { name: 'Informasi umum', weight: 5 },
  CAT_IDENTIFICATION: { name: 'Identifikasi', weight: 15 },
  CAT_DESCRIPTION: { name: 'Deskripsi', weight: 10 },
  CAT_EXTENT: { name: 'Cakupan', weight: 15 },
  CAT_ACCURACY: { name: 'Ketelitian', weight: 20 },
  CAT_CONTACT: { name: 'Kontak', weight: 10 },
  CAT_METAMETADATA: { name: 'Meta-metadata', weight: 5 },
  CAT_PROCESSING: { name: 'Pemrosesan', weight: 20 },
};

export const CORE_ELEMENTS_V4: ElementRuleV4[] = [
  {
    id: 'E01',
    name: 'Bahasa metadata (dan bahasa data bila ada)',
    category: 'CAT_GENERAL',
    categoryName: 'Informasi umum',
    weight: 1,
    definition: 'Bahasa metadata dan bahasa data spasial yang digunakan.',
    criteria1: 'Kode ISO 639 valid dan sesuai isi (misal: "ind").',
    criteria05: 'Teks bebas ("bahasa Indonesia") atau tidak sesuai isi (misal: "eng" untuk isi berbahasa Indonesia).',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:language; MD_DataIdentification/gmd:language',
    esriPath: 'mdLang/languageCode',
    ckanPath: 'extras: metadata-language',
    mdbPath: 'mdb:defaultLocale/lan:PT_Locale/lan:language',
    requiresManualReview: false,
  },
  {
    id: 'E02',
    name: 'Nama dan versi standar metadata',
    category: 'CAT_GENERAL',
    categoryName: 'Informasi umum',
    weight: 2,
    definition: 'Standar isi metadata yang dinyatakan.',
    criteria1: 'Tertulis tepat "SNI 8843-1:2019" ATAU "ISO 19115-1:2014" / "ISO 19115-3" (beserta versi/tahunnya).',
    criteria05: 'Tertulis standar lama seperti "ISO 19115:2003", "ISO 19139", atau hanya menyebut "SNI 8843" tanpa versi yang jelas.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:metadataStandardName; gmd:metadataStandardVersion',
    esriPath: '(tidak ada)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:metadataStandard/cit:CI_Citation/(cit:title, cit:edition)',
    requiresManualReview: false,
  },
  {
    id: 'E03',
    name: 'Tautan akses data atau layanan',
    category: 'CAT_GENERAL',
    categoryName: 'Informasi umum',
    weight: 2,
    definition: 'Tautan daring untuk mengunduh data langsung atau mengakses web service fitur.',
    criteria1: 'Tautan unduh langsung atau layanan fitur (WFS, FeatureServer), bukan jalur lokal.',
    criteria05: 'Hanya layanan visual (WMS, MapServer) atau halaman informasi portal.',
    criteria0: 'Tidak ada, jalur lokal (C:\\, file://, //), atau teks templat.',
    gmdPath: 'gmd:distributionInfo//gmd:onLine/gmd:linkage',
    esriPath: 'Esri/DataProperties/itemProps/itemLocation',
    ckanPath: 'resources[].url',
    mdbPath: 'mdb:distributionInfo/mrd:MD_Distribution/.../cit:linkage',
    requiresManualReview: false,
  },
  {
    id: 'E04',
    name: 'Judul informatif',
    category: 'CAT_IDENTIFICATION',
    categoryName: 'Identifikasi',
    weight: 3,
    definition: 'Judul resmi dataset geospasial.',
    criteria1: 'Judul deskriptif memuat tema dan lokasi wilayah secara spesifik.',
    criteria05: 'Kode, nama berkas teknis, atau tanpa nama wilayah lokasi (judul generik).',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:citation//gmd:title',
    esriPath: 'dataIdInfo/idCitation/resTitle',
    ckanPath: 'title',
    mdbPath: 'mdb:identificationInfo/.../cit:title',
    requiresManualReview: true,
  },
  {
    id: 'E05',
    name: 'Tanggal sitasi dan jenis tanggal',
    category: 'CAT_IDENTIFICATION',
    categoryName: 'Identifikasi',
    weight: 2,
    definition: 'Tanggal publikasi, pembuatan, atau revisi dataset.',
    criteria1: 'Tanggal dengan jenis tanggal resmi (creation, publication, revision).',
    criteria05: 'Hanya tanggal sistem otomatis atau tanpa jenis tanggal terdefinisi.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:citation/gmd:date (CI_Date + dateType)',
    esriPath: 'idCitation/date; Esri/CreaDate',
    ckanPath: 'extras: dataset-reference-date',
    mdbPath: 'mri:citation/cit:CI_Citation/cit:date/cit:CI_Date',
    requiresManualReview: false,
  },
  {
    id: 'E06',
    name: 'Identifier unik',
    category: 'CAT_IDENTIFICATION',
    categoryName: 'Identifikasi',
    weight: 2,
    definition: 'Pengidentifikasi unik persisten dataset.',
    criteria1: 'UUID atau kode terstruktur tanpa spasi.',
    criteria05: 'Teks bebas berspasi atau nama berkas pendek.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:fileIdentifier',
    esriPath: '(tidak ada)',
    ckanPath: 'id; extras: guid',
    mdbPath: 'mdb:metadataIdentifier/mcc:MD_Identifier/mcc:code',
    requiresManualReview: false,
  },
  {
    id: 'E07',
    name: 'Abstrak',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 3,
    definition: 'Ringkasan naratif mengenai subjek, metodologi, dan cakupan data.',
    criteria1: 'Menjelaskan isi, cakupan, atau penggunaan dataset secara spesifik.',
    criteria05: 'Generik, definisi umum (misal definisi umum terumbu karang), atau mengulang judul.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:abstract',
    esriPath: 'dataIdInfo/idAbs',
    ckanPath: 'notes',
    mdbPath: 'mdb:identificationInfo/mri:MD_DataIdentification/mri:abstract',
    requiresManualReview: true,
  },
  {
    id: 'E08',
    name: 'Tujuan (purpose)',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 2,
    definition: 'Tujuan pembuatan atau peruntukan data.',
    criteria1: 'Tujuan atau peruntukan spesifik diuraikan.',
    criteria05: 'Templat generik ("Dataset spasial untuk kebutuhan GIS") atau hanya pembatasan peruntukan.',
    criteria0: 'Kosong atau nilReason=missing.',
    gmdPath: 'gmd:purpose',
    esriPath: 'dataIdInfo/idPurp',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:identificationInfo/mri:MD_DataIdentification/mri:purpose',
    requiresManualReview: true,
  },
  {
    id: 'E09',
    name: 'Kata kunci',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 1,
    definition: 'Istilah indeks pencarian subjek dan lokasi.',
    criteria1: 'Dua atau lebih kata kunci relevan (tema, lokasi), terpisah rapi.',
    criteria05: 'Satu kata kunci, generik, atau digabung dalam satu elemen dipisah koma.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:descriptiveKeywords',
    esriPath: 'dataIdInfo/searchKeys',
    ckanPath: 'tags',
    mdbPath: 'mri:descriptiveKeywords/mri:MD_Keywords/mri:keyword',
    requiresManualReview: true,
  },
  {
    id: 'E10',
    name: 'Kategori topik ISO',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 1,
    definition: 'Klasifikasi domain tematik standar ISO 19115 TopicCategory.',
    criteria1: 'Nilai ISO sesuai isi dataset (misal: oceans, biota, boundaries, elevation).',
    criteria05: 'Ada tetapi kurang sesuai dengan tema dataset (misal: geoscientificInformation untuk batas laut).',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:topicCategory',
    esriPath: 'dataIdInfo/tpCat',
    ckanPath: '(tidak ada)',
    mdbPath: 'mri:topicCategory/mri:MD_TopicCategoryCode',
    requiresManualReview: false,
  },
  {
    id: 'E11',
    name: 'Lisensi atau batasan penggunaan',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 3,
    definition: 'Ketentuan hukum dan hak penggunaan dataset.',
    criteria1: 'Status penggunaan dinyatakan jelas (lisensi terbuka atau batasan spesifik terdefinisi).',
    criteria05: 'Hanya batasan teknis, atau teks templat ISO.',
    criteria0: 'Tidak ada, kosong, atau "Not Specified".',
    gmdPath: 'gmd:resourceConstraints (useLimitation, otherConstraints)',
    esriPath: 'dataIdInfo/resConst',
    ckanPath: 'extras: licence, access_constraints; license_title',
    mdbPath: 'mri:resourceConstraints/mco:MD_Constraints/mco:useLimitation',
    requiresManualReview: false,
  },
  {
    id: 'E12',
    name: 'Deskripsi atribut atau katalog fitur',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 2,
    definition: 'Kamus data atribut dan katalog fitur data spasial.',
    criteria1: 'Katalog fitur atau definisi atribut tersedia atau tertaut.',
    criteria05: 'Daftar atribut tanpa definisi penjelasan, atau rujukan kosong/status draf.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:contentInfo/gmd:MD_FeatureCatalogueDescription',
    esriPath: 'eainfo',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:contentInfo/mrc:MD_FeatureCatalogueDescription',
    requiresManualReview: false,
  },
  {
    id: 'E13',
    name: 'Bounding box',
    category: 'CAT_EXTENT',
    categoryName: 'Cakupan',
    weight: 3,
    definition: 'Batas koordinat bujur dan lintang cakupan data.',
    criteria1: 'Valid dan sesuai lingkup geografis dataset.',
    criteria05: 'Valid tetapi terlalu luas (misal cakupan seluruh Indonesia untuk dataset tingkat kabupaten) atau sebagian koordinat tidak sesuai.',
    criteria0: 'Tidak ada atau koordinat bernilai 0,0,0,0.',
    gmdPath: 'gmd:extent//gmd:EX_GeographicBoundingBox',
    esriPath: 'dataIdInfo/dataExt/geoEle',
    ckanPath: 'extras: bbox-*, spatial',
    mdbPath: 'mri:extent/gex:EX_Extent/gex:geographicElement/gex:EX_GeographicBoundingBox',
    requiresManualReview: false,
  },
  {
    id: 'E14',
    name: 'Cakupan temporal',
    category: 'CAT_EXTENT',
    categoryName: 'Cakupan',
    weight: 2,
    definition: 'Periode waktu pengambilan atau keberlakuan data spasial.',
    criteria1: 'Periode atau waktu data terstruktur dan konsisten.',
    criteria05: 'Ada tetapi tidak konsisten dengan judul/isi, atau hanya tercantum dalam teks naratif.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:extent//gmd:temporalElement',
    esriPath: 'dataIdInfo/dataExt/tempEle',
    ckanPath: '(tidak ada)',
    mdbPath: 'mri:extent/gex:EX_Extent/gex:temporalElement/gex:EX_TemporalExtent',
    requiresManualReview: false,
  },
  {
    id: 'E15',
    name: 'Sistem referensi koordinat',
    category: 'CAT_EXTENT',
    categoryName: 'Cakupan',
    weight: 2,
    definition: 'Sistem referensi spasial (CRS/SRS/Datum).',
    criteria1: 'Menggunakan Sistem Referensi Geospasial Indonesia (SRGI) secara eksplisit atau kode EPSG yang merujuk langsung SRGI.',
    criteria05: 'Valid tetapi hanya menggunakan EPSG:4326 (WGS84) tanpa menyebut SRGI, ATAU tidak konsisten dengan layanan yang disediakan.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:referenceSystemInfo',
    esriPath: 'refSysInfo; Esri/DataProperties/coordRef',
    ckanPath: 'extras: spatial-reference-system',
    mdbPath: 'mdb:referenceSystemInfo/mrs:MD_ReferenceSystem/.../mcc:MD_Identifier',
    requiresManualReview: false,
  },
  {
    id: 'E16',
    name: 'Akurasi posisi',
    category: 'CAT_ACCURACY',
    categoryName: 'Ketelitian',
    weight: 3,
    definition: 'Hasil evaluasi akurasi posisi absolut atau relatif.',
    criteria1: 'Ada nilai/uraian terukur (misal CE90, LE90, RMSE) DAN memenuhi/mengacu pada elemen akurasi posisi SNI ISO 19157.',
    criteria05: 'Pernyataan kualitatif tanpa nilai angka (misal "akurasi baik"), ATAU tidak mengacu pada SNI ISO 19157.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:dataQualityInfo//DQ_*PositionalAccuracy',
    esriPath: 'dqInfo',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:dataQualityInfo/mdq:DQ_DataQuality/.../mdq:DQ_*PositionalAccuracy',
    requiresManualReview: false,
  },
  {
    id: 'E17',
    name: 'Akurasi tematik atau laporan kualitas lain',
    category: 'CAT_ACCURACY',
    categoryName: 'Ketelitian',
    weight: 3,
    definition: 'Laporan mutu kelengkapan, konsistensi logis, temporal, atau tematik.',
    criteria1: 'Laporan kualitas mencakup minimal 2 dari 5 elemen SNI ISO 19157 dengan hasil terukur.',
    criteria05: 'Hanya mencakup 1 elemen kualitas, ATAU laporan tidak lengkap (hanya ambang batas tanpa hasil), ATAU berisi teks templat.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:dataQualityInfo//gmd:report',
    esriPath: 'dqInfo',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:dataQualityInfo/mdq:DQ_DataQuality/mdq:report/...',
    requiresManualReview: false,
  },
  {
    id: 'E18',
    name: 'Skala atau resolusi',
    category: 'CAT_ACCURACY',
    categoryName: 'Ketelitian',
    weight: 2,
    definition: 'Skala ekuivalen peta atau resolusi jarak spasial fitur.',
    criteria1: 'Elemen terstruktur dalam metadata (equivalentScale atau spatialResolution).',
    criteria05: 'Hanya tertulis dalam judul atau teks naratif, atau tidak konsisten dengan data.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:spatialResolution',
    esriPath: 'dataIdInfo/dataScale',
    ckanPath: '(tidak ada)',
    mdbPath: 'mri:spatialResolution/mri:MD_Resolution/...',
    requiresManualReview: false,
  },
  {
    id: 'E19',
    name: 'Organisasi penanggung jawab',
    category: 'CAT_CONTACT',
    categoryName: 'Kontak',
    weight: 3,
    definition: 'Nama instansi, walidata, atau produsen data penanggung jawab.',
    criteria1: 'Nama organisasi spesifik tercantum jelas.',
    criteria05: 'Generik atau bukan nama organisasi resmi.',
    criteria0: 'Tidak ada atau nilReason=missing.',
    gmdPath: 'gmd:contact, gmd:pointOfContact//gmd:organisationName',
    esriPath: 'dataIdInfo/idPoC',
    ckanPath: 'extras: responsible-party; organization',
    mdbPath: 'mdb:contact / cit:CI_Responsibility/.../cit:CI_Organisation/cit:name',
    requiresManualReview: false,
  },
  {
    id: 'E20',
    name: 'Sarana kontak valid',
    category: 'CAT_CONTACT',
    categoryName: 'Kontak',
    weight: 3,
    definition: 'Alamat surel resmi, telepon, atau alamat fisik narahubung.',
    criteria1: 'Email institusional valid (.go.id, .ac.id, dsb).',
    criteria05: 'Hanya telepon, email non-institusi (.gmail.com), atau domain tampak keliru.',
    criteria0: 'Tidak ada atau placeholder ("Belum Ada", "-").',
    gmdPath: 'gmd:contactInfo//gmd:electronicMailAddress, gmd:phone',
    esriPath: 'idPoC/rpCntInfo',
    ckanPath: 'extras: contact-email',
    mdbPath: 'cit:CI_Responsibility/.../cit:electronicMailAddress',
    requiresManualReview: false,
  },
  {
    id: 'E21',
    name: 'Peran (role)',
    category: 'CAT_CONTACT',
    categoryName: 'Kontak',
    weight: 1,
    definition: 'Peran organisasi dalam siklus hidup dataset (owner, originator, custodian).',
    criteria1: 'Nilai codelist ISO resmi.',
    criteria05: 'Teks bebas atau campuran bahasa lokal.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:role',
    esriPath: 'idPoC/role',
    ckanPath: 'extras: responsible-party.roles',
    mdbPath: 'cit:CI_Responsibility/cit:role/cit:CI_RoleCode',
    requiresManualReview: false,
  },
  {
    id: 'E22',
    name: 'Tanggal metadata',
    category: 'CAT_METAMETADATA',
    categoryName: 'Meta-metadata',
    weight: 2,
    definition: 'Tanggal pembuatan atau pemutakhiran berkas metadata.',
    criteria1: 'Ada dan logis (tidak bertentangan dengan siklus hidup data).',
    criteria05: 'Ada tetapi tidak konsisten (misal dateStamp lebih tua dari katalog fitur yang disitir).',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:dateStamp',
    esriPath: 'mdDateSt',
    ckanPath: 'extras: metadata-date',
    mdbPath: 'mdb:dateInfo/cit:CI_Date',
    requiresManualReview: false,
  },
  {
    id: 'E23',
    name: 'Frekuensi pembaruan',
    category: 'CAT_METAMETADATA',
    categoryName: 'Meta-metadata',
    weight: 1,
    definition: 'Interval atau jadwal pembaruan dataset dan metadata.',
    criteria1: 'Nilai codelist valid selain "unknown".',
    criteria05: '"unknown", teks bebas, atau tidak lengkap.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:resourceMaintenance, gmd:metadataMaintenance',
    esriPath: 'resMaint',
    ckanPath: 'extras: frequency-of-update',
    mdbPath: 'mri:resourceMaintenance/.../mmi:maintenanceAndUpdateFrequency',
    requiresManualReview: false,
  },
  {
    id: 'E24',
    name: 'Pernyataan lineage',
    category: 'CAT_PROCESSING',
    categoryName: 'Pemrosesan',
    weight: 3,
    definition: 'Uraian riwayat pemrosesan dan transformasi data.',
    criteria1: 'Menyebut sumber, metode, atau waktu (minimal dua komponen terpenuhi).',
    criteria05: 'Generik, salinan abstrak, rujukan peraturan saja, atau teks templat.',
    criteria0: 'Kosong atau nilReason=missing.',
    gmdPath: 'gmd:dataQualityInfo//gmd:LI_Lineage/gmd:statement',
    esriPath: 'Esri/DataProperties/lineage',
    ckanPath: 'extras: lineage',
    mdbPath: 'mdb:resourceLineage/mrl:LI_Lineage/mrl:statement',
    requiresManualReview: true,
  },
  {
    id: 'E25',
    name: 'Sumber data',
    category: 'CAT_PROCESSING',
    categoryName: 'Pemrosesan',
    weight: 3,
    definition: 'Deskripsi masukan dataset primer, sekunder, citra, atau peta dasar.',
    criteria1: 'Sumber data spesifik diuraikan (nama survei/citra/layer sumber).',
    criteria05: 'Generik (misal hanya menyebut kata "survei" tanpa rincian).',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:LI_Lineage/gmd:source',
    esriPath: 'lineage/Process (masukan)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:resourceLineage/mrl:LI_Lineage/mrl:source/...',
    requiresManualReview: true,
  },
  {
    id: 'E26',
    name: 'Langkah atau metode pemrosesan',
    category: 'CAT_PROCESSING',
    categoryName: 'Pemrosesan',
    weight: 3,
    definition: 'Langkah metodologis algoritma atau tahapan pengolahan data spasial.',
    criteria1: 'Langkah atau metode pemrosesan diuraikan secara runtut.',
    criteria05: 'Hanya riwayat proses otomatis perangkat lunak (ArcGIS Export/Rename) atau sangat generik.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:LI_Lineage/gmd:processStep',
    esriPath: 'lineage/Process',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:resourceLineage/mrl:LI_Lineage/mrl:processStep/...',
    requiresManualReview: true,
  },
];

export const EXTENSION_ELEMENTS_V4: ElementRuleV4[] = [
  {
    id: 'E27',
    name: 'Representasi Spasial (Topologi & Geometri)',
    category: 'CAT_GENERAL',
    categoryName: 'Informasi umum',
    weight: 2,
    definition: 'Bentuk geometri data (titik, garis, poligon) dan tingkat topologinya.',
    criteria1: 'Mencantumkan topologyLevel, geometricObjectType, dan count.',
    criteria05: 'Hanya mencantumkan salah satu atau dua komponen.',
    criteria0: 'Kosong atau tidak ada.',
    gmdPath: 'gmd:spatialRepresentationInfo',
    esriPath: '(tidak ada)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:spatialRepresentationInfo',
    requiresManualReview: false,
  },
  {
    id: 'E28',
    name: 'Lingkup Metadata (metadataScope)',
    category: 'CAT_GENERAL',
    categoryName: 'Informasi umum',
    weight: 1,
    definition: 'Level data (dataset, featureType, service) beserta nama spesifiknya.',
    criteria1: 'Ada MD_ScopeCode (dataset) dan nama spesifik lingkup.',
    criteria05: 'Hanya ada kode scope tanpa nama spesifik.',
    criteria0: 'Kosong atau tidak ada.',
    gmdPath: 'gmd:hierarchyLevel dan hierarchyLevelName',
    esriPath: '(tidak ada)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:metadataScope/mdb:MD_MetadataScope',
    requiresManualReview: false,
  },
  {
    id: 'E29',
    name: 'Katalog Simbol / Penyajian (portrayalCatalogueInfo)',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 1,
    definition: 'Aturan visualisasi/simbologi (warna, pola) yang digunakan pada peta.',
    criteria1: 'Ada sitasi ke dokumen aturan simbol resmi (SNI Penyajian Peta/Katalog Simbol).',
    criteria05: 'Ada teks deskriptif umum tetapi tidak spesifik.',
    criteria0: 'Kosong atau tidak ada.',
    gmdPath: 'gmd:portrayalCatalogueInfo',
    esriPath: '(tidak ada)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:portrayalCatalogueInfo',
    requiresManualReview: false,
  },
  {
    id: 'E30',
    name: 'Skema Aplikasi (applicationSchemaInfo)',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 2,
    definition: 'Model data (UML) atau kamus data yang mendefinisikan struktur data spasial.',
    criteria1: 'Ada nama skema (UML) dan tautan/dokumennya.',
    criteria05: 'Hanya nama skema tanpa dokumen.',
    criteria0: 'Kosong atau tidak ada.',
    gmdPath: 'gmd:applicationSchemaInfo',
    esriPath: '(tidak ada)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:applicationSchemaInfo',
    requiresManualReview: false,
  },
  {
    id: 'E31',
    name: 'Kepatuhan KUGI',
    category: 'CAT_DESCRIPTION',
    categoryName: 'Deskripsi',
    weight: 3,
    definition: 'Menilai kepatuhan data terhadap Katalog Unsur Geografi Indonesia (KUGI).',
    criteria1: 'Ada complianceCode (bernilai true) dan menyitasi Katalog Unsur Geografi Indonesia.',
    criteria05: 'Menyitasi KUGI tetapi complianceCode belum bernilai true.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:contentInfo',
    esriPath: '(tidak ada)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:contentInfo/mrc:MD_FeatureCatalogueDescription',
    requiresManualReview: false,
  },
  {
    id: 'E32',
    name: 'Metadata Layanan (distributionInfo / service)',
    category: 'CAT_GENERAL',
    categoryName: 'Informasi umum',
    weight: 2,
    definition: 'Tautan layanan (WMS/WFS/CSW) beserta deskripsi operasinya.',
    criteria1: 'Ada tautan layanan (WMS/WFS/CSW) dan deskripsi operasinya.',
    criteria05: 'Hanya tautan tanpa deskripsi operasi.',
    criteria0: 'Tidak ada.',
    gmdPath: 'gmd:distributionInfo / srv:SV_ServiceIdentification',
    esriPath: '(tidak ada)',
    ckanPath: '(tidak ada)',
    mdbPath: 'mdb:identificationInfo/srv:SV_ServiceIdentification',
    requiresManualReview: false,
  },
];

export interface V4ScoreCalculationResult {
  skorA: number;
  mqiBiner: number;
  mqiDiperluas: number;
  mqiKetat: number;
  skorA_placeholderZero?: number;
  kategoriBiner: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
  kategoriDiperluas: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
  totalElementWeight: number; // 58
  categoryFractions: Record<MQICategory, number>;
  categoryContributions: Record<MQICategory, number>;
  categoryPercentages: Record<MQICategory, number>;
  emptyElements: { id: string; name: string; weight: number; category: string }[];
  elementsFulfilledCount: number;
  elementsPartialCount: number;
  elementsEmptyCount: number;
}

export function getQualityTier(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor' {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 25) return 'Poor';
  return 'Very Poor';
}

/**
 * Calculates Skor A, MQI Biner, MQI Diperluas, MQI Ketat, Category Fractions, and Empty Elements.
 * Uses exact math from KOMPAS_data_audit_v4.xlsx (Sheet Skor & Acuan_Uji_Aplikasi).
 */
export function calculateV4Scores(
  scores: Record<string, number>,
  placeholderFlags?: Record<string, boolean>
): V4ScoreCalculationResult {
  const categoryElementSums: Record<MQICategory, { weightedScore: number; maxWeight: number; placeholderZeroScore: number }> = {
    CAT_GENERAL: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
    CAT_IDENTIFICATION: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
    CAT_DESCRIPTION: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
    CAT_EXTENT: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
    CAT_ACCURACY: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
    CAT_CONTACT: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
    CAT_METAMETADATA: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
    CAT_PROCESSING: { weightedScore: 0, maxWeight: 0, placeholderZeroScore: 0 },
  };

  let totalNumeratorBiner = 0;
  let totalNumeratorDiperluas = 0;
  let totalNumeratorKetat = 0;
  const totalElementWeight = 58;

  let fulfilledCount = 0;
  let partialCount = 0;
  let emptyCount = 0;
  const emptyElementsList: { id: string; name: string; weight: number; category: string }[] = [];

  for (const el of CORE_ELEMENTS_V4) {
    const rawVal = scores[el.id] !== undefined ? scores[el.id] : 0;
    const isPlaceholder = placeholderFlags ? !!placeholderFlags[el.id] : false;
    const placeholderAdjustedVal = isPlaceholder ? 0 : rawVal;

    categoryElementSums[el.category].maxWeight += el.weight;
    categoryElementSums[el.category].weightedScore += el.weight * rawVal;
    categoryElementSums[el.category].placeholderZeroScore += el.weight * placeholderAdjustedVal;

    totalNumeratorDiperluas += el.weight * rawVal;
    if (rawVal > 0) {
      totalNumeratorBiner += el.weight;
    }
    if (rawVal === 1) {
      totalNumeratorKetat += el.weight;
    }

    if (rawVal === 1) fulfilledCount++;
    else if (rawVal === 0.5) partialCount++;
    else {
      emptyCount++;
      emptyElementsList.push({
        id: el.id,
        name: el.name,
        weight: el.weight,
        category: el.categoryName,
      });
    }
  }

  // Sort empty elements by weight descending (weight 3 first, then 2, then 1), then by element ID
  emptyElementsList.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.id.localeCompare(b.id);
  });

  // Calculate Category Fractions & Contributions
  const categoryFractions: Record<MQICategory, number> = {} as any;
  const categoryContributions: Record<MQICategory, number> = {} as any;
  const categoryPercentages: Record<MQICategory, number> = {} as any;

  let skorA = 0;
  let skorA_placeholderZero = 0;

  for (const catKey of Object.keys(CATEGORY_WEIGHTS_V4) as MQICategory[]) {
    const catMeta = CATEGORY_WEIGHTS_V4[catKey];
    const sums = categoryElementSums[catKey];

    const frac = sums.maxWeight > 0 ? sums.weightedScore / sums.maxWeight : 0;
    const fracPhZero = sums.maxWeight > 0 ? sums.placeholderZeroScore / sums.maxWeight : 0;

    const contrib = frac * catMeta.weight;
    const contribPhZero = fracPhZero * catMeta.weight;

    categoryFractions[catKey] = frac;
    categoryContributions[catKey] = contrib;
    categoryPercentages[catKey] = frac * 100;

    skorA += contrib;
    skorA_placeholderZero += contribPhZero;
  }

  const mqiBiner = (totalNumeratorBiner / totalElementWeight) * 100;
  const mqiDiperluas = (totalNumeratorDiperluas / totalElementWeight) * 100;
  const mqiKetat = (totalNumeratorKetat / totalElementWeight) * 100;

  return {
    skorA,
    mqiBiner,
    mqiDiperluas,
    mqiKetat,
    skorA_placeholderZero,
    kategoriBiner: getQualityTier(mqiBiner),
    kategoriDiperluas: getQualityTier(mqiDiperluas),
    totalElementWeight,
    categoryFractions,
    categoryContributions,
    categoryPercentages,
    emptyElements: emptyElementsList,
    elementsFulfilledCount: fulfilledCount,
    elementsPartialCount: partialCount,
    elementsEmptyCount: emptyCount,
  };
}

/**
 * Calculates extension score for E27 to E32.
 * Total weight = 2+1+1+2+3+2 = 11.
 */
export function calculateExtensionScore(
  scores: Record<string, number>,
  isIsoXml: boolean
): { score: number | null; totalEarned: number | null; maxPoints: number; isApplicable: boolean } {
  if (!isIsoXml) {
    return { score: null, totalEarned: null, maxPoints: 11, isApplicable: false };
  }
  let totalEarned = 0;
  const maxPoints = 11;
  for (const el of EXTENSION_ELEMENTS_V4) {
    const val = scores[el.id] !== undefined ? scores[el.id] : 0;
    totalEarned += el.weight * val;
  }
  const score = (totalEarned / maxPoints) * 100;
  return { score, totalEarned, maxPoints, isApplicable: true };
}
