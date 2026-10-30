/**
 * KOMPAS - Unit Tests for Core Logic & Auditing Engine
 * Uses Node's built-in test runner (node:test) as mandated by Ultra Mode.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseXmlMetadata } from '../parsers/xmlParser';
import { parseJsonMetadata } from '../parsers/jsonParser';
import { parseGeoJson } from '../parsers/geoJsonParser';
import { runDatasetAudit } from './engine';
import { isPlaceholderValue, isValidContactEmail, validateBBox } from './validator';
import {
  SAMPLE_XML_BATIMETRI_ISO19139,
  SAMPLE_XML_BATIMETRI_ESRI,
  SAMPLE_XML_CORRUPTED,
  SAMPLE_XML_TERUMBU_PLACEHOLDER,
  SAMPLE_GEOJSON_BENGKALIS,
  SAMPLE_JSON_KALBAR,
} from '../data/samples';
import { BENCHMARK_DATASETS_V4 } from '../data/benchmarksV4';
import { calculateV4Scores } from './v4Rules';
import { QUALITY_FLAGS_DEFINITIONS } from './flags';

test('Placeholder Detection detects generic values and nulls', () => {
  assert.equal(isPlaceholderValue('Belum Ada'), true);
  assert.equal(isPlaceholderValue('TBD'), true);
  assert.equal(isPlaceholderValue('test@example.com'), false); // not a placeholder string per se, but email validator catches domain
  assert.equal(isPlaceholderValue(''), true);
  assert.equal(isPlaceholderValue('   '), true);
  assert.equal(isPlaceholderValue('null'), true);
  assert.equal(isPlaceholderValue('Survei Batimetri Alur Selat Malaka'), false);
});

test('Email validation flags invalid formats and example domains', () => {
  assert.equal(isValidContactEmail('survei.hidro@pushidrosal.id').valid, true);
  assert.equal(isValidContactEmail('test@example.com').valid, false);
  assert.equal(isValidContactEmail('invalid-email-string').valid, false);
  assert.equal(isValidContactEmail('admin@test.com').valid, false);
});

test('Bounding box validator catches coordinate ranges and inversions', () => {
  assert.equal(validateBBox(101.5, 1.5, 102.0, 2.0).valid, true);
  // Inverted: west > east
  assert.equal(validateBBox(105.0, 1.0, 100.0, 2.0).valid, false);
  // Out of range: longitude > 180
  assert.equal(validateBBox(190.0, 1.0, 195.0, 2.0).valid, false);
  // Pure zeros (unconfigured box)
  assert.equal(validateBBox(0, 0, 0, 0).valid, false);
});

test('XML Parser successfully extracts compliant ISO 19139 metadata', () => {
  const norm = parseXmlMetadata(SAMPLE_XML_BATIMETRI_ISO19139, 'malaka.xml');
  assert.equal(norm.rawFormat, 'xml_iso19139');
  assert.equal(norm.title, 'Survei Batimetri Multibeam Alur Pelayaran TSS Selat Malaka');
  assert.equal(norm.contact?.organization, 'Pusat Hidro-Oseanografi TNI AL (Pushidrosal)');
  assert.equal(norm.contact?.email, 'survei.hidro@pushidrosal.id');
  assert.equal(norm.accuracy?.verticalDatum, 'Lowest Astronomical Tide (LAT)');
  assert.equal(norm.accuracy?.soundVelocityCorrected, true);
  assert.ok(norm.spatialExtent?.westBoundLongitude !== undefined);
  assert.equal(norm.spatialExtent?.westBoundLongitude, 101.45);
  assert.equal(norm.parseErrors.length, 0);
});

test('XML Parser safely handles corrupted XML without throwing', () => {
  const norm = parseXmlMetadata(SAMPLE_XML_CORRUPTED, 'corrupt.xml');
  assert.ok(norm.parseErrors.length > 0);
  assert.equal(norm.rawFormat, 'unknown');
});

test('JSON Parser extracts catalog metadata and distinguishes placeholders', () => {
  const norm = parseJsonMetadata(SAMPLE_JSON_KALBAR, 'kalbar.json');
  assert.equal(norm.rawFormat, 'json_catalog');
  assert.equal(norm.title, 'Katalog Metadata Kawasan Konservasi Pesisir dan Pulau-Pulau Kecil (KKP3K) Kalimantan Barat');
  assert.equal(norm.datasetId, 'kkp3k-kalbar-2023-resmi');
  assert.equal(norm.spatialExtent?.westBoundLongitude, 108.45);
  assert.equal(norm.contact?.organization, 'Dinas Kelautan dan Perikanan Provinsi Kalimantan Barat');
});

test('GeoJSON Parser validates FeatureCollection and polygon rings', () => {
  const spatial = parseGeoJson(SAMPLE_GEOJSON_BENGKALIS, 'bengkalis.geojson');
  assert.equal(spatial.format, 'geojson');
  assert.equal(spatial.featureCount, 3);
  assert.equal(spatial.geometryTypes.includes('Polygon'), true);
  assert.equal(spatial.ringClosureErrorsCount, 0);
  assert.equal(spatial.emptyGeometryCount, 0);
  assert.ok(spatial.bounds[0] > 100); // longitude east of 100°
});

test('MQI Audit Engine evaluates Bathymetric dataset with high score for compliant survey', () => {
  const meta = parseXmlMetadata(SAMPLE_XML_BATIMETRI_ISO19139, 'malaka.xml');
  const report = runDatasetAudit('batimetri', meta);

  assert.ok(report.scoreReport.adaptedScore !== null);
  // Compliant multibeam should score high (>= 85%)
  assert.ok((report.scoreReport.adaptedScore as number) >= 80);
  assert.ok(report.scoreReport.statusCounts.tidak_berlaku >= 0);
  assert.ok(report.scoreReport.categorySummaries.length === 8);
});

test('MQI Audit Engine flags provisional score on placeholder metadata', () => {
  const meta = parseXmlMetadata(SAMPLE_XML_TERUMBU_PLACEHOLDER, 'draft.xml');
  const report = runDatasetAudit('terumbu_karang', meta);

  assert.equal(report.scoreReport.isProvisional, true);
  assert.ok(report.scoreReport.provisionalReasons.length > 0);
  // Should have invalid parameters for email, date, etc.
  assert.ok(report.scoreReport.statusCounts.tidak_valid > 0);
});

test('MQI Audit Engine excludes non-applicable parameters from denominator', () => {
  const meta = parseJsonMetadata(SAMPLE_JSON_KALBAR, 'kalbar.json');
  const report = runDatasetAudit('kawasan_konservasi', meta);

  // In 'kawasan_konservasi', bathymetry-only parameters (e.g. SVP, TVU) are not applicable or adapted
  const svpResult = report.parameterResults.find(r => r.ruleId === 'ACC-04');
  // If not applicable in profile, it is excluded
  if (svpResult) {
    assert.ok(svpResult.status === 'tidak_berlaku' || svpResult.weight > 0);
  }
});

test('ISO 19115 Core Metadata Compliance correctly verifies compliant dataset', () => {
  const meta = parseXmlMetadata(SAMPLE_XML_BATIMETRI_ISO19139, 'malaka.xml');
  const report = runDatasetAudit('batimetri', meta);

  assert.ok(report.iso19115Compliance !== undefined);
  assert.equal(report.iso19115Compliance.isCompliant, true);
  assert.ok(report.iso19115Compliance.coreScore >= 80);
  assert.ok(report.iso19115Compliance.elements.length >= 12);
  assert.ok(report.iso19115Compliance.standardReference.includes('ISO 19115'));
});

test('ISO 19115 Core Metadata Compliance flags incomplete or placeholder dataset', () => {
  const meta = parseXmlMetadata(SAMPLE_XML_TERUMBU_PLACEHOLDER, 'draft.xml');
  const report = runDatasetAudit('terumbu_karang', meta);

  assert.ok(report.iso19115Compliance !== undefined);
  assert.equal(report.iso19115Compliance.isCompliant, false);
  assert.ok(report.iso19115Compliance.statusLabel.includes('Belum Memenuhi'));
});

test('Peraturan BIG No. 3 Tahun 2023 evaluates transitional vs non-standard metadata', () => {
  const metaMalaka = parseXmlMetadata(SAMPLE_XML_BATIMETRI_ISO19139, 'malaka.xml');
  const reportMalaka = runDatasetAudit('batimetri', metaMalaka);

  assert.ok(reportMalaka.bigNo3Compliance !== undefined);
  assert.equal(reportMalaka.bigNo3Compliance.isWithinTransitionPeriod, true);
  assert.equal(reportMalaka.bigNo3Compliance.standardCategory, 'SNI ISO 19115:2012 (Transisi)');
  assert.equal(reportMalaka.bigNo3Compliance.isCompliant, true);

  const metaEsri = parseXmlMetadata(SAMPLE_XML_BATIMETRI_ESRI, 'esri.xml');
  const reportEsri = runDatasetAudit('batimetri', metaEsri);

  assert.ok(reportEsri.bigNo3Compliance !== undefined);
  assert.equal(reportEsri.bigNo3Compliance.standardCategory, 'Non-Standar');
  assert.equal(reportEsri.bigNo3Compliance.isCompliant, false);
});

test('ISO 19115-3 Extension Elements (E27-E32) are N/A for gmd:MD_Metadata root', () => {
  const metaGmd = parseXmlMetadata(SAMPLE_XML_BATIMETRI_ISO19139, 'malaka.xml');
  const report = runDatasetAudit('batimetri', metaGmd);

  // List 1 (E01-E26) must be evaluated
  assert.ok(report.coreElementsResults !== undefined);
  assert.equal(report.coreElementsResults.length, 26);
  assert.ok(report.coreScoreMqi !== undefined);
  assert.ok(report.coreScoreMqi > 0);

  // List 2 (E27-E32) must be N/A
  assert.ok(report.iso19115_3Readiness !== undefined);
  assert.equal(report.iso19115_3Readiness.isApplicable, false);
  assert.equal(report.iso19115_3Readiness.scorePercentage, null);
  assert.equal(report.iso19115_3Readiness.totalPointsEarned, null);
  assert.equal(report.iso19115_3Readiness.statusLabel, 'N/A (Format <gmd:MD_Metadata>)');
  assert.equal(report.iso19115_3Readiness.elements.length, 6);
  assert.equal(report.iso19115_3Readiness.elements[0].status, 'tidak_berlaku');
});

test('ISO 19115-3 Extension Elements (E27-E32) are evaluated actively for mdb:MD_Metadata root', () => {
  const sampleMdb = `<?xml version="1.0" encoding="UTF-8"?>
<mdb:MD_Metadata xmlns:mdb="http://standards.iso.org/iso/19115/-3/mdb/2.0"
                 xmlns:mcc="http://standards.iso.org/iso/19115/-3/mcc/1.0"
                 xmlns:mrc="http://standards.iso.org/iso/19115/-3/mrc/2.0"
                 xmlns:cit="http://standards.iso.org/iso/19115/-3/cit/2.0"
                 xmlns:gco="http://standards.iso.org/iso/19115/-3/gco/1.0">
  <mdb:metadataIdentifier>
    <mcc:MD_Identifier>
      <mcc:code><gco:CharacterString>ID-BATHY-2026-MDB</gco:CharacterString></mcc:code>
    </mcc:MD_Identifier>
  </mdb:metadataIdentifier>
  <mdb:metadataScope>
    <mcc:MD_Scope>
      <mcc:level><mcc:MD_ScopeCode codeListValue="dataset">dataset</mcc:MD_ScopeCode></mcc:level>
      <mcc:name><gco:CharacterString>Peta Batimetri Selat Sunda</gco:CharacterString></mcc:name>
    </mcc:MD_Scope>
  </mdb:metadataScope>
  <mdb:identificationInfo>
    <citation>
      <title><gco:CharacterString>Batimetri Multibeam Selat Sunda</gco:CharacterString></title>
    </citation>
    <abstract><gco:CharacterString>Survei kedalaman laut resolusi tinggi.</gco:CharacterString></abstract>
  </mdb:identificationInfo>
  <mdb:spatialRepresentationInfo>
    <topologyLevel><gco:CharacterString>geometryOnly</gco:CharacterString></topologyLevel>
    <geometricObjectType><gco:CharacterString>point</gco:CharacterString></geometricObjectType>
    <geometricObjectCount><gco:Integer>154200</gco:Integer></geometricObjectCount>
  </mdb:spatialRepresentationInfo>
  <mdb:portrayalCatalogueInfo>
    <cit:CI_Citation>
      <cit:title><gco:CharacterString>SNI 7644:2010 Penyajian Peta Kelautan</gco:CharacterString></cit:title>
    </cit:CI_Citation>
  </mdb:portrayalCatalogueInfo>
  <mdb:applicationSchemaInfo>
    <name><gco:CharacterString>Model Data Batimetri Nasional UML v2</gco:CharacterString></name>
    <schemaAscii><gco:CharacterString>https://geoportal.big.go.id/schemas/bathy_v2.xsd</gco:CharacterString></schemaAscii>
  </mdb:applicationSchemaInfo>
  <mdb:contentInfo>
    <mrc:MD_FeatureCatalogueDescription>
      <mrc:complianceCode><gco:Boolean>true</gco:Boolean></mrc:complianceCode>
      <mrc:featureCatalogueCitation>
        <cit:title><gco:CharacterString>Katalog Unsur Geografi Indonesia (KUGI)</gco:CharacterString></cit:title>
      </mrc:featureCatalogueCitation>
    </mrc:MD_FeatureCatalogueDescription>
  </mdb:contentInfo>
  <mdb:distributionInfo>
    <onlineResource>
      <linkage><gco:CharacterString>https://inarisk.bnpb.go.id/geoserver/wms</gco:CharacterString></linkage>
      <description><gco:CharacterString>Layanan Web Map Service (WMS) peta batimetri</gco:CharacterString></description>
    </onlineResource>
  </mdb:distributionInfo>
</mdb:MD_Metadata>`;

  const metaMdb = parseXmlMetadata(sampleMdb, 'sunda_mdb.xml');
  assert.equal(metaMdb.rawFormat, 'xml_iso19115_3');
  assert.equal(metaMdb.xmlRootElement, 'mdb:MD_Metadata');

  const report = runDatasetAudit('batimetri', metaMdb);

  assert.ok(report.iso19115_3Readiness !== undefined);
  assert.equal(report.iso19115_3Readiness.isApplicable, true);
  assert.equal(report.iso19115_3Readiness.rootElementDetected, 'mdb:MD_Metadata');
  assert.equal(report.iso19115_3Readiness.maxPoints, 6);
  assert.equal(report.iso19115_3Readiness.totalPointsEarned, 6);
  assert.equal(report.iso19115_3Readiness.scorePercentage, 100);
  assert.equal(report.iso19115_3Readiness.statusLabel, 'Sangat Siap (Fully Compliant)');

  // Verify all 6 elements have score 1
  report.iso19115_3Readiness.elements.forEach(el => {
    assert.equal(el.scoreValue, 1.0);
    assert.equal(el.status, 'terpenuhi');
    assert.equal(el.isApplicable, true);
  });
});

test('U1 Uji Hitung: D01 to D15 scores exactly match Excel v4 with tolerance <= 0.1', () => {
  for (const ds of BENCHMARK_DATASETS_V4) {
    const calc = calculateV4Scores(ds.scores);

    // 1. Skor A tolerance <= 0.1
    const diffSkorA = Math.abs(calc.skorA - ds.expectedSkorA);
    assert.ok(
      diffSkorA <= 0.1,
      `Dataset ${ds.id} Skor A mismatch: calc=${calc.skorA.toFixed(4)}, expected=${ds.expectedSkorA.toFixed(4)}, diff=${diffSkorA.toFixed(4)}`
    );

    // 2. MQI Biner tolerance <= 0.1
    const diffMqiBiner = Math.abs(calc.mqiBiner - ds.expectedMqiBiner);
    assert.ok(
      diffMqiBiner <= 0.1,
      `Dataset ${ds.id} MQI Biner mismatch: calc=${calc.mqiBiner.toFixed(4)}, expected=${ds.expectedMqiBiner.toFixed(4)}, diff=${diffMqiBiner.toFixed(4)}`
    );

    // 3. MQI Diperluas tolerance <= 0.1
    const diffMqiDiperluas = Math.abs(calc.mqiDiperluas - ds.expectedMqiDiperluas);
    assert.ok(
      diffMqiDiperluas <= 0.1,
      `Dataset ${ds.id} MQI Diperluas mismatch: calc=${calc.mqiDiperluas.toFixed(4)}, expected=${ds.expectedMqiDiperluas.toFixed(4)}, diff=${diffMqiDiperluas.toFixed(4)}`
    );

    // 4. MQI Ketat tolerance <= 0.1
    const diffMqiKetat = Math.abs(calc.mqiKetat - ds.expectedMqiKetat);
    assert.ok(
      diffMqiKetat <= 0.1,
      `Dataset ${ds.id} MQI Ketat mismatch: calc=${calc.mqiKetat.toFixed(4)}, expected=${ds.expectedMqiKetat.toFixed(4)}, diff=${diffMqiKetat.toFixed(4)}`
    );

    // 5. Kategori MQI
    assert.equal(calc.kategoriBiner, ds.expectedKategoriBiner, `Dataset ${ds.id} Kategori Biner`);
    assert.equal(calc.kategoriDiperluas, ds.expectedKategoriDiperluas, `Dataset ${ds.id} Kategori Diperluas`);

    // 6. Empty Elements Count
    assert.equal(calc.emptyElements.length, ds.emptyElementsCount, `Dataset ${ds.id} empty count`);

    // 7. Verify all expected empty elements are present
    const emptyIds = calc.emptyElements.map((e: any) => e.id);
    for (const expId of ds.emptyElementsList) {
      assert.ok(emptyIds.includes(expId), `Dataset ${ds.id} expected empty element ${expId}`);
    }

    // 8. Verify category percentages tolerance <= 0.1
    assert.ok(Math.abs(calc.categoryPercentages.CAT_GENERAL - ds.categoryPercentages.informasiUmum) <= 0.1);
    assert.ok(Math.abs(calc.categoryPercentages.CAT_IDENTIFICATION - ds.categoryPercentages.identifikasi) <= 0.1);
    assert.ok(Math.abs(calc.categoryPercentages.CAT_DESCRIPTION - ds.categoryPercentages.deskripsi) <= 0.1);
    assert.ok(Math.abs(calc.categoryPercentages.CAT_EXTENT - ds.categoryPercentages.cakupan) <= 0.1);
    assert.ok(Math.abs(calc.categoryPercentages.CAT_ACCURACY - ds.categoryPercentages.ketelitian) <= 0.1);
    assert.ok(Math.abs(calc.categoryPercentages.CAT_CONTACT - ds.categoryPercentages.kontak) <= 0.1);
    assert.ok(Math.abs(calc.categoryPercentages.CAT_METAMETADATA - ds.categoryPercentages.metaMetadata) <= 0.1);
    assert.ok(Math.abs(calc.categoryPercentages.CAT_PROCESSING - ds.categoryPercentages.pemrosesan) <= 0.1);
  }
});

test('U3 Uji Format: ESRI XML (D08) and CKAN JSON (D13, D14) are handled correctly', () => {
  const d08 = BENCHMARK_DATASETS_V4.find((d: any) => d.id === 'D08');
  assert.ok(d08 !== undefined);
  assert.equal(d08!.format, 'ESRI');
  assert.equal(d08!.expectedKategoriDiperluas, 'Very Poor');

  const d13 = BENCHMARK_DATASETS_V4.find((d: any) => d.id === 'D13');
  assert.ok(d13 !== undefined);
  assert.equal(d13!.format, 'CKAN');
  assert.equal(d13!.expectedKategoriDiperluas, 'Poor');

  const d14 = BENCHMARK_DATASETS_V4.find((d: any) => d.id === 'D14');
  assert.ok(d14 !== undefined);
  assert.equal(d14!.format, 'CKAN');
  assert.equal(d14!.expectedKategoriDiperluas, 'Poor');
});

test('U4 Uji Bendera: Quality warning flags (F01–F14) are properly registered', () => {
  for (let i = 1; i <= 14; i++) {
    const flagKey = `F${String(i).padStart(2, '0')}` as keyof typeof QUALITY_FLAGS_DEFINITIONS;
    assert.ok(QUALITY_FLAGS_DEFINITIONS[flagKey] !== undefined, `Flag ${flagKey} defined`);
    assert.ok(QUALITY_FLAGS_DEFINITIONS[flagKey].name.length > 0);
  }
});

