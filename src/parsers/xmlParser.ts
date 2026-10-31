/**
 * KOMPAS - Metadata XML Parser (v7)
 * Robust & secure parser for ISO 19139 (gmd), ISO 19115-3 (mdb), Esri XML,
 * and CSW-wrapped responses (csw:GetRecordByIdResponse).
 *
 * Implements the 13 special cases from real marine metadata:
 * 1. CRS code 84 with codeSpace="CRS" recognized as OGC CRS84 (WGS 84).
 * 2. Bounding box containing empty strings is not 0 (invalid bounding box -> E13=0, F02).
 * 3. Multiple contact blocks evaluated, configurable strategy ('best_block').
 * 4. Email containing URL is invalid as email address.
 * 5. mdq:report containing DQ_ConformanceResult directly recorded as structural anomaly.
 * 6. Empty spatialRepresentationInfo -> E27=0.
 * 7. geometricObjectCount = 0 is invalid (E27 max 0.5).
 * 8. hierarchyLevelName containing only ISO scope words is generic -> E28=0.5.
 * 9. GeoNode featureCatalogueCitation is not KUGI citation -> E31=0.
 * 10. Service link description with generic label/portal name/title repetition -> E32=0.5.
 * 11. ESRI XML support.
 * 12. ArcGIS FeatureServer / MapServer recognized as feature/map service.
 * 13. CSW wrapper unwrapping.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { isPlaceholderValue } from '../audit/validator';
import { NormalizedMetadata } from '../types/audit';
import { getOpenDecisions } from '../audit/configLoader';

export function parseXmlMetadata(xmlString: string, fileName = 'metadata.xml'): NormalizedMetadata {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rawEvidence: NormalizedMetadata['rawEvidence'] = {};
  const openDecisions = getOpenDecisions();

  // XXE Defense: Check for dangerous DOCTYPE / ENTITY declarations
  if (/<!DOCTYPE\b[^>]*<!ENTITY/i.test(xmlString) || /SYSTEM\s+["'][^"']+["']/i.test(xmlString)) {
    errors.push('Ditemukan deklarasi DTD/ENTITY eksternal yang berpotensi membahayakan (XXE protection). Penguraian entitas eksternal dinonaktifkan.');
  }

  // Validate XML syntax
  const validation = XMLValidator.validate(xmlString);
  if (validation !== true) {
    errors.push(`Gagal mengurai dokumen XML: ${validation.err?.msg || 'Sintaks XML tidak valid atau struktur tag rusak.'}`);
    return {
      rawFormat: 'unknown',
      fileName,
      fileSizeBytes: new Blob([xmlString]).size,
      parsedAt: new Date().toISOString(),
      rawEvidence: {},
      parseWarnings: warnings,
      parseErrors: errors,
    };
  }

  // Configure fast-xml-parser safely
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true, // Strips 'gmd:', 'mdb:', 'gco:', 'gml:' etc. for unified normalized querying
    parseTagValue: true,
    trimValues: true,
  });

  let parsed: any = null;
  try {
    parsed = parser.parse(xmlString);
  } catch (err: any) {
    errors.push(`Gagal mengurai dokumen XML: ${err?.message || 'Sintaks XML tidak valid atau struktur tag rusak.'}`);
    return {
      rawFormat: 'unknown',
      fileName,
      fileSizeBytes: new Blob([xmlString]).size,
      parsedAt: new Date().toISOString(),
      rawEvidence: {},
      parseWarnings: warnings,
      parseErrors: errors,
    };
  }

  // Special Case 13: CSW wrapper unwrap (csw:GetRecordByIdResponse)
  let isCswWrapped = false;
  if (parsed?.GetRecordByIdResponse || parsed?.['csw:GetRecordByIdResponse']) {
    isCswWrapped = true;
    const cswWrapper = parsed.GetRecordByIdResponse || parsed['csw:GetRecordByIdResponse'];
    if (cswWrapper.MD_Metadata || cswWrapper['gmd:MD_Metadata'] || cswWrapper['mdb:MD_Metadata']) {
      parsed = cswWrapper.MD_Metadata || cswWrapper['gmd:MD_Metadata'] || cswWrapper['mdb:MD_Metadata'];
      warnings.push('Berkas XML terbungkus respons CSW (csw:GetRecordByIdResponse), berhasil diekstrak.');
    } else if (cswWrapper.Record) {
      parsed = cswWrapper.Record;
      warnings.push('Berkas XML terbungkus rekaman CSW (csw:Record), berhasil diekstrak.');
    }
  }

  // Detect root element and format flavor
  const isMdb = /<mdb:MD_Metadata\b/i.test(xmlString) || /<(\w+:)?MD_Metadata\b[^>]*xmlns:mdb=/i.test(xmlString) || /\/19115\/-3\/mdb\//i.test(xmlString);
  const isGmd = /<gmd:MD_Metadata\b/i.test(xmlString) || (/<(\w+:)?MD_Metadata\b/i.test(xmlString) && !isMdb);
  const isIso19139 = isGmd || !!(parsed?.MD_Metadata || parsed?.['gmd:MD_Metadata'] || parsed?.metadata?.MD_Metadata);
  const isEsri = !!(parsed?.metadata?.idinfo || parsed?.metadata?.Esri || parsed?.idinfo || /<Esri\b/i.test(xmlString));
  const rawFormat = isMdb ? 'xml_iso19115_3' : (isIso19139 || isGmd) ? 'xml_iso19139' : isEsri ? 'xml_esri' : 'unknown';
  const xmlRootElement = isMdb ? 'mdb:MD_Metadata' : (isGmd || isIso19139) ? 'gmd:MD_Metadata' : isEsri ? 'esri_metadata' : 'other';

  if (rawFormat === 'unknown') {
    warnings.push('Format XML tidak secara langsung teridentifikasi sebagai ISO 19115-3 (mdb), ISO 19139 (gmd), maupun Esri Metadata standar.');
  }

  // Helper to deep traverse and find first non-empty text node
  function findNode(obj: any, keys: string[]): { value: any; path: string } | null {
    if (!obj || typeof obj !== 'object') return null;

    for (const key of keys) {
      if (key in obj && obj[key] !== undefined && obj[key] !== null) {
        let val = obj[key];
        // Handle ISO gco:CharacterString or similar wrapper objects
        if (typeof val === 'object' && val !== null) {
          if ('CharacterString' in val) val = val.CharacterString;
          else if ('LanguageCode' in val) val = typeof val.LanguageCode === 'object' ? (val.LanguageCode['#text'] || val.LanguageCode['@_codeListValue'] || val.LanguageCode) : val.LanguageCode;
          else if ('CI_RoleCode' in val) val = typeof val.CI_RoleCode === 'object' ? (val.CI_RoleCode['#text'] || val.CI_RoleCode['@_codeListValue'] || val.CI_RoleCode) : val.CI_RoleCode;
          else if ('MD_ScopeCode' in val) val = typeof val.MD_ScopeCode === 'object' ? (val.MD_ScopeCode['#text'] || val.MD_ScopeCode['@_codeListValue'] || val.MD_ScopeCode) : val.MD_ScopeCode;
          else if ('#text' in val) val = val['#text'];
          else if ('URL' in val) val = val.URL;
          else if ('Date' in val) val = val.Date;
          else if ('DateTime' in val) val = val.DateTime;
          else if ('Decimal' in val) val = val.Decimal;
          else if ('Integer' in val) val = val.Integer;
          else if ('Boolean' in val) val = val.Boolean;
        }
        if (val !== undefined && val !== null && val !== '') {
          return { value: val, path: key };
        }
      }
    }

    // Traverse children
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'object' && obj[k] !== null && !k.startsWith('@_')) {
        const sub = findNode(obj[k], keys);
        if (sub) {
          return { value: sub.value, path: `${k}/${sub.path}` };
        }
      }
    }
    return null;
  }

  // Helper to extract keywords list
  function extractKeywords(obj: any): string[] {
    const list: string[] = [];
    function scan(node: any) {
      if (!node) return;
      if (typeof node === 'string') {
        const parts = node.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
        list.push(...parts);
      } else if (Array.isArray(node)) {
        node.forEach(scan);
      } else if (typeof node === 'object') {
        for (const k of Object.keys(node)) {
          if (/keyword/i.test(k) || k === 'CharacterString') {
            scan(node[k]);
          }
        }
      }
    }
    const kwNode = findNode(obj, ['keyword', 'theme', 'keywords', 'descript', 'place', 'searchKeys']);
    if (kwNode) scan(kwNode.value);
    return Array.from(new Set(list));
  }

  // 1. Extract Title
  const titleMatch = findNode(parsed, ['title', 'resTitle', 'CitationTitle', 'datasetTitle']);
  const title = typeof titleMatch?.value === 'string' ? titleMatch.value : undefined;
  if (titleMatch) {
    rawEvidence.title = { value: title, path: titleMatch.path, isPlaceholder: isPlaceholderValue(title) };
  }

  // 2. Extract Identifier (E06)
  const idMatch = findNode(parsed, ['fileIdentifier', 'id', 'datasetId', 'identCode', 'code', 'metadataIdentifier']);
  const datasetId = typeof idMatch?.value === 'string' ? idMatch.value : typeof idMatch?.value === 'number' ? String(idMatch.value) : undefined;
  if (idMatch) {
    rawEvidence.datasetId = { value: datasetId, path: idMatch.path, isPlaceholder: isPlaceholderValue(datasetId) };
  }

  // 3. Extract Abstract (E07)
  const abstractMatch = findNode(parsed, ['abstract', 'idAbs', 'descript']);
  const abstract = typeof abstractMatch?.value === 'string' ? abstractMatch.value : undefined;
  if (abstractMatch) {
    rawEvidence.abstract = { value: abstract, path: abstractMatch.path, isPlaceholder: isPlaceholderValue(abstract) };
  }

  // 4. Extract Purpose (E08)
  const purposeMatch = findNode(parsed, ['purpose', 'idPurp']);
  const purpose = typeof purposeMatch?.value === 'string' ? purposeMatch.value : undefined;
  if (purposeMatch) {
    rawEvidence.purpose = { value: purpose, path: purposeMatch.path, isPlaceholder: isPlaceholderValue(purpose) };
  }

  // 5. Extract Language (E01)
  const langMatch = findNode(parsed, ['LanguageCode', 'language', 'dataLang', 'mdLang']);
  let language = typeof langMatch?.value === 'string' ? langMatch.value : undefined;
  if (langMatch) {
    rawEvidence.language = { value: language, path: langMatch.path, isPlaceholder: isPlaceholderValue(language) };
  }

  // 6. Special Case 2: Bounding Box (E13) - Empty string is NOT 0
  const westMatch = findNode(parsed, ['westBoundLongitude', 'westbc', 'westBL']);
  const eastMatch = findNode(parsed, ['eastBoundLongitude', 'eastbc', 'eastBL']);
  const southMatch = findNode(parsed, ['southBoundLatitude', 'southbc', 'southBL']);
  const northMatch = findNode(parsed, ['northBoundLatitude', 'northbc', 'northBL']);

  const rawWestStr = westMatch?.value !== undefined && westMatch?.value !== null ? String(westMatch.value).trim() : '';
  const rawEastStr = eastMatch?.value !== undefined && eastMatch?.value !== null ? String(eastMatch.value).trim() : '';
  const rawSouthStr = southMatch?.value !== undefined && southMatch?.value !== null ? String(southMatch.value).trim() : '';
  const rawNorthStr = northMatch?.value !== undefined && northMatch?.value !== null ? String(northMatch.value).trim() : '';

  let isBBoxValid = true;
  let bboxError: string | undefined;
  let west: number | undefined;
  let east: number | undefined;
  let south: number | undefined;
  let north: number | undefined;

  // Empty string check:
  if (!rawWestStr || !rawEastStr || !rawSouthStr || !rawNorthStr) {
    isBBoxValid = false;
    bboxError = 'Koordinat bounding box tidak lengkap atau memuat teks kosong.';
  } else {
    west = parseFloat(rawWestStr);
    east = parseFloat(rawEastStr);
    south = parseFloat(rawSouthStr);
    north = parseFloat(rawNorthStr);

    if (isNaN(west) || isNaN(east) || isNaN(south) || isNaN(north)) {
      isBBoxValid = false;
      bboxError = 'Koordinat bounding box bukan angka numerik yang valid.';
    } else if (west === 0 && east === 0 && south === 0 && north === 0) {
      isBBoxValid = false;
      bboxError = 'Bounding box 0,0,0,0 (tidak informatif).';
    } else if (west >= east || south >= north) {
      isBBoxValid = false;
      bboxError = 'Koordinat bounding box terbalik (west >= east atau south >= north).';
    }
  }

  // 7. Special Case 1: CRS code 84 with codeSpace="CRS" (E15)
  const isCrs84 = /codeSpace=["']CRS["'][^>]*>84<|84<\/[^>]*>[\s\S]*?codeSpace=["']CRS["']/i.test(xmlString) ||
    /codeSpace=["']CRS["']\s*code=["']84["']/i.test(xmlString) ||
    /code=["']84["']\s*codeSpace=["']CRS["']/i.test(xmlString) ||
    /<(?:mcc:)?codeSpace>\s*CRS\s*<\/(?:mcc:)?codeSpace>[\s\S]*?<(?:mcc:)?code>\s*84\s*<\/(?:mcc:)?code>/i.test(xmlString) ||
    /<(?:mcc:)?code>\s*84\s*<\/(?:mcc:)?code>[\s\S]*?<(?:mcc:)?codeSpace>\s*CRS\s*<\/(?:mcc:)?codeSpace>/i.test(xmlString) ||
    /\bOGC:CRS84\b|\bCRS84\b/i.test(xmlString);

  let crsVal: string | undefined;
  let crsCode: string | undefined;
  if (isCrs84) {
    crsVal = 'OGC:CRS84 (WGS 84)';
    crsCode = 'CRS84';
  } else {
    const crsMatch = findNode(parsed, ['referenceSystemIdentifier', 'refSysCode', 'datum', 'horizpa', 'projection', 'refSysInfo']);
    crsVal = typeof crsMatch?.value === 'string' ? crsMatch.value : typeof crsMatch?.value === 'object' ? JSON.stringify(crsMatch.value) : undefined;
    const epsgMatch = xmlString.match(/EPSG[:/]?\s*(\d{4,5})/i);
    if (epsgMatch) crsCode = `EPSG:${epsgMatch[1]}`;
  }

  // 8. Special Case 3 & 4: Multiple Contact Blocks & URL in Email (E19, E20)
  const contactBlocks: {
    organization?: string;
    individualName?: string;
    role?: string;
    email?: string;
    phone?: string;
    address?: string;
    isPlaceholder?: boolean;
    hasUrlInEmail?: boolean;
    isInstitutionalEmail?: boolean;
  }[] = [];

  // Extract all CI_ResponsibleParty / CI_Responsibility / idPoC blocks
  const contactXmlRegex = /<(?:(?:gmd|cit):)?(?:CI_ResponsibleParty|CI_Responsibility|idPoC)\b[\s\S]*?<\/(?:(?:gmd|cit):)?(?:CI_ResponsibleParty|CI_Responsibility|idPoC)>/gi;
  let cMatch: RegExpExecArray | null;
  while ((cMatch = contactXmlRegex.exec(xmlString)) !== null) {
    const blockXml = cMatch[0];
    const orgM = blockXml.match(/<(?:(?:gmd|cit):)?(?:organisationName|name|cntorg)[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    const indM = blockXml.match(/<(?:(?:gmd|cit):)?(?:individualName|cntper)[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    const roleM = blockXml.match(/(?:codeListValue|CI_RoleCode)[^>]*>([^<]+)<\/|(?:codeListValue|CI_RoleCode)="([^"]+)"/i);
    const emailM = blockXml.match(/<(?:(?:gmd|cit):)?(?:electronicMailAddress|cntemail|email)[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    const phoneM = blockXml.match(/<(?:(?:gmd|cit):)?(?:voice|phone|cntvoice)[^>]*>(?:<[^>]+>)*([^<]+)<\//i);

    const cOrg = orgM?.[1]?.trim();
    const cInd = indM?.[1]?.trim();
    const cRole = roleM?.[1]?.trim() || roleM?.[2]?.trim();
    const cEmail = emailM?.[1]?.trim();
    const cPhone = phoneM?.[1]?.trim();

    // Check placeholder in contact
    const hasPh = isPlaceholderValue(cOrg) || isPlaceholderValue(cEmail) ||
      /Ancient Geographers|Claudius Ptolomaeus|Admin Admin|Belum Ada/i.test(`${cOrg} ${cInd}`);

    // Check Case 4: Email containing URL
    const hasUrlEmail = !!(cEmail && /https?:\/\//i.test(cEmail));

    // Check institutional email: domain .go.id, .ac.id, .mil.id, etc. and not public webmail
    let isInstEmail = false;
    if (cEmail && !hasUrlEmail && !/@(gmail|yahoo|hotmail|outlook)\.com/i.test(cEmail)) {
      if (/\.(go\.id|ac\.id|mil\.id|org\.id|gov|edu)\b/i.test(cEmail) || /pushidrosal\.id|kkp\.go\.id|big\.go\.id/i.test(cEmail)) {
        isInstEmail = true;
      }
    }

    contactBlocks.push({
      organization: cOrg,
      individualName: cInd,
      role: cRole,
      email: cEmail,
      phone: cPhone,
      isPlaceholder: hasPh,
      hasUrlInEmail: hasUrlEmail,
      isInstitutionalEmail: isInstEmail,
    });
  }

  // Fallback single extraction if regex found nothing
  if (contactBlocks.length === 0) {
    const orgMatch = findNode(parsed, ['organisationName', 'cntorg', 'rpOrgName', 'Originator', 'publisher']);
    const emailMatch = findNode(parsed, ['electronicMailAddress', 'cntemail', 'email']);
    const indNameMatch = findNode(parsed, ['individualName', 'cntper', 'rpIndName']);
    const roleMatch = findNode(parsed, ['role', 'roleCode', 'RoleCode']);

    const sOrg = typeof orgMatch?.value === 'string' ? orgMatch.value : undefined;
    const sEmail = typeof emailMatch?.value === 'string' ? emailMatch.value : undefined;
    const sInd = typeof indNameMatch?.value === 'string' ? indNameMatch.value : undefined;
    const sRole = typeof roleMatch?.value === 'string' ? roleMatch.value : undefined;

    const hasUrlEmail = !!(sEmail && /https?:\/\//i.test(sEmail));
    const isInst = !!(sEmail && !hasUrlEmail && !/@(gmail|yahoo|hotmail)\.com/i.test(sEmail) && /\.(go\.id|ac\.id|mil\.id|org\.id|gov)/i.test(sEmail));

    contactBlocks.push({
      organization: sOrg,
      individualName: sInd,
      role: sRole,
      email: sEmail,
      isPlaceholder: isPlaceholderValue(sOrg) || isPlaceholderValue(sEmail),
      hasUrlInEmail: hasUrlEmail,
      isInstitutionalEmail: isInst,
    });
  }

  // Choose representative contact based on strategy
  let primaryContact = contactBlocks[0] || {};
  if (openDecisions.contactBlockStrategy === 'best_block') {
    // Find best block: prefer one with both official org and institutional email
    const bestBlock = contactBlocks.find(b => b.isInstitutionalEmail && b.organization && !b.isPlaceholder) ||
      contactBlocks.find(b => b.isInstitutionalEmail && !b.isPlaceholder) ||
      contactBlocks.find(b => b.organization && !b.isPlaceholder) ||
      contactBlocks[0];
    if (bestBlock) {
      primaryContact = bestBlock;
    }
  }

  // 9. Dates (E05, E22)
  const pubDateMatch = findNode(parsed, ['publicationDate', 'pubdate']) ||
    xmlString.match(/<gmd:dateType>[\s\S]*?publication[\s\S]*?<\/gmd:dateType>[\s\S]*?<gco:Date>([^<]+)<\//i);
  const createDateMatch = findNode(parsed, ['creationDate', 'createDate']) ||
    xmlString.match(/<gmd:dateType>[\s\S]*?creation[\s\S]*?<\/gmd:dateType>[\s\S]*?<gco:Date>([^<]+)<\//i);
  const revDateMatch = findNode(parsed, ['revisionDate', 'dateStamp']);

  const pubDate = Array.isArray(pubDateMatch)
    ? pubDateMatch[1]
    : typeof (pubDateMatch as any)?.value === 'string'
    ? (pubDateMatch as any).value
    : undefined;
  const metaDateMatch = findNode(parsed, ['dateStamp', 'metd', 'dateInfo']);
  const metaDate = typeof metaDateMatch?.value === 'string' ? metaDateMatch.value : undefined;

  // 10. Accuracy & Marine Lineage (E16, E17, E24, E25, E26)
  const vertDatumMatch = findNode(parsed, ['verticalDatum', 'vdatum', 'depthDatum', 'soundingDatum']);
  const tvuMatch = findNode(parsed, ['totalVerticalUncertainty', 'verticalAccuracy', 'vertacc', 'TVU']);
  const thuMatch = findNode(parsed, ['totalHorizontalUncertainty', 'horizontalAccuracy', 'horizacc', 'THU']);

  // Special Case 5: Direct Conformance Result in mdq:report
  const hasDirectConformance = /<(?:mdq:)?report>\s*<(?:mdq:)?DQ_ConformanceResult/i.test(xmlString) ||
    /<(?:gmd:)?report>\s*<(?:gmd:)?DQ_ConformanceResult/i.test(xmlString);

  // Lineage / Processing
  const lineageMatch = findNode(parsed, ['statement', 'procdesc', 'lineageStatement']);
  let lineage = typeof lineageMatch?.value === 'string' ? lineageMatch.value : undefined;
  if (!lineage) {
    const rawLineageNode = findNode(parsed, ['lineage']);
    if (rawLineageNode && typeof rawLineageNode.value === 'object') {
      const nested = findNode(rawLineageNode.value, ['statement', 'procdesc', 'CharacterString', '#text']);
      if (typeof nested?.value === 'string') lineage = nested.value;
    }
  }

  // 11. Distribution & Online Resources (E03, E32)
  const allOnlineResources: {
    url: string;
    protocol?: string;
    name?: string;
    description?: string;
    isService?: boolean;
    isDirectDownload?: boolean;
    isLocalPath?: boolean;
  }[] = [];

  const onlineResourceRegex = /<(?:(?:gmd|cit|mrd):)?CI_OnlineResource\b[\s\S]*?<\/(?:(?:gmd|cit|mrd):)?CI_OnlineResource>/gi;
  let rMatch: RegExpExecArray | null;
  while ((rMatch = onlineResourceRegex.exec(xmlString)) !== null) {
    const bXml = rMatch[0];
    const urlM = bXml.match(/<(?:(?:gmd|cit|mrd):)?(?:linkage|URL)[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    const protoM = bXml.match(/<(?:(?:gmd|cit|mrd):)?protocol[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    const nameM = bXml.match(/<(?:(?:gmd|cit|mrd):)?name[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    const descM = bXml.match(/<(?:(?:gmd|cit|mrd):)?description[^>]*>(?:<[^>]+>)*([^<]+)<\//i);

    const rUrl = urlM?.[1]?.trim();
    if (rUrl) {
      const isLocal = /^(file:\/\/|[a-zA-Z]:\\|\/\/)/i.test(rUrl);
      const isSvc = /wms|wfs|wcs|csw|featureserver|mapserver/i.test(`${rUrl} ${protoM?.[1] || ''}`);
      const isDl = /download|shape-zip|export|getdata/i.test(`${rUrl} ${protoM?.[1] || ''}`) && !isLocal;

      allOnlineResources.push({
        url: rUrl,
        protocol: protoM?.[1]?.trim(),
        name: nameM?.[1]?.trim(),
        description: descM?.[1]?.trim(),
        isService: isSvc,
        isDirectDownload: isDl,
        isLocalPath: isLocal,
      });
    }
  }

  // 12. Extensions E27–E32
  // E27: Special Case 6 (empty tag) & Case 7 (geometricObjectCount = 0)
  let e27TopologyLevel: string | undefined;
  let e27GeometricType: string | undefined;
  let e27Count: number | undefined;

  const topMatch = findNode(parsed, ['topologyLevel', 'MD_TopologyLevelCode', 'topLvl']) ||
    xmlString.match(/topologyLevel[^>]*>(?:<[^>]+>)*([a-zA-Z0-9_]+)/i) ||
    xmlString.match(/MD_TopologyLevelCode[^>]*codeListValue="([^"]+)"/i);
  if (topMatch) e27TopologyLevel = typeof topMatch === 'object' && 'value' in topMatch ? String(topMatch.value) : (Array.isArray(topMatch) ? topMatch[1] : undefined);

  const geomMatch = findNode(parsed, ['geometricObjectType', 'MD_GeometricObjectTypeCode', 'geoObjTyp']) ||
    xmlString.match(/geometricObjectType[^>]*>(?:<[^>]+>)*([a-zA-Z0-9_]+)/i) ||
    xmlString.match(/MD_GeometricObjectTypeCode[^>]*codeListValue="([^"]+)"/i);
  if (geomMatch) e27GeometricType = typeof geomMatch === 'object' && 'value' in geomMatch ? String(geomMatch.value) : (Array.isArray(geomMatch) ? geomMatch[1] : undefined);

  const countMatch = findNode(parsed, ['geometricObjectCount', 'count', 'geoObjCnt']) ||
    xmlString.match(/geometricObjectCount[^>]*>(?:<[^>]+>)*(\d+)/i) ||
    xmlString.match(/<count[^>]*>(\d+)<\/count>/i) ||
    xmlString.match(/<geoObjCnt[^>]*>(\d+)<\/geoObjCnt>/i);
  if (countMatch) {
    const rawCount = typeof countMatch === 'object' && 'value' in countMatch ? Number(countMatch.value) : parseInt(countMatch[1], 10);
    if (!isNaN(rawCount)) e27Count = rawCount;
  }

  rawEvidence.e27_spatialRepresentation = {
    value: { topologyLevel: e27TopologyLevel, geometricObjectType: e27GeometricType, count: e27Count },
    path: 'spatialRepresentationInfo',
    isPlaceholder: false,
  };

  // E28: Special Case 8: Scope Code & Name with ISO Scope words check
  let e28ScopeCode: string | undefined;
  let e28ScopeName: string | undefined;

  const scopeCodeMatch = findNode(parsed, ['resourceScope', 'MD_ScopeCode', 'scopeCode', 'hierarchyLevel', 'ScopeCd']) ||
    xmlString.match(/MD_ScopeCode[^>]*codeListValue="([^"]+)"/i) ||
    xmlString.match(/<ScopeCd[^>]*value="([^"]+)"/i) ||
    xmlString.match(/resourceScope[^>]*>(?:<[^>]+>)*([a-zA-Z0-9_]+)/i);
  if (scopeCodeMatch) e28ScopeCode = typeof scopeCodeMatch === 'object' && 'value' in scopeCodeMatch ? String(scopeCodeMatch.value) : (Array.isArray(scopeCodeMatch) ? scopeCodeMatch[1] : undefined);

  const scopeNameMatch = findNode(parsed, ['metadataScopeName', 'scopeName', 'hierarchyLevelName', 'mdHrLvName']) ||
    xmlString.match(/<(?:mcc:)?name[^>]*>(?:<[^>]+>)*([^<]+)<\//i) ||
    xmlString.match(/<gmd:hierarchyLevelName[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
  if (scopeNameMatch) {
    const candidateName = typeof scopeNameMatch === 'object' && 'value' in scopeNameMatch ? String(scopeNameMatch.value) : (Array.isArray(scopeNameMatch) ? scopeNameMatch[1] : undefined);
    if (candidateName && candidateName !== e28ScopeCode && !candidateName.includes('<')) {
      e28ScopeName = candidateName;
    }
  }

  // E29: Portrayal Catalogue
  let e29Citation: string | undefined;
  let e29IsSpecificDoc = false;
  const portrayalBlock = xmlString.match(/<(?:mdb:)?portrayalCatalogueInfo[\s\S]*?<\/(?:mdb:)?portrayalCatalogueInfo>/i)?.[0];
  const portrayalNode = findNode(parsed, ['portrayalCatalogueInfo', 'portrayalCatalogueCitation', 'MD_PortrayalCatalogueReference']);
  if (portrayalBlock || portrayalNode) {
    const pText = portrayalBlock || JSON.stringify(portrayalNode?.value || '');
    e29Citation = pText;
    if (/sni|rsni|perka|peraturan|spesifikasi|iho\s*s-52/i.test(pText)) {
      e29IsSpecificDoc = true;
    }
  }

  // E30: Application Schema
  let e30SchemaName: string | undefined;
  let e30DocLink: string | undefined;
  const appSchemaBlock = xmlString.match(/<(?:mdb:)?applicationSchemaInfo[\s\S]*?<\/(?:mdb:)?applicationSchemaInfo>/i)?.[0];
  const appSchemaNode = findNode(parsed, ['applicationSchemaInfo', 'MD_ApplicationSchemaInformation', 'schemaAscii']);
  if (appSchemaBlock || appSchemaNode) {
    const asText = appSchemaBlock || JSON.stringify(appSchemaNode?.value || '');
    const nameM = asText.match(/name[^>]*>(?:<[^>]+>)*([^<]+)<\//i) || asText.match(/title[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    if (nameM) e30SchemaName = nameM[1];
    const linkM = asText.match(/(https?:\/\/[^\s<"'>]+|\b[a-zA-Z0-9_\-\.\/]+\.(?:uml|xsd|pdf|docx?|html))\b/i);
    if (linkM) e30DocLink = linkM[1];
  }

  // E31: Special Case 9: KUGI compliance
  let e31ComplianceCode: boolean | undefined;
  let e31CitesKugi = false;
  let featureCatFound = false;
  let featureCatTitle: string | undefined;

  const contentBlock = xmlString.match(/<(?:mdb:)?contentInfo[\s\S]*?<\/(?:mdb:)?contentInfo>/i)?.[0] ||
    xmlString.match(/<(?:mrc:)?MD_FeatureCatalogueDescription[\s\S]*?<\/(?:mrc:)?MD_FeatureCatalogueDescription>/i)?.[0] ||
    xmlString.match(/<gmd:MD_FeatureCatalogueDescription[\s\S]*?<\/gmd:MD_FeatureCatalogueDescription>/i)?.[0];
  if (contentBlock) {
    featureCatFound = true;
    const catTitleM = contentBlock.match(/title[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    if (catTitleM) featureCatTitle = catTitleM[1];

    if (/katalog\s*unsur\s*geografi\s*indonesia|\bkugi\b/i.test(contentBlock)) {
      e31CitesKugi = true;
    }
    const compM = contentBlock.match(/complianceCode[^>]*>(?:<[^>]+>)*(true|false|1|0)/i) ||
      contentBlock.match(/complianceCode="?(true|false|1|0)"?/i);
    if (compM) {
      e31ComplianceCode = compM[1].toLowerCase() === 'true' || compM[1] === '1';
    }
  }

  // E32: Special Case 10: Service metadata & description check
  let e32ServiceUrl: string | undefined;
  let e32OperationDesc: string | undefined;
  if (allOnlineResources.some(r => r.isService)) {
    const svc = allOnlineResources.find(r => r.isService);
    e32ServiceUrl = svc?.url;
    e32OperationDesc = svc?.description || svc?.name;
  }

  rawEvidence.e28_metadataScope = {
    value: { scopeCode: e28ScopeCode, name: e28ScopeName },
    path: 'metadataScope / hierarchyLevel',
    isPlaceholder: false,
  };

  rawEvidence.e29_portrayalCatalogue = {
    value: { citation: e29Citation, isSpecificDocument: e29IsSpecificDoc },
    path: 'portrayalCatalogueInfo',
    isPlaceholder: false,
  };

  rawEvidence.e30_applicationSchema = {
    value: { schemaName: e30SchemaName, docLink: e30DocLink },
    path: 'applicationSchemaInfo',
    isPlaceholder: false,
  };

  rawEvidence.e31_kugiCompliance = {
    value: { complianceCode: e31ComplianceCode, citesKugi: e31CitesKugi },
    path: 'contentInfo/MD_FeatureCatalogueDescription',
    isPlaceholder: false,
  };

  rawEvidence.e32_distributionService = {
    value: { serviceUrl: e32ServiceUrl, operationDescription: e32OperationDesc },
    path: 'distributionInfo/CI_OnlineResource',
    isPlaceholder: false,
  };

  // Metadata Standard Name & Version
  const standardNameMatch = findNode(parsed, ['metadataStandardName', 'metstdn', 'standardName']);
  const standardVersionMatch = findNode(parsed, ['metadataStandardVersion', 'metstdv', 'standardVersion']);

  return {
    rawFormat,
    xmlRootElement,
    isMdbFormat: isMdb,
    fileName,
    fileSizeBytes: new Blob([xmlString]).size,
    parsedAt: new Date().toISOString(),
    title,
    datasetId,
    abstract,
    purpose,
    keywords: extractKeywords(parsed),
    language,
    spatialExtent: {
      westBoundLongitude: isNaN(west as number) ? undefined : west,
      eastBoundLongitude: isNaN(east as number) ? undefined : east,
      southBoundLatitude: isNaN(south as number) ? undefined : south,
      northBoundLatitude: isNaN(north as number) ? undefined : north,
      crsName: crsVal,
      crsCode,
      datum: typeof vertDatumMatch?.value === 'string' ? vertDatumMatch.value : undefined,
      isBBoxValid,
      bboxError,
      isCrs84,
      rawBboxValues: { west: rawWestStr, east: rawEastStr, south: rawSouthStr, north: rawNorthStr },
    },
    temporalExtent: {
      publicationDate: pubDate,
    },
    contact: {
      organization: primaryContact.organization,
      individualName: primaryContact.individualName,
      role: primaryContact.role,
      email: primaryContact.email,
      phone: primaryContact.phone,
      isPlaceholder: primaryContact.isPlaceholder,
      hasUrlInEmail: primaryContact.hasUrlInEmail,
      isInstitutionalEmail: primaryContact.isInstitutionalEmail,
    },
    contactBlocks,
    allOnlineResources,
    scopeCode: e28ScopeCode,
    scopeName: e28ScopeName,
    hasDirectConformanceReport: hasDirectConformance,
    kugiCitationFound: e31CitesKugi,
    kugiComplianceCode: e31ComplianceCode,
    featureCatalogueFound: featureCatFound,
    featureCatalogueCitationTitle: featureCatTitle,
    accuracy: {
      totalVerticalUncertainty: tvuMatch?.value,
      totalHorizontalUncertainty: thuMatch?.value,
      verticalDatum: typeof vertDatumMatch?.value === 'string' ? vertDatumMatch.value : undefined,
      soundVelocityCorrected: xmlString.toLowerCase().includes('sound velocity') || xmlString.toLowerCase().includes('svp'),
      tideCorrected: xmlString.toLowerCase().includes('tide') || xmlString.toLowerCase().includes('pasang surut'),
    },
    processing: {
      lineageStatement: lineage,
      softwareUsed: findNode(parsed, ['software', 'processSoftware'])?.value,
    },
    metaMetadata: {
      standardName: typeof standardNameMatch?.value === 'string' ? standardNameMatch.value : isMdb ? 'ISO 19115-3 (mdb)' : isIso19139 ? 'ISO 19115/19139 (gmd)' : isEsri ? 'Esri Metadata' : undefined,
      standardVersion: typeof standardVersionMatch?.value === 'string' ? standardVersionMatch.value : undefined,
      metadataDate: metaDate,
    },
    rawEvidence,
    parseWarnings: warnings,
    parseErrors: errors,
  };
}
