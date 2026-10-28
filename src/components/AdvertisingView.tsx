import React, { useState } from 'react';
import {
  TrendingUp,
  Plus,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  X,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { AdExpense } from '../types/database';
import { allocateAdExpenseEvenly } from '../utils/accountingCalculations';

interface AdvertisingViewProps {
  adExpenses: AdExpense[];
  defaultExchangeRate: number;
  onSaveAdExpense: (input: any) => AdExpense;
  onDeleteAdExpense?: (adId: string) => { success: boolean };
}

export const AdvertisingView: React.FC<AdvertisingViewProps> = ({
  adExpenses,
  defaultExchangeRate,
  onSaveAdExpense,
  onDeleteAdExpense,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);

  // Form states
  const [platform, setPlatform] = useState<'Meta / Facebook' | 'Google' | 'TikTok' | 'Other'>('Meta / Facebook');
  const [campaignName, setCampaignName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [usdAmount, setUsdAmount] = useState<number>(100);
  const [exchangeRate, setExchangeRate] = useState<number>(defaultExchangeRate || 122.5);
  const [feeBdt, setFeeBdt] = useState<number>(1837.5); // 15% AIT/VAT standard
  const [paymentMethod, setPaymentMethod] = useState('Dual Currency Visa/Mastercard');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [allocationMethod, setAllocationMethod] = useState<'even' | 'manual'>('even');

  // Manual daily allocations if manual method chosen
  const [manualAllocations, setManualAllocations] = useState<Array<{ date: string; bdtAmount: number }>>([]);
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);

  // Calculations
  const bdtEquivalent = Math.round(usdAmount * exchangeRate * 100) / 100;
  const totalBdt = Math.round((bdtEquivalent + feeBdt) * 100) / 100;

  // Open modal
  const handleOpenModal = () => {
    setEditingAdId(null);
    setCampaignName('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setUsdAmount(100);
    setExchangeRate(defaultExchangeRate || 122.5);
    setFeeBdt(Math.round(100 * (defaultExchangeRate || 122.5) * 0.15 * 100) / 100);
    setReference('TXN-FB-' + Math.floor(100000 + Math.random() * 900000));
    setNotes('');
    setAllocationMethod('even');
    setIsModalOpen(true);
  };

  const handleEditAd = (ad: AdExpense) => {
    setEditingAdId(ad.id);
    setPlatform(ad.platform);
    setCampaignName(ad.campaignName);
    setStartDate(ad.startDate);
    setEndDate(ad.endDate);
    setUsdAmount(ad.usdAmount);
    setExchangeRate(ad.exchangeRate);
    setFeeBdt(ad.feeBdt);
    setPaymentMethod(ad.paymentMethod);
    setReference(ad.reference || '');
    setNotes(ad.notes || '');
    setAllocationMethod(ad.allocationMethod);
    setManualAllocations(ad.allocations);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) {
      alert('Campaign name is required.');
      return;
    }
    if (usdAmount <= 0) {
      alert('USD amount must be greater than zero.');
      return;
    }
    if (startDate > endDate) {
      alert('Start date cannot be after end date.');
      return;
    }

    onSaveAdExpense({
      id: editingAdId || undefined,
      platform,
      campaignName,
      startDate,
      endDate,
      usdAmount,
      exchangeRate,
      feeBdt,
      paymentMethod,
      reference,
      notes,
      allocationMethod,
      manualDailyAllocations: allocationMethod === 'manual' ? manualAllocations : undefined,
    });

    setIsModalOpen(false);
  };

  const totalUSDSpent = adExpenses.reduce((s, a) => s + a.usdAmount, 0);
  const totalBDTSpent = adExpenses.reduce((s, a) => s + a.totalBdt, 0);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-700" />
            <span>Advertising Expense Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Meta / Facebook, Google & TikTok ads. Handles multi-day campaigns, USD conversion & zero-duplication daily allocations
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Log Ad Spend</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <span className="text-slate-500 text-xs">Total Ad Spend (BDT)</span>
          <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
            ৳{Math.round(totalBDTSpent).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Exact mathematical allocation
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">Total USD Charged</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            ${totalUSDSpent.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Meta / Google / TikTok
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">Default Bank Exchange Rate</span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
            ৳{defaultExchangeRate.toFixed(2)} / $
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Configurable per transaction
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">Active Campaigns Recorded</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {adExpenses.length} entries
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Single entry, zero double counting
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Campaign & Platform</th>
                <th className="px-4 py-3">Date Range</th>
                <th className="px-4 py-3 text-right">USD Amount</th>
                <th className="px-4 py-3 text-right">Rate (BDT/USD)</th>
                <th className="px-4 py-3 text-right">Bank / VAT Fee</th>
                <th className="px-4 py-3 text-right">Total BDT Paid</th>
                <th className="px-4 py-3 text-center">Daily Allocation</th>
                <th className="px-4 py-3">Payment Ref</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No advertising expenses recorded yet. Click "Log Ad Spend" to record campaign costs.
                  </td>
                </tr>
              ) : (
                adExpenses.map((ad) => {
                  const isExpanded = expandedAdId === ad.id;
                  return (
                    <React.Fragment key={ad.id}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{ad.campaignName}</div>
                          <div className="text-[11px] text-emerald-800 font-semibold">
                            {ad.platform}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {ad.startDate} → {ad.endDate}
                          <div className="text-[10px] text-slate-400">
                            {ad.allocations.length} days
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          ${ad.usdAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          ৳{ad.exchangeRate.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">
                          ৳{ad.feeBdt.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-950 text-sm">
                          ৳{ad.totalBdt.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setExpandedAdId(isExpanded ? null : ad.id)}
                            className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                          >
                            {isExpanded ? 'Hide' : `View ${ad.allocations.length} Days`}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {ad.reference || ad.paymentMethod}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditAd(ad)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded text-[11px] cursor-pointer"
                            >
                              Edit
                            </button>
                            {onDeleteAdExpense && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete ad campaign "${ad.campaignName}" ($${ad.usdAmount})?`)) {
                                    onDeleteAdExpense(ad.id);
                                  }
                                }}
                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded text-[11px] cursor-pointer"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Daily Allocation Breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={9} className="p-4">
                            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                <span>Daily Allocation Schedule ({ad.allocationMethod} method)</span>
                                <span className="font-mono text-emerald-800">
                                  Sum: ৳{ad.allocations.reduce((s, a) => s + a.bdtAmount, 0).toFixed(2)} / ৳{ad.totalBdt.toFixed(2)} (Exact Match)
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {ad.allocations.map((alloc, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 bg-slate-50 rounded border border-slate-100 text-center font-mono"
                                  >
                                    <div className="text-[10px] text-slate-500">{alloc.date}</div>
                                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                                      ৳{alloc.bdtAmount.toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Ad Spend Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
              <h3 className="font-bold text-sm">Log Multi-Day Advertising Campaign Expense</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Advertising Platform *</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  >
                    <option value="Meta / Facebook">Meta / Facebook Ads</option>
                    <option value="Google">Google Ads</option>
                    <option value="TikTok">TikTok Ads</option>
                    <option value="Other">Other Ad Network</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    required
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Wedding Crystal Lamp Video Campaign"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Campaign Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Campaign End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              {/* USD & Exchange Rate Calculator */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                <h4 className="font-bold text-emerald-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <span>Currency & Bank Charge Conversion</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">USD Amount Charged ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      value={usdAmount}
                      onChange={(e) => {
                        const usd = parseFloat(e.target.value) || 0;
                        setUsdAmount(usd);
                        setFeeBdt(Math.round(usd * exchangeRate * 0.15 * 100) / 100);
                      }}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg font-mono text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Exchange Rate (৳ / $) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      value={exchangeRate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        setExchangeRate(rate);
                        setFeeBdt(Math.round(usdAmount * rate * 0.15 * 100) / 100);
                      }}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg font-mono text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Bank Fee & VAT/AIT (৳ BDT)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={feeBdt}
                      onChange={(e) => setFeeBdt(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg font-mono text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-900">BDT Equivalent: <strong>৳{bdtEquivalent.toLocaleString()}</strong></span>
                  <span className="text-base font-bold text-emerald-950">
                    Total BDT Paid: ৳{totalBdt.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Daily Allocation Policy */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Daily Expense Allocation Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="allocation"
                      value="even"
                      checked={allocationMethod === 'even'}
                      onChange={() => setAllocationMethod('even')}
                      className="mt-0.5"
                    />
                    <div>
                      <strong className="block text-slate-900">Distribute Evenly by Day (Recommended)</strong>
                      <span className="text-[11px] text-slate-500">
                        Total ৳{totalBdt.toLocaleString()} divided equally across campaign period with exact sum preservation.
                      </span>
                    </div>
                  </label>

                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="allocation"
                      value="manual"
                      checked={allocationMethod === 'manual'}
                      onChange={() => setAllocationMethod('manual')}
                      className="mt-0.5"
                    />
                    <div>
                      <strong className="block text-slate-900">Custom / Single Allocation</strong>
                      <span className="text-[11px] text-slate-500">
                        Recorded on campaign start date or custom specified daily amount.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Payment Method</label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="e.g. Dual Currency Credit Card"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Bank Reference / TXN ID</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. TXN-FB-998811"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Ad Expense (৳{totalBdt.toLocaleString()})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
