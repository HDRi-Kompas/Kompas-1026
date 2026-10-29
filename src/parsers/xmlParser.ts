/**
 * KOMPAS - Metadata XML Parser
 * Robust & secure parser for ISO 19139 and Esri/ArcGIS XML metadata formats.
 * Sanitizes input to prevent XXE (XML External Entity) attacks.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { isPlaceholderValue } from '../audit/validator';
import { NormalizedMetadata } from '../types/audit';

export function parseXmlMetadata(xmlString: string, fileName = 'metadata.xml'): NormalizedMetadata {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rawEvidence: NormalizedMetadata['rawEvidence'] = {};

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
    removeNSPrefix: true, // Strips 'gmd:', 'gco:', 'gml:' etc. for unified normalized querying
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

  // Detect root element and format flavor
  const isMdb = /<mdb:MD_Metadata\b/i.test(xmlString) || /<(\w+:)?MD_Metadata\b[^>]*xmlns:mdb=/i.test(xmlString);
  const isGmd = /<gmd:MD_Metadata\b/i.test(xmlString) || (/<(\w+:)?MD_Metadata\b/i.test(xmlString) && !isMdb);
  const isIso19139 = isGmd || !!(parsed?.MD_Metadata || parsed?.['gmd:MD_Metadata'] || parsed?.metadata?.MD_Metadata);
  const isEsri = !!(parsed?.metadata?.idinfo || parsed?.metadata?.Esri || parsed?.idinfo);
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
        // Handle ISO 19139 gco:CharacterString or similar wrapper objects
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
        if (val !== undefined && val !== null) {
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
    const kwNode = findNode(obj, ['keyword', 'theme', 'keywords', 'descript', 'place']);
    if (kwNode) scan(kwNode.value);
    return Array.from(new Set(list));
  }

  // Extract Title
  const titleMatch = findNode(parsed, ['title', 'resTitle', 'CitationTitle', 'datasetTitle']);
  const title = typeof titleMatch?.value === 'string' ? titleMatch.value : undefined;
  if (titleMatch) {
    rawEvidence.title = { value: title, path: titleMatch.path, isPlaceholder: isPlaceholderValue(title) };
  }

  // Extract Dataset ID
  const idMatch = findNode(parsed, ['fileIdentifier', 'id', 'datasetId', 'identCode', 'code']);
  const datasetId = typeof idMatch?.value === 'string' ? idMatch.value : typeof idMatch?.value === 'number' ? String(idMatch.value) : undefined;
  if (idMatch) {
    rawEvidence.datasetId = { value: datasetId, path: idMatch.path, isPlaceholder: isPlaceholderValue(datasetId) };
  }

  // Extract Abstract
  const abstractMatch = findNode(parsed, ['abstract', 'idAbs', 'descript', 'purpose']);
  const abstract = typeof abstractMatch?.value === 'string' ? abstractMatch.value : undefined;
  if (abstractMatch) {
    rawEvidence.abstract = { value: abstract, path: abstractMatch.path, isPlaceholder: isPlaceholderValue(abstract) };
  }

  // Extract Purpose
  const purposeMatch = findNode(parsed, ['purpose', 'idPurp']);
  const purpose = typeof purposeMatch?.value === 'string' ? purposeMatch.value : undefined;
  if (purposeMatch) {
    rawEvidence.purpose = { value: purpose, path: purposeMatch.path, isPlaceholder: isPlaceholderValue(purpose) };
  }

  // Extract Language
  const langMatch = findNode(parsed, ['LanguageCode', 'language', 'dataLang']);
  const language = typeof langMatch?.value === 'string' ? langMatch.value : undefined;
  if (langMatch) {
    rawEvidence.language = { value: language, path: langMatch.path, isPlaceholder: isPlaceholderValue(language) };
  }

  // Extract Extents (BBox)
  const westMatch = findNode(parsed, ['westBoundLongitude', 'westbc', 'westBL']);
  const eastMatch = findNode(parsed, ['eastBoundLongitude', 'eastbc', 'eastBL']);
  const southMatch = findNode(parsed, ['southBoundLatitude', 'southbc', 'southBL']);
  const northMatch = findNode(parsed, ['northBoundLatitude', 'northbc', 'northBL']);

  const west = westMatch ? parseFloat(westMatch.value) : undefined;
  const east = eastMatch ? parseFloat(eastMatch.value) : undefined;
  const south = southMatch ? parseFloat(southMatch.value) : undefined;
  const north = northMatch ? parseFloat(northMatch.value) : undefined;

  // Extract CRS / Datum
  const crsMatch = findNode(parsed, ['referenceSystemIdentifier', 'code', 'refSysCode', 'datum', 'horizpa', 'projection']);
  const crsVal = typeof crsMatch?.value === 'string' ? crsMatch.value : typeof crsMatch?.value === 'object' ? JSON.stringify(crsMatch.value) : undefined;
  if (crsMatch) {
    rawEvidence.crs = { value: crsVal, path: crsMatch.path, isPlaceholder: isPlaceholderValue(crsVal) };
  }

  // Extract Contact
  const orgMatch = findNode(parsed, ['organisationName', 'cntorg', 'rpOrgName', 'Originator', 'publisher']);
  const contactOrg = typeof orgMatch?.value === 'string' ? orgMatch.value : undefined;
  if (orgMatch) {
    rawEvidence.contactOrg = { value: contactOrg, path: orgMatch.path, isPlaceholder: isPlaceholderValue(contactOrg) };
  }

  const emailMatch = findNode(parsed, ['electronicMailAddress', 'cntemail', 'email']);
  const contactEmail = typeof emailMatch?.value === 'string' ? emailMatch.value : undefined;
  if (emailMatch) {
    rawEvidence.contactEmail = { value: contactEmail, path: emailMatch.path, isPlaceholder: isPlaceholderValue(contactEmail) };
  }

  const indNameMatch = findNode(parsed, ['individualName', 'cntper', 'rpIndName']);
  const contactName = typeof indNameMatch?.value === 'string' ? indNameMatch.value : undefined;

  const roleMatch = findNode(parsed, ['role', 'roleCode', 'RoleCode']);
  const contactRole = typeof roleMatch?.value === 'string' ? roleMatch.value : undefined;

  // Extract Dates
  const dateMatch = findNode(parsed, ['date', 'pubdate', 'createDate', 'revisionDate', 'dateStamp']);
  const pubDate = typeof dateMatch?.value === 'string' ? dateMatch.value : undefined;
  if (dateMatch) {
    rawEvidence.publicationDate = { value: pubDate, path: dateMatch.path, isPlaceholder: isPlaceholderValue(pubDate) };
  }

  // Extract Accuracy & Marine Specifics (TVU, THU, TPU, Datum)
  const tvuMatch = findNode(parsed, ['totalVerticalUncertainty', 'verticalAccuracy', 'vertacc', 'TVU', 'vUncert']);
  const thuMatch = findNode(parsed, ['totalHorizontalUncertainty', 'horizontalAccuracy', 'horizacc', 'THU', 'hUncert']);
  const tpuMatch = findNode(parsed, ['totalPropagatedUncertainty', 'TPU']);
  const vertDatumMatch = findNode(parsed, ['verticalDatum', 'vdatum', 'depthDatum', 'soundingDatum']);
  const sensorMatch = findNode(parsed, ['sensor', 'instrument', 'sounder', 'echosounder', 'multibeam', 'singlebeam', 'equipment']);

  if (tvuMatch) rawEvidence.tvu = { value: tvuMatch.value, path: tvuMatch.path, isPlaceholder: isPlaceholderValue(tvuMatch.value) };
  if (thuMatch) rawEvidence.thu = { value: thuMatch.value, path: thuMatch.path, isPlaceholder: isPlaceholderValue(thuMatch.value) };

  // Lineage / Processing
  const lineageMatch = findNode(parsed, ['statement', 'procdesc', 'processStep']);
  let lineage = typeof lineageMatch?.value === 'string' ? lineageMatch.value : undefined;
  if (!lineage) {
    const rawLineageNode = findNode(parsed, ['lineage']);
    if (rawLineageNode && typeof rawLineageNode.value === 'object') {
      const nestedStatement = findNode(rawLineageNode.value, ['statement', 'procdesc', 'CharacterString', '#text']);
      if (typeof nestedStatement?.value === 'string') {
        lineage = nestedStatement.value;
      }
    } else if (typeof rawLineageNode?.value === 'string') {
      lineage = rawLineageNode.value;
    }
  }
  if (lineage) {
    rawEvidence.lineage = { value: lineage, path: lineageMatch?.path || 'lineage', isPlaceholder: isPlaceholderValue(lineage) };
  }

  // Meta-metadata
  const standardNameMatch = findNode(parsed, ['metadataStandardName', 'metstdn']);
  const standardVersionMatch = findNode(parsed, ['metadataStandardVersion', 'metstdv']);
  const metaDateMatch = findNode(parsed, ['dateStamp', 'metd']);

  // -----------------------------------------------------------------
  // Elemen Ekstensi ISO 19115-3 (mdb:MD_Metadata) E27 - E32
  // -----------------------------------------------------------------
  // E27: mdb:spatialRepresentationInfo (topologyLevel, geometricObjectType, count)
  let e27TopologyLevel: string | undefined;
  let e27GeometricType: string | undefined;
  let e27Count: number | undefined;

  const topMatch = findNode(parsed, ['topologyLevel', 'MD_TopologyLevelCode', 'topologyLevelCode']) ||
    xmlString.match(/topologyLevel[^>]*>(?:<[^>]+>)*([a-zA-Z0-9_]+)/i) ||
    xmlString.match(/MD_TopologyLevelCode[^>]*codeListValue="([^"]+)"/i);
  if (topMatch) e27TopologyLevel = typeof topMatch === 'object' && 'value' in topMatch ? String(topMatch.value) : (Array.isArray(topMatch) ? topMatch[1] : undefined);

  const geomMatch = findNode(parsed, ['geometricObjectType', 'MD_GeometricObjectTypeCode', 'geometricObjectTypeCode']) ||
    xmlString.match(/geometricObjectType[^>]*>(?:<[^>]+>)*([a-zA-Z0-9_]+)/i) ||
    xmlString.match(/MD_GeometricObjectTypeCode[^>]*codeListValue="([^"]+)"/i);
  if (geomMatch) e27GeometricType = typeof geomMatch === 'object' && 'value' in geomMatch ? String(geomMatch.value) : (Array.isArray(geomMatch) ? geomMatch[1] : undefined);

  const countMatch = findNode(parsed, ['geometricObjectCount', 'count']) ||
    xmlString.match(/geometricObjectCount[^>]*>(?:<[^>]+>)*(\d+)/i) ||
    xmlString.match(/<count[^>]*>(\d+)<\/count>/i);
  if (countMatch) {
    const rawCount = typeof countMatch === 'object' && 'value' in countMatch ? Number(countMatch.value) : parseInt(countMatch[1], 10);
    if (!isNaN(rawCount)) e27Count = rawCount;
  }

  rawEvidence.e27_spatialRepresentation = {
    value: { topologyLevel: e27TopologyLevel, geometricObjectType: e27GeometricType, count: e27Count },
    path: 'mdb:spatialRepresentationInfo',
    isPlaceholder: false,
  };

  // E28: mdb:metadataScope/mcc:MD_Scope (MD_ScopeCode & name)
  let e28ScopeCode: string | undefined;
  let e28ScopeName: string | undefined;

  const scopeCodeMatch = findNode(parsed, ['resourceScope', 'MD_ScopeCode', 'scopeCode']) ||
    xmlString.match(/MD_ScopeCode[^>]*codeListValue="([^"]+)"/i) ||
    xmlString.match(/resourceScope[^>]*>(?:<[^>]+>)*([a-zA-Z0-9_]+)/i);
  if (scopeCodeMatch) e28ScopeCode = typeof scopeCodeMatch === 'object' && 'value' in scopeCodeMatch ? String(scopeCodeMatch.value) : (Array.isArray(scopeCodeMatch) ? scopeCodeMatch[1] : undefined);

  const scopeNameMatch = findNode(parsed, ['metadataScopeName', 'scopeName', 'name']) ||
    xmlString.match(/<(?:mcc:)?name[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
  if (scopeNameMatch) {
    const candidateName = typeof scopeNameMatch === 'object' && 'value' in scopeNameMatch ? String(scopeNameMatch.value) : (Array.isArray(scopeNameMatch) ? scopeNameMatch[1] : undefined);
    if (candidateName && candidateName !== e28ScopeCode && !candidateName.includes('<')) {
      e28ScopeName = candidateName;
    }
  }

  rawEvidence.e28_metadataScope = {
    value: { scopeCode: e28ScopeCode, name: e28ScopeName },
    path: 'mdb:metadataScope/mcc:MD_Scope',
    isPlaceholder: false,
  };

  // E29: mdb:portrayalCatalogueInfo
  let e29Citation: string | undefined;
  let e29IsSpecificDoc = false;
  const portrayalBlock = xmlString.match(/<(?:mdb:)?portrayalCatalogueInfo[\s\S]*?<\/(?:mdb:)?portrayalCatalogueInfo>/i)?.[0];
  const portrayalNode = findNode(parsed, ['portrayalCatalogueInfo', 'portrayalCatalogueCitation', 'MD_PortrayalCatalogueReference']);
  if (portrayalBlock || portrayalNode) {
    const pText = portrayalBlock || JSON.stringify(portrayalNode?.value || '');
    e29Citation = pText;
    if (/sni|iho|s-52|perka|peraturan|spesifikasi|pedoman|katalog\s*simbol/i.test(pText)) {
      e29IsSpecificDoc = true;
    }
  }

  rawEvidence.e29_portrayalCatalogue = {
    value: { citation: e29Citation, isSpecificDocument: e29IsSpecificDoc },
    path: 'mdb:portrayalCatalogueInfo',
    isPlaceholder: false,
  };

  // E30: mdb:applicationSchemaInfo (UML schema name & doc link)
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

  rawEvidence.e30_applicationSchema = {
    value: { schemaName: e30SchemaName, docLink: e30DocLink },
    path: 'mdb:applicationSchemaInfo',
    isPlaceholder: false,
  };

  // E31: mdb:contentInfo/mrc:MD_FeatureCatalogueDescription (KUGI compliance)
  let e31ComplianceCode: boolean | undefined;
  let e31CitesKugi = false;
  const contentBlock = xmlString.match(/<(?:mdb:)?contentInfo[\s\S]*?<\/(?:mdb:)?contentInfo>/i)?.[0] ||
    xmlString.match(/<(?:mrc:)?MD_FeatureCatalogueDescription[\s\S]*?<\/(?:mrc:)?MD_FeatureCatalogueDescription>/i)?.[0];
  if (contentBlock) {
    if (/katalog\s*unsur\s*geografi\s*indonesia|kugi/i.test(contentBlock) || /kugi/i.test(xmlString)) {
      e31CitesKugi = true;
    }
    const compM = contentBlock.match(/complianceCode[^>]*>(?:<[^>]+>)*(true|false|1|0)/i) ||
      contentBlock.match(/complianceCode="?(true|false|1|0)"?/i);
    if (compM) {
      e31ComplianceCode = compM[1].toLowerCase() === 'true' || compM[1] === '1';
    }
  }

  rawEvidence.e31_kugiCompliance = {
    value: { complianceCode: e31ComplianceCode, citesKugi: e31CitesKugi },
    path: 'mdb:contentInfo/mrc:MD_FeatureCatalogueDescription',
    isPlaceholder: false,
  };

  // E32: mdb:distributionInfo (WMS/WFS/CSW service link & operation desc)
  let e32ServiceUrl: string | undefined;
  let e32OperationDesc: string | undefined;
  const distBlock = xmlString.match(/<(?:mdb:)?distributionInfo[\s\S]*?<\/(?:mdb:)?distributionInfo>/i)?.[0] ||
    xmlString.match(/<(?:mrd:)?MD_Distribution[\s\S]*?<\/(?:mrd:)?MD_Distribution>/i)?.[0];
  if (distBlock) {
    const urlM = distBlock.match(/(https?:\/\/[^\s<"'>]+)/i);
    if (urlM) e32ServiceUrl = urlM[1];
    const descM = distBlock.match(/description[^>]*>(?:<[^>]+>)*([^<]+)<\//i);
    if (descM && descM[1].length > 3) e32OperationDesc = descM[1];
  }

  rawEvidence.e32_distributionService = {
    value: { serviceUrl: e32ServiceUrl, operationDescription: e32OperationDesc },
    path: 'mdb:distributionInfo',
    isPlaceholder: false,
  };

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
      datum: typeof vertDatumMatch?.value === 'string' ? vertDatumMatch.value : undefined,
    },
    temporalExtent: {
      publicationDate: pubDate,
    },
    contact: {
      organization: contactOrg,
      individualName: contactName,
      email: contactEmail,
      role: contactRole,
      isPlaceholder: isPlaceholderValue(contactOrg) || isPlaceholderValue(contactEmail),
    },
    accuracy: {
      totalVerticalUncertainty: tvuMatch?.value,
      totalHorizontalUncertainty: thuMatch?.value,
      totalPropagatedUncertainty: tpuMatch?.value,
      verticalDatum: typeof vertDatumMatch?.value === 'string' ? vertDatumMatch.value : undefined,
      sensorType: typeof sensorMatch?.value === 'string' ? sensorMatch.value : undefined,
      soundVelocityCorrected: xmlString.toLowerCase().includes('sound velocity') || xmlString.toLowerCase().includes('svp'),
      tideCorrected: xmlString.toLowerCase().includes('tide') || xmlString.toLowerCase().includes('pasang surut'),
    },
    processing: {
      lineageStatement: lineage,
      softwareUsed: findNode(parsed, ['software', 'processSoftware'])?.value,
    },
    metaMetadata: {
      standardName: typeof standardNameMatch?.value === 'string' ? standardNameMatch.value : isMdb ? 'ISO 19115-3 (mdb)' : isIso19139 ? 'ISO 19115/19139 (gmd)' : isEsri ? 'Esri Metadata' : undefined,
      standardVersion: typeof standardVersionMatch?.value === 'string' ? standardVersionMatch.value : isMdb ? '2018/2021' : undefined,
      metadataDate: typeof metaDateMatch?.value === 'string' ? metaDateMatch.value : undefined,
    },
    rawEvidence,
    parseWarnings: warnings,
    parseErrors: errors,
  };
}
