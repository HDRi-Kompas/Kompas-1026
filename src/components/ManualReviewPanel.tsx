import React, { useState } from 'react';
import {
  FileCheck2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Edit3,
  Undo2,
} from 'lucide-react';
import { CORE_ELEMENTS_V4, ElementRuleV4 } from '../audit/v4Rules';
import { AuditReport } from '../types/audit';

interface ManualReviewPanelProps {
  report: AuditReport;
  elementValues: Record<string, number>;
  manualOverrides: Record<string, { value: number; notes: string; auditorName?: string; updatedAt: string }>;
  onOverrideChange: (elementId: string, value: number, notes: string) => void;
  onResetOverride: (elementId: string) => void;
}

export const ManualReviewPanel: React.FC<ManualReviewPanelProps> = ({
  report,
  elementValues,
  manualOverrides,
  onOverrideChange,
  onResetOverride,
}) => {
  // Elements designated for human interpretation
  const reviewElementIds = ['E04', 'E07', 'E08', 'E09', 'E24', 'E25', 'E26'];
  const reviewElements = CORE_ELEMENTS_V4.filter(el => reviewElementIds.includes(el.id));

  const [activeElementId, setActiveElementId] = useState<string>('E04');
  const [currentNotes, setCurrentNotes] = useState<string>('');

  const activeElement = reviewElements.find(el => el.id === activeElementId) || reviewElements[0];
  const currentValue = elementValues[activeElement.id] ?? 0;
  const isOverridden = manualOverrides[activeElement.id] !== undefined;

  // Extract raw text for active element
  const getExtractedText = (id: string): string => {
    const meta = report.normalizedMetadata;
    if (!meta) return '(Berkas metadata tidak tersedia)';
    switch (id) {
      case 'E04':
        return meta.title ? `"${meta.title}"` : '(Kosong)';
      case 'E07':
        return meta.abstract ? `"${meta.abstract}"` : '(Kosong)';
      case 'E08':
        return meta.purpose ? `"${meta.purpose}"` : '(Kosong / nilReason=missing)';
      case 'E09':
        return meta.keywords && meta.keywords.length > 0
          ? meta.keywords.join(', ')
          : '(Kosong / Tidak ditemukan kata kunci)';
      case 'E24':
        return meta.processing?.lineageStatement
          ? `"${meta.processing.lineageStatement}"`
          : '(Kosong / Tidak ada riwayat silsilah)';
      case 'E25':
        return meta.processing?.sourceDatasets && meta.processing.sourceDatasets.length > 0
          ? meta.processing.sourceDatasets.join('; ')
          : '(Kosong / Tidak ada sumber data)';
      case 'E26':
        return meta.processing?.processingSteps && meta.processing.processingSteps.length > 0
          ? meta.processing.processingSteps.join('; ')
          : '(Kosong / Tidak ada langkah metode)';
      default:
        return '(Tidak ada teks ekstraksi)';
    }
  };

  const handleSelectScore = (val: number) => {
    onOverrideChange(activeElement.id, val, currentNotes || manualOverrides[activeElement.id]?.notes || '');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Penilaian Manual Auditor (Human Interpretation)
              </h2>
              <p className="text-xs text-slate-400">
                Sesuai Handover Revisi 29 Okt &amp; Excel v4: Elemen penentu makna wajib dinilai oleh auditor
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">
            {Object.keys(manualOverrides).length} Elemen Di-override
          </span>
        </div>
      </div>

      {/* Element Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {reviewElements.map(el => {
          const val = elementValues[el.id];
          const hasOverride = manualOverrides[el.id] !== undefined;
          const isActive = el.id === activeElement.id;

          return (
            <button
              key={el.id}
              onClick={() => {
                setActiveElementId(el.id);
                setCurrentNotes(manualOverrides[el.id]?.notes || '');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 shrink-0 transition-all ${
                isActive
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/40'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span className="font-mono font-bold">{el.id}</span>
              <span className="truncate max-w-[120px]">{el.name.split(' ')[0]}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  val === 1
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : val === 0.5
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {val}
              </span>
              {hasOverride && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" title="Dinilai manual oleh auditor" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Element Card */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono font-bold text-xs">
                {activeElement.id} (Bobot: {activeElement.weight})
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Kategori: {activeElement.categoryName}
              </span>
              {isOverridden ? (
                <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300 text-[11px] font-semibold flex items-center gap-1">
                  <Edit3 className="w-3 h-3" />
                  <span>Dinilai Manual oleh Auditor</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
                  Nilai Otomatis Parser
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-1.5">
              {activeElement.name}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {activeElement.definition}
            </p>
          </div>

          {isOverridden && (
            <button
              onClick={() => onResetOverride(activeElement.id)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg flex items-center gap-1 shrink-0 self-start sm:self-auto"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Kembalikan Otomatis</span>
            </button>
          )}
        </div>

        {/* Extracted Original Text */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Teks Asli yang Diekstrak dari Metadata:</span>
          </label>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
            {getExtractedText(activeElement.id)}
          </div>
        </div>

        {/* 1 / 0.5 / 0 Selection Buttons with Checklist Criteria */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300">
            Pilih Nilai Penilaian Auditor (Sesuai Aturan Checklist Excel v4):
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Opsi 1 */}
            <div
              onClick={() => handleSelectScore(1)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                currentValue === 1
                  ? 'bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-emerald-400">Nilai 1.0 (Memenuhi)</span>
                {currentValue === 1 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeElement.criteria1}
              </p>
            </div>

            {/* Opsi 0.5 */}
            <div
              onClick={() => handleSelectScore(0.5)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                currentValue === 0.5
                  ? 'bg-amber-950/60 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-amber-400">Nilai 0.5 (Sebagian / Generik)</span>
                {currentValue === 0.5 && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeElement.criteria05}
              </p>
            </div>

            {/* Opsi 0 */}
            <div
              onClick={() => handleSelectScore(0)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                currentValue === 0
                  ? 'bg-rose-950/60 border-rose-500 shadow-md shadow-rose-950/40 ring-1 ring-rose-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-rose-400">Nilai 0.0 (Kosong / Tidak Ada)</span>
                {currentValue === 0 && <CheckCircle2 className="w-4 h-4 text-rose-400" />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeElement.criteria0}
              </p>
            </div>
          </div>
        </div>

        {/* Auditor Notes Field */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Catatan Pertimbangan Auditor untuk {activeElement.id}:</span>
            <span className="text-[11px] font-normal text-slate-400">Dicatat di Catatan_Auditor saat ekspor</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentNotes}
              onChange={e => setCurrentNotes(e.target.value)}
              placeholder="Tuliskan justifikasi interpretasi makna (misal: 'Judul memuat kode teknis tanpa lokasi wilayah sehingga bernilai 0.5')..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => onOverrideChange(activeElement.id, currentValue, currentNotes)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded-lg text-xs transition-colors shrink-0"
            >
              Simpan Catatan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
