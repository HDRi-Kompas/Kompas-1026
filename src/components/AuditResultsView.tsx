/**
 * KOMPAS - Audit Results & Diagnostic Dashboard (Excel v4 Aligned)
 * Displays Skor A, MQI Biner, MQI Diperluas, MQI Ketat, 26 Core Elements E01-E26,
 * Manual Review Panel, Empty Elements sorted by weight impact, Quality Flags F01-F14,
 * Extensions E27-E32, Benchmark Explorer, and comprehensive CSV & JSON exports.
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
  Edit3,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { AuditReport, MQICategory, ParameterAuditResult } from '../types/audit';
import { MQI_CATEGORIES } from '../audit/methodology';
import {
  CORE_ELEMENTS_V4,
  EXTENSION_ELEMENTS_V4,
  CATEGORY_WEIGHTS_V4,
  calculateV4Scores,
  ElementRuleV4,
} from '../audit/v4Rules';
import { QUALITY_FLAGS_DEFINITIONS, QualityFlagResult } from '../audit/flags';
import { BENCHMARK_DATASETS_V4, BenchmarkDatasetV4 } from '../data/benchmarksV4';
import { EvidenceModal } from './EvidenceModal';
import { OpenStreetMapViewer } from './OpenStreetMapViewer';
import { AuditComparisonBarChart } from './AuditComparisonBarChart';
import { ManualReviewPanel } from './ManualReviewPanel';
import { BenchmarkExplorerModal } from './BenchmarkExplorerModal';
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
  const [activeTab, setActiveTab] = useState<
    'v4elements' | 'manualReview' | 'emptyElements' | 'warnings' | 'extensions' | 'benchmarks' | 'categories' | 'iso19115' | 'map'
  >('v4elements');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedScoreFilter, setSelectedScoreFilter] = useState<string>('all');
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);

  // Manual Overrides State & Auditor Notes
  const [manualOverrides, setManualOverrides] = useState<
    Record<string, { value: number; notes: string; auditorName?: string; updatedAt: string }>
  >(report.manualOverrides || {});
  const [auditorNotes, setAuditorNotes] = useState<string>(report.auditorNotes || '');
  const [activeDatasetTitle, setActiveDatasetTitle] = useState<string>(report.datasetName);
  const [activeFormat, setActiveFormat] = useState<string>(report.statusSkema || report.normalizedMetadata?.rawFormat || 'gmd');

  // Starting element scores
  const [elementScores, setElementScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const el of CORE_ELEMENTS_V4) {
      if (report.elementValuesV4 && report.elementValuesV4[el.id] !== undefined) {
        initial[el.id] = report.elementValuesV4[el.id];
      } else {
        const matched = report.coreElementsResults?.find(r => r.elementId === el.id || r.ruleId === el.id);
        initial[el.id] = matched?.status === 'terpenuhi' ? 1 : matched?.status === 'perlu_ditinjau' ? 0.5 : 0;
      }
    }
    // Apply initial manual overrides if present
    if (report.manualOverrides) {
      for (const [k, v] of Object.entries(report.manualOverrides)) {
        initial[k] = v.value;
      }
    }
    return initial;
  });

  // Calculate live V4 scores reactive to manual overrides
  const activeV4 = calculateV4Scores(elementScores);
  const spatialData = resolveSpatialFromReport(report);
  const readiness = report.iso19115_3Readiness;
  const iso19115Compliance = report.iso19115Compliance;

  // Handle manual override change
  const handleOverrideChange = (elementId: string, value: number, notes: string) => {
    const updatedOverrides = {
      ...manualOverrides,
      [elementId]: {
        value,
        notes,
        auditorName: 'Auditor KOMPAS',
        updatedAt: new Date().toISOString(),
      },
    };
    setManualOverrides(updatedOverrides);
    setElementScores(prev => ({ ...prev, [elementId]: value }));
  };

  // Reset override back to auto score
  const handleResetOverride = (elementId: string) => {
    const updatedOverrides = { ...manualOverrides };
    delete updatedOverrides[elementId];
    setManualOverrides(updatedOverrides);

    // Revert to original auto score
    const autoScore = report.elementValuesV4?.[elementId] ?? 0;
    setElementScores(prev => ({ ...prev, [elementId]: autoScore }));
  };

  // Load a reference dataset from Excel v4
  const handleLoadBenchmarkDataset = (benchmark: BenchmarkDatasetV4) => {
    setActiveDatasetTitle(benchmark.title);
    setActiveFormat(benchmark.format);
    setElementScores({ ...benchmark.scores });
    setManualOverrides({});
    setAuditorNotes(`Dimuat dari Acuan Uji ${benchmark.id}: ${benchmark.notes}`);
  };

  // CSV Export Handler per Section 10 & Handover page 9
  const handleExportCsv = () => {
    const headers = [
      'ID_Dataset',
      'Judul_Dataset',
      'Kelompok_Sumber',
      'Status_Format',
      'Skor_A',
      'MQI_Biner',
      'MQI_Diperluas',
      'MQI_Ketat',
      'Kategori_MQI_Biner',
      'Kategori_MQI_Diperluas',
      'Skor_Kat_1',
      'Skor_Kat_2',
      'Skor_Kat_3',
      'Skor_Kat_4',
      'Skor_Kat_5',
      'Skor_Kat_6',
      'Skor_Kat_7',
      'Skor_Kat_8',
      ...CORE_ELEMENTS_V4.map(e => `Nilai_${e.id}`),
      'Skor_Ekstensi',
      ...EXTENSION_ELEMENTS_V4.map(e => `Nilai_${e.id}`),
      'Daftar_Elemen_Kosong',
      'Daftar_Bendera_Peringatan',
      'Override',
      'Catatan_Auditor',
      'Versi_Aturan',
    ];

    const catScores = [
      activeV4.categoryPercentages.CAT_GENERAL.toFixed(1),
      activeV4.categoryPercentages.CAT_IDENTIFICATION.toFixed(1),
      activeV4.categoryPercentages.CAT_DESCRIPTION.toFixed(1),
      activeV4.categoryPercentages.CAT_EXTENT.toFixed(1),
      activeV4.categoryPercentages.CAT_ACCURACY.toFixed(1),
      activeV4.categoryPercentages.CAT_CONTACT.toFixed(1),
      activeV4.categoryPercentages.CAT_METAMETADATA.toFixed(1),
      activeV4.categoryPercentages.CAT_PROCESSING.toFixed(1),
    ];

    const elementValuesList = CORE_ELEMENTS_V4.map(e => elementScores[e.id] ?? 0);
    const extScoreStr = report.skorEkstensiV4 !== null && report.skorEkstensiV4 !== undefined ? report.skorEkstensiV4.toFixed(1) : 'N/A';
    const extValuesList = EXTENSION_ELEMENTS_V4.map(e => report.extensionElementsResults?.find(x => x.elementId === e.id)?.scoreValue ?? 'N/A');

    const emptyListStr = activeV4.emptyElements.map(e => `${e.id} (w=${e.weight})`).join(', ');
    const triggeredFlagsStr = (report.qualityFlags || []).filter(f => f.isTriggered).map(f => f.id).join(', ');
    const overrideStr = Object.entries(manualOverrides).map(([k, v]) => `${k}=${v.value}`).join('; ');

    const row = [
      `"${report.id}"`,
      `"${(activeDatasetTitle || '').replace(/"/g, '""')}"`,
      `"${report.profileId}"`,
      `"${activeFormat}"`,
      activeV4.skorA.toFixed(2),
      activeV4.mqiBiner.toFixed(2),
      activeV4.mqiDiperluas.toFixed(2),
      activeV4.mqiKetat.toFixed(2),
      `"${activeV4.kategoriBiner}"`,
      `"${activeV4.kategoriDiperluas}"`,
      ...catScores,
      ...elementValuesList,
      `"${extScoreStr}"`,
      ...extValuesList,
      `"${emptyListStr}"`,
      `"${triggeredFlagsStr}"`,
      `"${overrideStr.replace(/"/g, '""')}"`,
      `"${auditorNotes.replace(/"/g, '""')}"`,
      `"v4-2026-10-29"`,
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers.join(',') + '\n' + row.join(',');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KOMPAS_Audit_${report.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Export Handler per Section 10 & Handover page 9
  const handleExportJson = () => {
    const jsonExportData = {
      ID_Dataset: report.id,
      Judul_Dataset: activeDatasetTitle,
      Kelompok_Sumber: report.profileId,
      Status_Format: activeFormat,
      Skor_A: parseFloat(activeV4.skorA.toFixed(2)),
      MQI_Biner: parseFloat(activeV4.mqiBiner.toFixed(2)),
      MQI_Diperluas: parseFloat(activeV4.mqiDiperluas.toFixed(2)),
      MQI_Ketat: parseFloat(activeV4.mqiKetat.toFixed(2)),
      Kategori_MQI_Biner: activeV4.kategoriBiner,
      Kategori_MQI_Diperluas: activeV4.kategoriDiperluas,
      Skor_Kategori: activeV4.categoryPercentages,
      Nilai_Elemen_E01_E26: elementScores,
      Skor_Ekstensi: report.skorEkstensiV4,
      Nilai_Elemen_E27_E32: report.extensionElementsResults?.map(e => ({ id: e.elementId, score: e.scoreValue, status: e.status })),
      Daftar_Elemen_Kosong: activeV4.emptyElements,
      Daftar_Bendera_Peringatan: (report.qualityFlags || []).filter(f => f.isTriggered).map(f => ({ id: f.id, name: f.name, evidence: f.evidence })),
      Override: manualOverrides,
      Catatan_Auditor: auditorNotes,
      Versi_Aturan: 'v4-2026-10-29',
      Timestamp: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(jsonExportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `KOMPAS_Report_${report.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter 26 elements in main table
  const filteredElements = CORE_ELEMENTS_V4.filter(el => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        el.id.toLowerCase().includes(q) ||
        el.name.toLowerCase().includes(q) ||
        el.definition.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedCategory !== 'all' && el.category !== selectedCategory) return false;
    if (selectedScoreFilter !== 'all') {
      const val = elementScores[el.id];
      if (selectedScoreFilter === '1' && val !== 1) return false;
      if (selectedScoreFilter === '0.5' && val !== 0.5) return false;
      if (selectedScoreFilter === '0' && val !== 0) return false;
    }
    return true;
  });

  const triggeredFlags = (report.qualityFlags || []).filter(f => f.isTriggered);

  return (
    <div className="space-y-8">
      {/* Benchmark Explorer Modal */}
      <BenchmarkExplorerModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
        onSelectDataset={handleLoadBenchmarkDataset}
      />

      {/* Detail Evidence Modal */}
      {selectedResult && (
        <EvidenceModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1 flex-wrap">
            <span>ID: {report.id}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{report.profileId.replace('_', ' ')}</span>
            <span aria-hidden="true">·</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-bold uppercase">
              Format: {activeFormat}
            </span>
            <span aria-hidden="true">·</span>
            <span>{new Date(report.timestamp).toLocaleString('id-ID')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeDatasetTitle}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsBenchmarkModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/80 border border-cyan-800/80 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Matriks Acuan Uji (D01–D15)</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor JSON</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* SCORE HERO SECTION: EMPAT JENIS SKOR MQI BERDASARKAN EXCEL V4 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide">
                Indeks Kualitas Metadata (Excel v4 &amp; Hasara 2026)
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Hasil Penilaian Komparatif Kualitas Metadata Geospasial
            </h2>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono text-slate-400">
              Versi Aturan: <strong className="text-white">v4-2026-10-29</strong>
            </span>
          </div>
        </div>

        {/* Grid 4 Kartu Skor Utama */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KARTU 1: SKOR A (Skema Bobot Utama) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-2 relative overflow-hidden group hover:border-cyan-500/50 transition-all">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Skor A (Bobot Utama)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                8 Kategori
              </span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-white tracking-tight tabular-nums">
              {activeV4.skorA.toFixed(1)}
              <span className="text-sm font-normal text-slate-400 ml-1">/ 100</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Σ (Fraksi Kategori × Bobot Kategori). Bobot utama kelautan &amp; BIG.
            </p>
          </div>

          {/* KARTU 2: MQI BINER (Paper Asli) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-2 relative overflow-hidden group hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">MQI Biner (Paper Asli)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                Hasara 2026
              </span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-purple-400 tracking-tight tabular-nums">
              {activeV4.mqiBiner.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">Kategori:</span>
              <span className="font-bold text-purple-300">{activeV4.kategoriBiner}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Nilai &gt;0 dihitung ada. Sebanding rumus paper MQI hlm 766.
            </p>
          </div>

          {/* KARTU 3: MQI DIPERLUAS (3 Tingkat Mutu) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-2 relative overflow-hidden group hover:border-cyan-500/50 transition-all ring-1 ring-cyan-500/30">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">MQI Diperluas (Mutu)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                Skor Mutu
              </span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-cyan-400 tracking-tight tabular-nums">
              {activeV4.mqiDiperluas.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">Kategori:</span>
              <span className="font-bold text-cyan-300">{activeV4.kategoriDiperluas}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Mempertahankan nilai 1, 0.5, dan 0 tanpa pembobotan kategori.
            </p>
          </div>

          {/* KARTU 4: MQI KETAT (Sensitivitas) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-2 relative overflow-hidden group hover:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">MQI Ketat (Sensitivitas)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Nilai 1 Saja
              </span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 tracking-tight tabular-nums">
              {activeV4.mqiKetat.toFixed(1)}%
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Hanya elemen bernilai 1.0 yang dihitung memenuhi (penilaian ketat).
            </p>
          </div>
        </div>

        {/* Status Strip: Jumlah Elemen Memenuhi / Sebagian / Kosong & Status Skema */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-800 text-xs">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-900/40 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">Memenuhi (1.0)</div>
              <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                {activeV4.elementsFulfilledCount} Elemen
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500/60" />
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-amber-900/40 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">Sebagian (0.5)</div>
              <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                {activeV4.elementsPartialCount} Elemen
              </div>
            </div>
            <HelpCircle className="w-5 h-5 text-amber-500/60" />
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-rose-900/40 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">Kosong (0.0)</div>
              <div className="text-lg font-bold font-mono text-rose-400 tabular-nums">
                {activeV4.elementsEmptyCount} Elemen
              </div>
            </div>
            <XCircle className="w-5 h-5 text-rose-500/60" />
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">Status Skema</div>
              <div className="text-sm font-bold font-mono text-cyan-400 uppercase">
                {activeFormat}
              </div>
            </div>
            <Layers className="w-5 h-5 text-cyan-500/60" />
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <div className="text-slate-400 text-[11px]">Ekstensi E27–E32</div>
              <div className="text-sm font-bold font-mono text-slate-300">
                {report.skorEkstensiV4 !== null && report.skorEkstensiV4 !== undefined
                  ? `${report.skorEkstensiV4.toFixed(1)}%`
                  : 'N/A (Bukan ISO)'}
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
        </div>

        {/* Note on Chairman Decision regarding Export Core Score */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong>Transparansi Penilaian (Excel v4 Acuan_Uji_Aplikasi):</strong> Kolom skor utama masih membutuhkan keputusan ketua tim. Aplikasi menampilkan ketiga skor utama (Skor A, MQI Biner, MQI Diperluas) secara berdampingan tanpa mengubah atau menyembunyikan rumus perhitungannya.
          </span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('v4elements')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'v4elements'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>26 Elemen Inti (E01–E26)</span>
        </button>

        <button
          onClick={() => setActiveTab('manualReview')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'manualReview'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
          <span>Penilaian Manual Auditor (7 Elemen)</span>
          {Object.keys(manualOverrides).length > 0 && (
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('emptyElements')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'emptyElements'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>Elemen Kosong ({activeV4.emptyElements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('warnings')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'warnings'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Penanda Mutu F01–F14 ({triggeredFlags.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('extensions')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'extensions'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Ekstensi ISO 19115-3 (E27–E32)</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Diagram &amp; 8 Kategori MQI</span>
        </button>

        <button
          onClick={() => setActiveTab('benchmarks')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'benchmarks'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
          <span>Acuan Uji D01–D15</span>
        </button>

        {iso19115Compliance && (
          <button
            onClick={() => setActiveTab('iso19115')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'iso19115'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kepatuhan ISO 19115</span>
          </button>
        )}
      </div>

      {/* TAB 1: 26 ELEMEN INTI (E01–E26) */}
      {activeTab === 'v4elements' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari ID elemen (E01..E26), nama, atau kriteria..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Semua Kategori (8)</option>
                {Object.keys(CATEGORY_WEIGHTS_V4).map(catKey => (
                  <option key={catKey} value={catKey}>
                    {CATEGORY_WEIGHTS_V4[catKey as MQICategory].name}
                  </option>
                ))}
              </select>

              <select
                value={selectedScoreFilter}
                onChange={e => setSelectedScoreFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Semua Nilai</option>
                <option value="1">Nilai 1.0 (Memenuhi)</option>
                <option value="0.5">Nilai 0.5 (Sebagian)</option>
                <option value="0">Nilai 0.0 (Kosong)</option>
              </select>
            </div>
          </div>

          {/* Table of 26 Core Elements */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900 shadow-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-16">ID</th>
                  <th className="py-3 px-4">Nama Elemen</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3 text-center">Bobot</th>
                  <th className="py-3 px-4">Teks Ekstraksi / Nilai Ditemukan</th>
                  <th className="py-3 px-3 text-center">Nilai</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4">Alasan &amp; Rekomendasi</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredElements.map(el => {
                  const val = elementScores[el.id] ?? 0;
                  const isOverridden = manualOverrides[el.id] !== undefined;

                  const badgeColor =
                    val === 1
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : val === 0.5
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30';

                  return (
                    <tr key={el.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {el.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-white max-w-[200px]">
                        <div>{el.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{el.gmdPath}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                        {el.categoryName}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                        {el.weight}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px] max-w-[220px] truncate" title={el.definition}>
                        {report.normalizedMetadata ? (
                          <span>{el.id === 'E04' ? report.normalizedMetadata.title || '(Kosong)' : el.id === 'E07' ? report.normalizedMetadata.abstract?.slice(0, 80) || '(Kosong)' : el.definition}</span>
                        ) : '(Kosong)'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded border text-xs font-bold ${badgeColor}`}>
                          {val}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isOverridden ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-semibold">
                            Manual
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px]">
                            Otomatis
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] leading-relaxed max-w-[260px]">
                        {val === 1 ? (
                          <span className="text-emerald-400">{el.criteria1}</span>
                        ) : val === 0.5 ? (
                          <span className="text-amber-400">{el.criteria05}</span>
                        ) : (
                          <span className="text-rose-400">{el.criteria0}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setActiveTab('manualReview');
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors"
                          title="Tinjau dan sesuaikan skor secara manual"
                        >
                          Ubah
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PENILAIAN MANUAL AUDITOR */}
      {activeTab === 'manualReview' && (
        <ManualReviewPanel
          report={report}
          elementValues={elementScores}
          manualOverrides={manualOverrides}
          onOverrideChange={handleOverrideChange}
          onResetOverride={handleResetOverride}
        />
      )}

      {/* TAB 3: DAFTAR ELEMEN KOSONG (URUT BOBOT) */}
      {activeTab === 'emptyElements' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <span>Daftar {activeV4.emptyElements.length} Elemen Metadata Bernilai Kosong (0.0)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Diurutkan berdasarkan dampak bobotnya terhadap penurunan skor MQI (Bobot 3 Kritis dulu, lalu Bobot 2 Penting, lalu Bobot 1 Pendukung).
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 font-mono text-xs font-bold">
              Total {activeV4.emptyElements.length} Celah Mutu
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeV4.emptyElements.map((el, idx) => {
              const ruleMeta = CORE_ELEMENTS_V4.find(r => r.id === el.id);
              return (
                <div
                  key={el.id}
                  className="bg-slate-900 border border-rose-900/40 rounded-xl p-4 space-y-3 relative overflow-hidden group hover:border-rose-700 transition-all shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-rose-950 text-rose-300 font-mono text-xs font-bold flex items-center justify-center border border-rose-800">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-sm text-white">{el.id}</span>
                      <span className="text-xs text-slate-400 font-medium">({el.category})</span>
                    </div>

                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                        el.weight === 3
                          ? 'bg-rose-950 text-rose-400 border-rose-800'
                          : el.weight === 2
                          ? 'bg-amber-950 text-amber-400 border-amber-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      Bobot {el.weight} {el.weight === 3 ? '(Kritis)' : el.weight === 2 ? '(Penting)' : '(Pendukung)'}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-200">
                    {el.name}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {ruleMeta?.definition}
                  </p>

                  <div className="pt-2 border-t border-slate-800 text-[11px] text-cyan-400/90 leading-relaxed">
                    <strong className="text-cyan-300">Rekomendasi Pemenuhan:</strong> {ruleMeta?.criteria1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PENANDA MUTU (F01–F14) */}
      {activeTab === 'warnings' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Peringatan dan Penanda Mutu Metadata (F01–F14)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Berdasarkan sheet Penanda KOMPAS Excel v4: Dilaporkan terpisah dari skor MQI untuk transparansi audit.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 font-mono text-xs font-bold">
              {triggeredFlags.length} Peringatan Terdeteksi
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(QUALITY_FLAGS_DEFINITIONS) as QualityFlagResult['id'][]).map(flagId => {
              const flagDef = QUALITY_FLAGS_DEFINITIONS[flagId];
              const result = (report.qualityFlags || []).find(f => f.id === flagId);
              const isTriggered = result?.isTriggered ?? false;

              return (
                <div
                  key={flagId}
                  className={`p-4 rounded-xl border transition-all ${
                    isTriggered
                      ? 'bg-slate-900/90 border-amber-500/60 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
                      : 'bg-slate-950/50 border-slate-800/80 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                          isTriggered
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}
                      >
                        {flagId}
                      </span>
                      <span className={`text-xs font-semibold ${isTriggered ? 'text-white' : 'text-slate-400'}`}>
                        {flagDef.name}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isTriggered
                          ? 'bg-amber-500/20 text-amber-400 font-bold'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isTriggered ? 'Terdeteksi' : 'Aman'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {flagDef.description}
                  </p>

                  {isTriggered && result?.evidence && (
                    <div className="mt-3 p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/50 text-[11px] text-amber-200/90 font-mono">
                      <strong>Bukti Temuan:</strong> {result.evidence}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: EKSTENSI ISO 19115-3 (E27–E32) */}
      {activeTab === 'extensions' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide">
                    Elemen Tambahan (E27–E32)
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  6 Elemen Ekstensi ISO 19115-3 (Panduan BIG v6)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
                  Status Skema: <strong className="text-cyan-400 uppercase">{activeFormat}</strong>
                </span>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
                  Skor Ekstensi: <strong className="text-emerald-400">{report.skorEkstensiV4 !== null && report.skorEkstensiV4 !== undefined ? `${report.skorEkstensiV4.toFixed(1)}%` : 'N/A'}</strong>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Sesuai sheet Checklist dan Handover Revisi 29 Okt: Keenam elemen ini dicantumkan dalam Checklist tetapi belum dimasukkan ke perhitungan MQI utama (E01–E26 tetap 26 elemen agar sebanding dengan paper). Jalur padanan gmd ada di Checklist kolom H.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EXTENSION_ELEMENTS_V4.map(el => {
              const extRes = report.extensionElementsResults?.find(x => x.elementId === el.id);
              const scoreVal = extRes?.scoreValue ?? 0;
              return (
                <div
                  key={el.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {el.id} (Bobot {el.weight})
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      Nilai: {scoreVal}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{el.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{el.definition}</p>
                  <div className="text-[11px] font-mono text-cyan-400 bg-slate-950 p-2 rounded border border-slate-800">
                    Jalur mdb: {el.mdbPath}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: DIAGRAM & 8 KATEGORI */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <AuditComparisonBarChart report={report} />
        </div>
      )}

      {/* TAB 7: ACUAN UJI D01–D15 */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                <span>Acuan Uji Aplikasi D01–D15 (Sheet Acuan_Uji_Aplikasi)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Nilai acuan deterministik resmi 15 dataset kelautan Indonesia dari Excel v4.
              </p>
            </div>
            <button
              onClick={() => setIsBenchmarkModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition-colors"
            >
              Buka Matriks Lengkap
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Judul Dataset</th>
                  <th className="py-2.5 px-3">Sumber</th>
                  <th className="py-2.5 px-3">Format</th>
                  <th className="py-2.5 px-3 text-right">Skor A</th>
                  <th className="py-2.5 px-3 text-right">MQI Biner</th>
                  <th className="py-2.5 px-3 text-right">MQI Diperluas</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-center">Kosong</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {BENCHMARK_DATASETS_V4.map(ds => (
                  <tr key={ds.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">{ds.id}</td>
                    <td className="py-2.5 px-3 font-medium text-white max-w-[240px] truncate" title={ds.title}>
                      {ds.title}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{ds.sourceGroup}</td>
                    <td className="py-2.5 px-3 font-mono uppercase">{ds.format}</td>
                    <td className="py-2.5 px-3 font-mono text-right font-bold text-white">
                      {ds.expectedSkorA.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-purple-400">
                      {ds.expectedMqiBiner.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right font-bold text-cyan-400">
                      {ds.expectedMqiDiperluas.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {ds.expectedKategoriDiperluas}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center text-rose-400 font-bold">
                      {ds.emptyElementsCount}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleLoadBenchmarkDataset(ds)}
                        className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-[11px] font-bold transition-colors"
                      >
                        Muat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: ISO 19115 CORE COMPLIANCE */}
      {activeTab === 'iso19115' && iso19115Compliance && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>13 Elemen Metadata Inti ISO 19115 (SNI ISO 19115:2012)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {iso19115Compliance.summaryNotes} Menguji kepatuhan terhadap elemen wajib minimal agar metadata dapat terindeks secara legal pada katalog geospasial nasional dan internasional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {iso19115Compliance.elements.map(el => (
              <div key={el.code} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400">{el.code}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${el.status === 'terpenuhi' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                    {el.status === 'terpenuhi' ? 'Terpenuhi' : 'Tidak Terpenuhi'}
                  </span>
                </div>
                <div className="text-xs font-bold text-white">{el.nameId}</div>
                <div className="text-[11px] text-slate-400">{el.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
