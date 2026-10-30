import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { BENCHMARK_DATASETS_V4, BenchmarkDatasetV4 } from '../data/benchmarksV4';

interface BenchmarkExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDataset?: (dataset: BenchmarkDatasetV4) => void;
}

export const BenchmarkExplorerModal: React.FC<BenchmarkExplorerModalProps> = ({
  isOpen,
  onClose,
  onSelectDataset,
}) => {
  const [selectedDs, setSelectedDs] = useState<BenchmarkDatasetV4>(BENCHMARK_DATASETS_V4[0]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Matriks Acuan Uji 15 Dataset (KOMPAS Excel v4)
              </h2>
              <p className="text-xs text-slate-400">
                Nilai acuan deterministik resmi D01–D15 dari sheet Kodean, Skor, dan Acuan_Uji_Aplikasi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Dataset Selector Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] border-b border-slate-800 uppercase">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Judul Dataset</th>
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
                {BENCHMARK_DATASETS_V4.map(ds => {
                  const isSelected = ds.id === selectedDs.id;
                  return (
                    <tr
                      key={ds.id}
                      onClick={() => setSelectedDs(ds)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-cyan-950/40 text-cyan-300'
                          : 'hover:bg-slate-900/50 text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold">{ds.id}</td>
                      <td className="py-2.5 px-3 font-medium max-w-[240px] truncate" title={ds.title}>
                        {ds.title}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ds.format === 'gmd'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                              : ds.format === 'ESRI'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                              : 'bg-purple-950/80 text-purple-300 border border-purple-800'
                          }`}
                        >
                          {ds.format}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-bold text-white">
                        {ds.expectedSkorA.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-slate-300">
                        {ds.expectedMqiBiner.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-bold text-cyan-400">
                        {ds.expectedMqiDiperluas.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            ds.expectedKategoriDiperluas === 'Good'
                              ? 'text-cyan-400 bg-cyan-950/60'
                              : ds.expectedKategoriDiperluas === 'Fair'
                              ? 'text-amber-400 bg-amber-950/60'
                              : 'text-rose-400 bg-rose-950/60'
                          }`}
                        >
                          {ds.expectedKategoriDiperluas}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center text-rose-400 font-bold">
                        {ds.emptyElementsCount}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDataset?.(ds);
                            onClose();
                          }}
                          className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-[11px] font-bold transition-colors"
                        >
                          Muat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detailed Card for Selected Dataset */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-cyan-400">
                    {selectedDs.id}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-400">{selectedDs.sourceGroup}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-400">{selectedDs.portalOrTool}</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1">
                  {selectedDs.title}
                </h3>
              </div>

              <button
                onClick={() => {
                  onSelectDataset?.(selectedDs);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>Terapkan Dataset Ini ke Auditor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">Skor A (Bobot Utama)</div>
                <div className="text-lg font-bold text-white">{selectedDs.expectedSkorA.toFixed(2)}</div>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">MQI Biner (Paper Asli)</div>
                <div className="text-lg font-bold text-purple-400">{selectedDs.expectedMqiBiner.toFixed(2)}%</div>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">MQI Diperluas (Mutu)</div>
                <div className="text-lg font-bold text-cyan-400">{selectedDs.expectedMqiDiperluas.toFixed(2)}%</div>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">MQI Ketat (Sensitivitas)</div>
                <div className="text-lg font-bold text-amber-400">{selectedDs.expectedMqiKetat.toFixed(2)}%</div>
              </div>
            </div>

            {/* Empty Elements & Warning Flags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Daftar {selectedDs.emptyElementsCount} Elemen Kosong (Nilai 0):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono">
                  {selectedDs.emptyElementsList.map(el => (
                    <span key={el} className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[11px]">
                      {el}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bendera Penanda Mutu (F01–F14):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono">
                  {selectedDs.expectedFlags.map(fl => (
                    <span key={fl} className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 text-[11px]">
                      {fl}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 italic">
              Catatan: {selectedDs.notes}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
