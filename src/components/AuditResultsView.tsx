/**
 * KOMPAS - Audit Results & Diagnostic Dashboard
 * Detailed parameter breakdown, evidence explorer, spatial diagnostics, and formal report export.
 */

import React, { useState } from 'react';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Filter,
  Eye,
  Layers,
  MapPin,
  FileText,
  Info,
  ExternalLink,
  ChevronDown,
  ShieldCheck,
  Compass,
  Globe2,
  ArrowRight,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { AuditReport, MQICategory, ParameterAuditResult } from '../types/audit';
import { MQI_CATEGORIES } from '../audit/methodology';
import { EvidenceModal } from './EvidenceModal';
import { OpenStreetMapViewer } from './OpenStreetMapViewer';
import { AuditComparisonBarChart } from './AuditComparisonBarChart';
import { resolveSpatialFromReport } from '../utils/spatialHelper';

interface AuditResultsViewProps {
  report: AuditReport;
  onBackToDashboard: () => void;
}

export const AuditResultsView: React.FC<AuditResultsViewProps> = ({
  report,
  onBackToDashboard,
}) => {
  const [selectedResult, setSelectedResult] = useState<ParameterAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<'parameters' | 'extensions' | 'iso19115' | 'categories' | 'map' | 'spatial' | 'consistency'>('parameters');
  const [methodologyView, setMethodologyView] = useState<'adapted' | 'original'>('adapted');
  const spatialData = resolveSpatialFromReport(report);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedImportance, setSelectedImportance] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [onlyIso19115, setOnlyIso19115] = useState<boolean>(false);

  const { scoreReport, parameterResults, consistencyResult, spatialFindings, normalizedSpatialData, iso19115Compliance } = report;

  const handleSelectCategoryFromChart = (category: MQICategory) => {
    setSelectedCategory(category);
    setActiveTab('parameters');
    setTimeout(() => {
      const el = document.getElementById('parameters-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 60);
  };

  // Filter results
  const filteredResults = parameterResults.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        r.ruleId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.iso19115Tag && r.iso19115Tag.toLowerCase().includes(q)) ||
        (r.findingMessage && r.findingMessage.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    if (selectedImportance !== 'all' && r.importance !== selectedImportance) return false;
    if (selectedSource !== 'all' && r.source !== selectedSource) return false;
    if (onlyIso19115 && !r.isIso19115Core) return false;
    return true;
  });

  const activeScore = methodologyView === 'adapted' ? scoreReport.adaptedScore : scoreReport.originalScore;
  const coreScoreDisplay = report.coreScoreMqi !== undefined ? report.coreScoreMqi : activeScore;
  const readiness = report.iso19115_3Readiness;

  // CSV Export handler
  const handleExportCsv = () => {
    const headers = [
      'ID Parameter',
      'Nama Parameter',
      'Kategori',
      'Tingkat Kepentingan',
      'Bobot',
      'Status',
      'Tag ISO 19115',
      'Elemen Inti ISO',
      'Sumber Aturan',
      'Format Diharapkan',
      'Nilai Ditemukan',
      'Temuan',
      'Rekomendasi',
    ];
    const rows = parameterResults.map(r => [
      `"${r.ruleId}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${MQI_CATEGORIES[r.category]?.name || r.category}"`,
      `"${r.importance}"`,
      r.weight,
      `"${r.status}"`,
      `"${r.iso19115Tag || ''}"`,
      r.isIso19115Core ? '"Ya (ISO 19115 Core)"' : '"Tidak"',
      `"${r.source}"`,
      `"${(r.expectedFormat || '').replace(/"/g, '""')}"`,
      `"${String(r.valueFound || '').replace(/"/g, '""')}"`,
      `"${(r.findingMessage || '').replace(/"/g, '""')}"`,
      `"${(r.recommendation || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KOMPAS_Audit_${report.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Export handler
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `KOMPAS_Report_${report.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Formal Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      {/* Detail Modal */}
      {selectedResult && (
        <EvidenceModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span>AUDIT ID: {report.id}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{report.profileId.replace('_', ' ')}</span>
            <span aria-hidden="true">·</span>
            <span>{new Date(report.timestamp).toLocaleString('id-ID')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {report.datasetName}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ekspor JSON</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Score Hero Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8">
        {/* Dua Angka Skor Utama: Skor Inti MQI & Skor Kesiapan ISO 19115-3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-800">
          {/* KARTU 1: SKOR INTI MQI (26 Elemen E01–E26) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5 shadow-sm">
            {/* Circular Gauge for Skor Inti MQI */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={
                    coreScoreDisplay !== null
                      ? 2 * Math.PI * 46 * (1 - coreScoreDisplay / 100)
                      : 2 * Math.PI * 46
                  }
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    coreScoreDisplay === null
                      ? 'text-slate-600'
                      : coreScoreDisplay >= 85
                      ? 'text-emerald-400'
                      : coreScoreDisplay >= 70
                      ? 'text-cyan-400'
                      : coreScoreDisplay >= 55
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold font-mono text-white tabular-nums">
                  {coreScoreDisplay !== null ? `${coreScoreDisplay}%` : 'N/A'}
                </span>
                <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400">
                  Skor Inti
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 font-semibold">
                  List 1 (E01–E26)
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  scoreReport.complianceTier === 'Excellent'
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                    : scoreReport.complianceTier === 'Good'
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                    : scoreReport.complianceTier === 'Fair'
                    ? 'border-amber-500/50 bg-amber-950/40 text-amber-300'
                    : 'border-rose-500/50 bg-rose-950/40 text-rose-300'
                }`}>
                  Tingkat: {scoreReport.complianceTier}
                </span>
                {scoreReport.isProvisional && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-500/60 bg-amber-950/40 text-amber-300">
                    Sementara
                  </span>
                )}
              </div>

              <h2 className="text-base font-bold text-white tracking-tight">
                Skor Inti MQI
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dinilai dari 26 elemen inti metadata geospasial kelautan (E01–E26).
              </p>

              {/* Methodology Switcher */}
              <div className="pt-1">
                <div className="inline-flex p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    onClick={() => setMethodologyView('adapted')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      methodologyView === 'adapted'
                        ? 'bg-slate-800 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Adaptasi KOMPAS
                  </button>
                  <button
                    onClick={() => setMethodologyView('original')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      methodologyView === 'original'
                        ? 'bg-slate-800 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    MQI Asli Hasara
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* KARTU 2: SKOR KESIAPAN ISO 19115-3 (6 Elemen Ekstensi E27–E32) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5 shadow-sm">
            {/* Circular Gauge or N/A */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={
                    readiness?.isApplicable && readiness.scorePercentage !== null
                      ? 2 * Math.PI * 46 * (1 - readiness.scorePercentage / 100)
                      : 2 * Math.PI * 46
                  }
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    !readiness?.isApplicable
                      ? 'text-slate-700'
                      : readiness.scorePercentage !== null && readiness.scorePercentage >= 80
                      ? 'text-emerald-400'
                      : readiness.scorePercentage !== null && readiness.scorePercentage >= 50
                      ? 'text-cyan-400'
                      : 'text-amber-400'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className={`text-2xl font-extrabold font-mono tabular-nums ${
                  readiness?.isApplicable ? 'text-white' : 'text-slate-400'
                }`}>
                  {readiness?.isApplicable && readiness.scorePercentage !== null
                    ? `${readiness.scorePercentage}%`
                    : 'N/A'}
                </span>
                <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400">
                  {readiness?.isApplicable ? 'Kesiapan mdb' : 'Format gmd'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 font-semibold">
                  List 2 (E27–E32)
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  readiness?.isApplicable
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}>
                  {readiness?.isApplicable ? 'Root: <mdb:MD_Metadata>' : 'Root: <gmd:MD_Metadata>'}
                </span>
              </div>

              <h2 className="text-base font-bold text-white tracking-tight">
                Skor Kesiapan ISO 19115-3
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {readiness?.isApplicable
                  ? `${readiness.totalPointsEarned} dari 6 poin terpenuhi. ${readiness.statusLabel}.`
                  : 'N/A — Elemen ekstensi E27–E32 hanya dihitung jika berkas berakar <mdb:MD_Metadata>.'}
              </p>

              <div className="pt-1">
                <button
                  onClick={() => setActiveTab('extensions')}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                >
                  <span>Lihat Rincian 6 Elemen Ekstensi</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Formula Transparency & Status Counts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-6">
          <div className="lg:col-span-6 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 font-mono text-xs">
            <div className="text-slate-400 mb-1 flex items-center justify-between">
              <span>Dekomposisi Penghitungan Rumus MQI:</span>
              <span className="text-cyan-400">MQI = (Σ pᵢwᵢ / Σ wᵢ) × 100</span>
            </div>
            <div className="text-slate-200 flex items-center gap-3 pt-1">
              <span>Pembilang (Σ pᵢwᵢ): <strong className="text-white tabular-nums">{scoreReport.numerator}</strong></span>
              <span aria-hidden="true">/</span>
              <span>Penyebut (Σ wᵢ): <strong className="text-white tabular-nums">{scoreReport.denominator}</strong></span>
              <span aria-hidden="true">=</span>
              <span className="text-cyan-300 font-bold tabular-nums">
                {scoreReport.denominator > 0
                  ? ((scoreReport.numerator / scoreReport.denominator) * 100).toFixed(2)
                  : 0}%
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              *Catatan metodologis: Parameter berstatus "Tidak Berlaku" telah dikeluarkan secara transparan dari penyebut.
            </div>
          </div>

          <div className="lg:col-span-6">
            {/* Status Counts Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-emerald-900/40">
                <div className="font-bold font-mono text-emerald-400 text-lg tabular-nums">
                  {scoreReport.statusCounts.terpenuhi}
                </div>
                <div className="text-[11px] text-slate-400">Terpenuhi</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-amber-900/40">
                <div className="font-bold font-mono text-amber-400 text-lg tabular-nums">
                  {scoreReport.statusCounts.tidak_terpenuhi}
                </div>
                <div className="text-[11px] text-slate-400">Tidak Ada</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-rose-900/40">
                <div className="font-bold font-mono text-rose-400 text-lg tabular-nums">
                  {scoreReport.statusCounts.tidak_valid}
                </div>
                <div className="text-[11px] text-slate-400">Tidak Valid</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <div className="font-bold font-mono text-slate-400 text-lg tabular-nums">
                  {scoreReport.statusCounts.tidak_berlaku}
                </div>
                <div className="text-[11px] text-slate-400">Tidak Berlaku</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-sky-900/40 col-span-2 sm:col-span-1">
                <div className="font-bold font-mono text-sky-400 text-lg tabular-nums">
                  {scoreReport.statusCounts.perlu_ditinjau}
                </div>
                <div className="text-[11px] text-slate-400">Perlu Review</div>
              </div>
            </div>
          </div>
        </div>

        {/* Provisional Score Warning Accordion if active */}
        {scoreReport.isProvisional && scoreReport.provisionalReasons.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4 text-xs text-slate-300">
              <div className="font-semibold text-amber-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Penyebab Skor Ditetapkan Sebagai Skor Sementara:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono">
                {scoreReport.provisionalReasons.map((reason, idx) => (
                  <li key={idx} className="leading-relaxed">{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Comparative Bar Chart Section (Diagram Batang Perbandingan Kualitas Metadata) */}
      <AuditComparisonBarChart
        report={report}
        onSelectCategory={handleSelectCategoryFromChart}
      />

      {/* ISO 19115 Core Metadata Compliance Banner Card */}
      {iso19115Compliance && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 lg:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  iso19115Compliance.isCompliant
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800 shadow-md shadow-emerald-950/50'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-800 shadow-md shadow-amber-950/50'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide">
                    Evaluasi Standar ISO 19115 & SNI ISO 19115
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    {iso19115Compliance.standardReference}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-0.5">
                  Kesesuaian Elemen Inti Metadata (Core Metadata Conformance)
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  iso19115Compliance.isCompliant
                    ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-500/80 text-amber-300'
                }`}
              >
                {iso19115Compliance.statusLabel}
              </span>
              <button
                onClick={() => setActiveTab('iso19115')}
                className="px-2.5 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/80 border border-cyan-800/80 rounded-lg transition-colors"
              >
                Lihat Detail Inti →
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {iso19115Compliance.summaryNotes} Menguji 13 elemen inti standar (Table 3 ISO 19115 / Annex F ISO 19115-1:2014 & SNI ISO 19115:2012) yang diwajibkan untuk interoperabilitas katalog spasial kelautan nasional (JIGN BIG) dan internasional (IHO MSDI).
          </p>

          {/* Quick status chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 pt-1">
            {iso19115Compliance.elements.map((el) => {
              const isOk = el.status === 'terpenuhi';
              return (
                <div
                  key={el.code}
                  onClick={() => {
                    if (el.ruleId) {
                      const matched = parameterResults.find(p => p.ruleId === el.ruleId);
                      if (matched) setSelectedResult(matched);
                    }
                  }}
                  className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                    isOk
                      ? 'bg-slate-950/70 border-emerald-900/50 hover:border-emerald-700/80'
                      : 'bg-slate-950/70 border-rose-900/50 hover:border-rose-700/80'
                  }`}
                  title={`${el.nameId} (${el.isoTag}) - Klik untuk lihat bukti`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] text-slate-400 truncate">
                      {el.code}
                    </span>
                    {isOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <div className="font-medium text-slate-200 text-[11px] leading-tight line-clamp-2">
                    {el.nameId}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 truncate">
                    {el.isMandatory ? 'Wajib (M)' : 'Kondisional (C)'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Peraturan BIG No. 3 Tahun 2023 Mandatory Standards Compliance Banner Card */}
      {report.bigNo3Compliance && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 lg:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  report.bigNo3Compliance.isCompliant
                    ? 'bg-blue-950/80 text-blue-400 border border-blue-800 shadow-md'
                    : report.bigNo3Compliance.isWithinTransitionPeriod
                    ? 'bg-amber-950/80 text-amber-400 border border-amber-800 shadow-md'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800 shadow-md'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wide">
                    PEDOMAN REGULASI WAJIB: PERATURAN BIG NO. 3 TAHUN 2023
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    {report.bigNo3Compliance.standardCategory}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-0.5">
                  Pemberlakuan Standar Nasional Indonesia (SNI) Metadata Geospasial Secara Wajib
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  report.bigNo3Compliance.isCompliant
                    ? 'bg-blue-950/60 border-blue-500/80 text-blue-300'
                    : report.bigNo3Compliance.isWithinTransitionPeriod
                    ? 'bg-amber-950/60 border-amber-500/80 text-amber-300'
                    : 'bg-rose-950/60 border-rose-500/80 text-rose-300'
                }`}
              >
                {report.bigNo3Compliance.statusLabel}
              </span>
              <a
                href="/assets/aistudio/Dokumen_Peraturan_Badan_Informasi_Geospasial_Nomor_3_Tahun_2023_b5e2e413.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/80 border border-cyan-800/80 rounded-lg transition-colors inline-flex items-center gap-1"
              >
                <span>Dokumen PDF BIG</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {report.bigNo3Compliance.notes} Sesuai Pasal 3 ayat (1), penyelenggara IG wajib memberitahukan kualitas DG dan IG dalam bentuk metadata. Pasal 6 menetapkan masa transisi 2 tahun (hingga {report.bigNo3Compliance.transitionDeadline}) bagi dokumen berbasis SNI ISO 19115:2012 / SNI ISO/TS 19139:2012 untuk disesuaikan ke skema XML SNI ISO 19115-3:2021.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {report.bigNo3Compliance.mandatoryRulesChecked.map((chk) => (
              <div
                key={chk.code}
                className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-[10px] text-cyan-400 font-semibold">{chk.legalBasis}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        chk.status === 'terpenuhi'
                          ? 'border-emerald-800 bg-emerald-950 text-emerald-300'
                          : 'border-rose-800 bg-rose-950 text-rose-300'
                      }`}
                    >
                      {chk.status === 'terpenuhi' ? 'Lolos' : 'Tidak Terpenuhi'}
                    </span>
                  </div>
                  <div className="font-semibold text-white text-xs">{chk.title}</div>
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">{chk.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs (Parameters E01-E26, Extensions E27-E32, ISO 19115, 8 Categories, Spatial Diagnostics, Consistency) */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('parameters')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'parameters'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Elemen Inti E01–E26 ({report.coreElementsResults?.length || 26})
        </button>
        <button
          onClick={() => setActiveTab('extensions')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'extensions'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Ekstensi ISO 19115-3 (E27–E32)</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              readiness?.isApplicable
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {readiness?.isApplicable && readiness.scorePercentage !== null
              ? `${readiness.scorePercentage}%`
              : 'N/A'}
          </span>
        </button>
        {iso19115Compliance && (
          <button
            onClick={() => setActiveTab('iso19115')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'iso19115'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Kepatuhan ISO 19115 ({iso19115Compliance.passedCount}/{iso19115Compliance.totalCoreCount})</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'categories'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Diagram & 8 Kategori MQI</span>
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'map'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Peta OpenStreetMap</span>
          {spatialData.hasAdequateSpatial ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Koordinat terverifikasi tersedia" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" title="Informasi spasial tidak memadai" />
          )}
        </button>
        {normalizedSpatialData && (
          <button
            onClick={() => setActiveTab('spatial')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'spatial'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Geospasial Lapangan
          </button>
        )}
        {consistencyResult && (
          <button
            onClick={() => setActiveTab('consistency')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'consistency'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Konsistensi Pasangan Data ({consistencyResult.overallConsistencyScore}%)
          </button>
        )}
      </div>

      {/* TAB 1: PARAMETER AUDIT FINDINGS TABLE */}
      {activeTab === 'parameters' && (
        <div id="parameters-section" className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari parameter, ID, atau kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Semua Kategori (8)</option>
                {Object.keys(MQI_CATEGORIES).map((catKey) => (
                  <option key={catKey} value={catKey}>
                    {MQI_CATEGORIES[catKey as MQICategory].name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Semua Status</option>
                <option value="terpenuhi">Terpenuhi</option>
                <option value="tidak_terpenuhi">Tidak Terpenuhi</option>
                <option value="tidak_valid">Tidak Valid</option>
                <option value="tidak_berlaku">Tidak Berlaku</option>
                <option value="perlu_ditinjau">Perlu Ditinjau</option>
              </select>

              {/* Importance Filter */}
              <select
                value={selectedImportance}
                onChange={(e) => setSelectedImportance(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Semua Bobot</option>
                <option value="critical">Critical (3)</option>
                <option value="important">Important (2)</option>
                <option value="supplementary">Supplementary (1)</option>
              </select>

              {/* ISO 19115 Toggle Filter */}
              <button
                type="button"
                onClick={() => setOnlyIso19115(!onlyIso19115)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                  onlyIso19115
                    ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Hanya Elemen Inti ISO 19115</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Nama Parameter / Tag ISO 19115</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Bobot</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Nilai Terdeteksi</th>
                    <th className="py-3 px-4 text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        Tidak ada parameter yang sesuai kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((result) => {
                      return (
                        <tr
                          key={result.ruleId}
                          onClick={() => setSelectedResult(result)}
                          className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {result.elementId && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-semibold">
                                  {result.elementId}
                                </span>
                              )}
                              <span className="text-cyan-400 font-semibold">{result.ruleId}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-white max-w-sm">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{result.name}</span>
                              {result.isIso19115Core && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 shrink-0">
                                  ISO Core
                                </span>
                              )}
                            </div>
                            {result.iso19115Tag && (
                              <div className="text-[10px] font-mono text-cyan-400/90 truncate mt-0.5">
                                {result.iso19115Tag}
                              </div>
                            )}
                            {result.findingMessage && (
                              <div className="text-[11px] text-rose-300/80 truncate mt-0.5">
                                {result.findingMessage}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                            {MQI_CATEGORIES[result.category]?.nameEn || result.category}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono whitespace-nowrap">
                            <span className="capitalize text-slate-300">
                              {result.importance} ({result.weight})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {result.status === 'terpenuhi' && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Terpenuhi</span>
                              </span>
                            )}
                            {result.status === 'tidak_terpenuhi' && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Tidak Ada</span>
                              </span>
                            )}
                            {result.status === 'tidak_valid' && (
                              <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Tidak Valid</span>
                              </span>
                            )}
                            {result.status === 'tidak_berlaku' && (
                              <span className="text-xs text-slate-500">Tidak Berlaku</span>
                            )}
                            {result.status === 'perlu_ditinjau' && (
                              <span className="inline-flex items-center gap-1 text-xs text-sky-400 font-medium">
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Perlu Review</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-400 max-w-xs truncate">
                            {result.valueFound !== null && result.valueFound !== undefined
                              ? String(result.valueFound)
                              : '<kosong>'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedResult(result);
                              }}
                              className="text-xs text-cyan-400 group-hover:text-cyan-300 font-medium inline-flex items-center gap-1"
                            >
                              <span>Lihat Bukti</span>
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ELEMEN EKSTENSI ISO 19115-3 (E27–E32) */}
      {activeTab === 'extensions' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wide flex-wrap">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>B. Elemen Ekstensi (E27–E32) — Hanya untuk Format mdb</span>
                  <span aria-hidden="true">·</span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 font-semibold">
                    SNI ISO 19115-3:2021
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  Kesiapan Skema Mutakhir ISO 19115-3 (List 2 Ekstensi)
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed mt-1 max-w-3xl">
                  Elemen-elemen ini ditambahkan karena format ISO 19115-3 (<code className="text-cyan-300">mdb</code>) memiliki struktur yang lebih kaya dibandingkan format lama (<code className="text-slate-400">gmd</code>). Sesuai aturan evaluasi: jika dokumen berakar <code className="text-cyan-300">&lt;mdb:MD_Metadata&gt;</code>, elemen dinilai aktif. Jika berakar <code className="text-amber-300">&lt;gmd:MD_Metadata&gt;</code>, status seluruh elemen ekstensi adalah <strong>N/A</strong>.
                </p>
              </div>

              {/* Status & Score Pill */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <div className="text-left sm:text-right">
                  <div className="text-xs font-mono text-slate-400">Skor Kesiapan ISO 19115-3</div>
                  <div className="text-2xl font-extrabold font-mono text-white tabular-nums">
                    {readiness?.isApplicable && readiness.scorePercentage !== null
                      ? `${readiness.scorePercentage}%`
                      : 'N/A'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded border ${
                      readiness?.isApplicable
                        ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {readiness?.statusLabel || 'N/A'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                    {readiness?.isApplicable ? `${readiness.totalPointsEarned} / 6 Poin` : 'Root: gmd (N/A)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Informative Banner when NOT mdb */}
            {!readiness?.isApplicable && (
              <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-300">
                    Format Dokumen: &lt;gmd:MD_Metadata&gt; (ISO 19139 Legacy)
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    Berdasarkan instruksi metodologis, elemen E27–E32 berstatus <strong>N/A</strong> karena skema XML dokumen ini masih menggunakan namespace lama (<code className="text-amber-200">gmd</code>). Untuk mendapatkan skor pada elemen ekstensi ini, berkas metadata harus dikonversi ke skema modern <code className="text-cyan-300">&lt;mdb:MD_Metadata&gt;</code> (ISO 19115-3:2021).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 6 Elements Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(readiness?.elements || []).map((el) => {
              const isFull = el.scoreValue === 1;
              const isHalf = el.scoreValue === 0.5;
              const isZero = el.scoreValue === 0 && el.isApplicable;
              const isNA = !el.isApplicable;

              return (
                <div
                  key={el.elementId}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Top Row: ID, Category & Score */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-xs font-mono font-bold">
                          {el.elementId}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {el.categoryName}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${
                          isNA
                            ? 'bg-slate-950 border-slate-800 text-slate-400'
                            : isFull
                            ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                            : isHalf
                            ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                            : 'bg-rose-950/80 border-rose-800 text-rose-300'
                        }`}
                      >
                        {isNA ? 'N/A (Bukan mdb)' : `${el.scoreValue.toFixed(1)} / 1.0 Poin`}
                      </span>
                    </div>

                    {/* Element Name */}
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {el.name}
                    </h3>

                    {/* MDB Path */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500 font-mono text-[11px]">Jalur mdb:</span>
                      <code className="text-cyan-300 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {el.mdbPath}
                      </code>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {el.description}
                    </p>

                    {/* Rule Condition Summary */}
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 text-[11px] font-mono text-slate-300 space-y-1">
                      <div className="text-cyan-400 font-semibold flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        <span>Aturan Penilaian:</span>
                      </div>
                      <div className="text-slate-400 leading-relaxed">
                        {el.ruleConditionSummary}
                      </div>
                    </div>
                  </div>

                  {/* Evidence & Findings Footer */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-500 shrink-0 font-mono text-[11px]">Nilai:</span>
                      <span className="text-slate-200 font-mono text-[11px] break-all">
                        {el.valueFoundText}
                      </span>
                    </div>

                    {el.findingMessage && (
                      <div className="text-[11px] text-amber-300/90 leading-relaxed">
                        {el.findingMessage}
                      </div>
                    )}

                    {el.recommendation && (
                      <div className="text-[11px] text-cyan-400/80 leading-relaxed">
                        <strong className="text-cyan-300">Rekomendasi:</strong> {el.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: ISO 19115 CORE METADATA COMPLIANCE VIEW */}
      {activeTab === 'iso19115' && iso19115Compliance && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Kepatuhan Standar Formal Metadata</span>
                  <span aria-hidden="true">·</span>
                  <span>{iso19115Compliance.standardReference}</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  13 Elemen Metadata Inti ISO 19115 (Core Metadata Conformance)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-white tabular-nums">
                    {iso19115Compliance.coreScore}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {iso19115Compliance.passedCount} / {iso19115Compliance.totalCoreCount} Elemen Terpenuhi
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Sesuai standar ISO 19115-1:2014 Annex F dan SNI ISO 19115:2012 BSN/BIG, himpunan elemen inti (*core metadata elements*) dirancang agar dataset geospasial dapat ditemukan secara universal (*Universal Discovery*) dalam geoportal nasional (JIGN) dan pertukaran internasional.
            </p>
          </div>

          {/* Core Elements Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                  <tr>
                    <th className="py-3 px-4">Kode</th>
                    <th className="py-3 px-4">Elemen Inti ISO 19115</th>
                    <th className="py-3 px-4">UML Path & XPath XML</th>
                    <th className="py-3 px-4">Kewajiban</th>
                    <th className="py-3 px-4">Status Audit</th>
                    <th className="py-3 px-4">Nilai Terdeteksi</th>
                    <th className="py-3 px-4 text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {iso19115Compliance.elements.map((el) => {
                    const matched = el.ruleId ? parameterResults.find(p => p.ruleId === el.ruleId) : null;
                    return (
                      <tr
                        key={el.code}
                        onClick={() => {
                          if (matched) setSelectedResult(matched);
                        }}
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-mono text-xs text-cyan-400 font-bold whitespace-nowrap">
                          {el.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-white">{el.nameId}</div>
                          <div className="text-xs text-slate-400">{el.name}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono">
                          <div className="text-cyan-300 truncate max-w-xs">{el.isoTag}</div>
                          <div className="text-slate-500 text-[10px] truncate max-w-xs">{el.xmlPath}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            el.isMandatory
                              ? 'bg-rose-950/40 text-rose-300 border-rose-900/60 font-semibold'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}>
                            {el.isMandatory ? 'Wajib (M)' : 'Kondisional (C)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {el.status === 'terpenuhi' && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Terpenuhi</span>
                            </span>
                          )}
                          {el.status === 'tidak_terpenuhi' && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Tidak Ada</span>
                            </span>
                          )}
                          {el.status === 'tidak_valid' && (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tidak Valid</span>
                            </span>
                          )}
                          {el.status === 'belum_diperiksa' && (
                            <span className="text-xs text-slate-500">Belum Diperiksa</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-300 max-w-xs truncate">
                          {el.valueFound !== null && el.valueFound !== undefined
                            ? String(el.valueFound)
                            : '<kosong>'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {matched && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedResult(matched);
                              }}
                              className="text-xs text-cyan-400 group-hover:text-cyan-300 font-medium inline-flex items-center gap-1"
                            >
                              <span>Lihat Bukti</span>
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Standards & Guidelines Info Box */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
            <div className="font-semibold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Keterkaitan Antara Standar ISO 19115 dan Indeks Mutu MQI Hasara (2026)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Jurnal penelitian Hasara & Karunanayaka (2026) mengadopsi struktur skema ISO 19115 sebagai fondasi pembagian 8 kategori metadata. Evaluasi ISO 19115 di atas menguji kepatuhan terhadap elemen wajib minimal agar dataset legal dan terstandarisasi, sedangkan skor kuantitatif MQI (0–100) mengukur kedalaman kualitas akurasi, silsilah data, dan parameter teknis sensor untuk kelayakan pemanfaatan ulang (*fitness-for-purpose*).
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: 8 CATEGORIES & COMPARATIVE CHARTS */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <AuditComparisonBarChart
            report={report}
            onSelectCategory={handleSelectCategoryFromChart}
          />

          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Rincian Matriks 8 Kategori Metadata MQI</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Klik kartu kategori untuk menyaring parameter
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scoreReport.categorySummaries.map((cat) => {
                const catMeta = MQI_CATEGORIES[cat.category];
                return (
                  <div
                    key={cat.category}
                    onClick={() => handleSelectCategoryFromChart(cat.category)}
                    className="bg-slate-900 border border-slate-800 hover:border-cyan-500/60 rounded-xl p-5 space-y-3 cursor-pointer transition-all hover:bg-slate-900/90 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        <h4 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                          {cat.categoryName}
                        </h4>
                      </div>
                      <span className="text-sm font-bold font-mono text-cyan-400 tabular-nums">
                        {cat.percentage}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {catMeta?.description}
                    </p>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-700 ${
                          cat.percentage >= 80
                            ? 'bg-emerald-400'
                            : cat.percentage >= 50
                            ? 'bg-cyan-400'
                            : cat.percentage >= 25
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-1">
                      <span>Parameter: {cat.fulfilledParameters} / {cat.applicableParameters} terpenuhi</span>
                      <span>Bobot: {cat.scoreEarned} / {cat.scoreMaxPossible}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: OPENSTREETMAP INTERACTIVE SPATIAL VIEWER */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          <OpenStreetMapViewer
            spatialData={spatialData}
            datasetTitle={report.datasetName}
            heightClass="h-[520px]"
          />

          {spatialData.hasAdequateSpatial && spatialData.bounds && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>Sistem Referensi Koordinat (CRS)</span>
                </div>
                <div className="font-mono text-white text-sm">
                  {spatialData.crsName || 'WGS 84 (EPSG:4326)'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Standar koordinat baku SNI ISO 19115 dan MSDI untuk integrasi data geospasial maritim.
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Sumber Geometri Terverifikasi</span>
                </div>
                <div className="font-mono text-emerald-300 text-sm">
                  {spatialData.sourceType === 'spatial_vector'
                    ? 'Lapisan Vektor Spasial (.geojson / .shp)'
                    : 'Bounding Box Dokumen XML / JSON'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Koordinat diverifikasi langsung dari berkas sumber tanpa rekayasa titik.
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Uji Validitas Batas Wilayah</span>
                </div>
                <div className="font-mono text-cyan-300 text-sm">
                  Lolos Uji Konsistensi Spasial
                </div>
                <div className="text-[11px] text-slate-500">
                  Rentang: {Math.abs(spatialData.bounds[2] - spatialData.bounds[0]).toFixed(3)}° Bujur x {Math.abs(spatialData.bounds[3] - spatialData.bounds[1]).toFixed(3)}° Lintang.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SPATIAL DIAGNOSTICS */}
      {activeTab === 'spatial' && normalizedSpatialData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>Ringkasan Vektor Spasial</span>
              </h3>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800 font-mono">
                  <span className="text-slate-400">Format Data:</span>
                  <span className="text-white uppercase">{normalizedSpatialData.format}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 font-mono">
                  <span className="text-slate-400">Jumlah Fitur:</span>
                  <span className="text-white tabular-nums">{normalizedSpatialData.featureCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 font-mono">
                  <span className="text-slate-400">Tipe Geometri:</span>
                  <span className="text-cyan-300">{normalizedSpatialData.geometryTypes.join(', ') || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 font-mono">
                  <span className="text-slate-400">CRS / Proyeksi:</span>
                  <span className="text-white truncate max-w-[180px]">{normalizedSpatialData.crs.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 font-mono">
                  <span className="text-slate-400">Geometri Kosong:</span>
                  <span className={normalizedSpatialData.emptyGeometryCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    {normalizedSpatialData.emptyGeometryCount}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 font-mono">
                  <span className="text-slate-400">Cincin Poligon Rusak:</span>
                  <span className={normalizedSpatialData.ringClosureErrorsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    {normalizedSpatialData.ringClosureErrorsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Bounding Box Visualizer Canvas */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
                Visualisasi Batas Spasial (Bounding Box)
              </h3>
              <div className="relative bg-slate-950 rounded-lg border border-slate-800 p-4 h-56 flex items-center justify-center overflow-hidden">
                {/* SVG Coordinate Grid Background */}
                <svg className="w-full h-full text-slate-800" stroke="currentColor" fill="none">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Bounding box representation box */}
                <div className="absolute inset-8 border-2 border-cyan-400/80 bg-cyan-950/30 rounded flex flex-col items-center justify-center p-3 text-center">
                  <div className="text-[11px] font-mono text-cyan-300 font-bold mb-1">
                    Cakupan Spasial Terverifikasi
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                    <div>Utara (North): {normalizedSpatialData.bounds[3].toFixed(4)}°</div>
                    <div>Barat: {normalizedSpatialData.bounds[0].toFixed(4)}° · Timur: {normalizedSpatialData.bounds[2].toFixed(4)}°</div>
                    <div>Selatan (South): {normalizedSpatialData.bounds[1].toFixed(4)}°</div>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-3">
                *Catatan: Validasi batas memastikan koordinat berada dalam batas maritim valid dan bukan koordinat fiktif (0,0).
              </div>
            </div>
          </div>

          {/* Spatial Findings & Attribute inventory */}
          {spatialFindings && spatialFindings.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Temuan Validasi Spasial Khusus
              </h3>
              <div className="space-y-2">
                {spatialFindings.map((f, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-rose-300">{f.title}</div>
                    <div className="text-slate-300">{f.description}</div>
                    <div className="text-cyan-400 text-[11px]">Saran: {f.remediation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CROSS-FILE CONSISTENCY AUDIT */}
      {activeTab === 'consistency' && consistencyResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">
                Hasil Audit Konsistensi Antar-Berkas (Metadata vs Data Spasial)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Memeriksa apakah berkas metadata benar-benar mencerminkan karakteristik fisik dan geografis dari dataset spasial pendamping.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
                {consistencyResult.overallConsistencyScore}%
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-mono">Skor Konsistensi</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-semibold">1. Kesesuaian Judul & Identitas</div>
              <div className="text-sm text-slate-200">{consistencyResult.titleMatch.details}</div>
            </div>
            <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-semibold">2. Kesesuaian Sistem Koordinat (CRS)</div>
              <div className="text-sm text-slate-200">{consistencyResult.crsMatch.details}</div>
            </div>
            <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-semibold">3. Kesesuaian Cakupan Geografis (BBox Overlap)</div>
              <div className="text-sm text-slate-200">{consistencyResult.bboxMatch.details}</div>
            </div>
            <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-semibold">4. Kesesuaian Tipe Geometri & Struktur</div>
              <div className="text-sm text-slate-200">{consistencyResult.geometryTypeMatch.details}</div>
            </div>
          </div>

          {consistencyResult.discrepancies.length > 0 && (
            <div className="p-4 bg-rose-950/30 border border-rose-800/60 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-rose-300 uppercase tracking-wide">
                Indikasi Diskrepansi / Ketidakcocokan Pasangan:
              </div>
              <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                {consistencyResult.discrepancies.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
