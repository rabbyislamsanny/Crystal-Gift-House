import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  X,
  Sparkles,
} from 'lucide-react';

interface AcceptanceTestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTests: () => Array<{ id: number; name: string; passed: boolean; message: string; details: any }>;
  onRefreshData: () => void;
}

export const AcceptanceTestsModal: React.FC<AcceptanceTestsModalProps> = ({
  isOpen,
  onClose,
  onRunTests,
  onRefreshData,
}) => {
  const [testResults, setTestResults] = useState<
    Array<{ id: number; name: string; passed: boolean; message: string; details: any }> | null
  >(null);
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

  const handleExecute = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = onRunTests();
      setTestResults(results);
      setIsRunning(false);
      onRefreshData();
    }, 400);
  };

  const allPassed = testResults && testResults.every((t) => t.passed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800/80 rounded-lg text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Business OS Acceptance Verification Suite
              </h2>
              <p className="text-xs text-emerald-300/80">
                10-Point Automated Quality & Logic Validation Tests
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-emerald-300 hover:text-white hover:bg-emerald-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-900 text-sm">Automated Test Runner</div>
              <p className="text-slate-500 text-xs mt-0.5">
                Executes live database transactions for stock reservations, WAC recalculation, dispatches, cancellations, return inspections, and ad expense daily allocations.
              </p>
            </div>
            <button
              onClick={handleExecute}
              disabled={isRunning}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isRunning ? 'Verifying OS...' : 'Run All 10 Tests'}</span>
            </button>
          </div>

          {/* Test Status Banner */}
          {testResults && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                allPassed
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {allPassed ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>All 10 Business OS Acceptance Tests Passed 100%!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span>Some tests did not meet criteria.</span>
                  </>
                )}
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-white/80 rounded border">
                {testResults.filter((t) => t.passed).length} / 10 Passed
              </span>
            </div>
          )}

          {/* 10 Test Cases List */}
          <div className="space-y-2">
            {(testResults || [
              { id: 1, name: 'Add a product with 10 units of stock and a purchase cost of BDT 300 per unit' },
              { id: 2, name: 'Create a two-unit order at BDT 500 per unit and confirm correct stock reservation & order totals' },
              { id: 3, name: 'Dispatch, deliver, and settle the order; verify stock, revenue, courier costs, receivables, and profit' },
              { id: 4, name: 'Cancel another order and verify inventory is restored or reservation released exactly once' },
              { id: 5, name: 'Return a shipped order and verify return costs, refund, inspection, and restocking rules' },
              { id: 6, name: 'Enter a $100 advertising expense covering three days; verify BDT conversion & daily allocation without duplication' },
              { id: 7, name: 'Confirm that pending orders are not treated as realized delivered sales' },
              { id: 8, name: 'Confirm that purchases, COGS, courier expenses, refunds, and advertising costs are not double-counted' },
              { id: 9, name: 'Verify that date filters, dashboard totals, detailed reports, and exports reconcile' },
              { id: 10, name: 'Verify mobile usability, form validation, permissions, backup/restore, and database persistence' },
            ]).map((test: any) => {
              const isPassed = test.passed;
              return (
                <div
                  key={test.id}
                  className={`p-3 rounded-lg border transition-all ${
                    testResults
                      ? isPassed
                        ? 'bg-white border-emerald-200 hover:border-emerald-300'
                        : 'bg-red-50/50 border-red-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {testResults ? (
                          isPassed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300 text-[10px] flex items-center justify-center font-mono font-bold text-slate-500">
                            {test.id}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 leading-snug">
                          {test.id}. {test.name}
                        </div>
                        {test.message && (
                          <div className="text-[11px] text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                            {test.message}
                          </div>
                        )}
                      </div>
                    </div>

                    {testResults && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 font-mono ${
                          isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {isPassed ? 'PASSED' : 'FAILED'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Automated test suite ensures audit-proof e-commerce accounting & inventory
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
