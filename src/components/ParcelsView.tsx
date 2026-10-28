import React, { useState } from 'react';
import {
  Truck,
  DollarSign,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  Search,
  CheckCheck,
  Building,
  X,
} from 'lucide-react';
import { Parcel, BankCashAccount, CourierSettlement } from '../types/database';

interface ParcelsViewProps {
  parcels: Parcel[];
  bankAccounts: BankCashAccount[];
  onSettleParcels: (parcelIds: string[], bankAccountId: string, notes?: string) => { success: boolean; settledAmount: number };
  onUpdateParcelStatus: (parcelId: string, status: any) => void;
}

export const ParcelsView: React.FC<ParcelsViewProps> = ({
  parcels,
  bankAccounts,
  onSettleParcels,
  onUpdateParcelStatus,
}) => {
  const [courierFilter, setCourierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);

  // Settlement Modal
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id || '');
  const [settlementNote, setSettlementNote] = useState('');

  // Filter logic
  const filtered = parcels.filter((p) => {
    if (courierFilter !== 'all' && p.courierName !== courierFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchNum = p.orderNumber.toLowerCase().includes(q);
      const matchCust = p.customerName.toLowerCase().includes(q);
      const matchPhone = p.customerPhone.includes(q);
      const matchTrack = p.trackingNumber.toLowerCase().includes(q) || p.consignmentId.toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchPhone && !matchTrack) return false;
    }
    return true;
  });

  const handleToggleSelect = (id: string) => {
    if (selectedParcelIds.includes(id)) {
      setSelectedParcelIds(selectedParcelIds.filter((x) => x !== id));
    } else {
      setSelectedParcelIds([...selectedParcelIds, id]);
    }
  };

  const handleSelectAllDeliveredUnsettled = () => {
    const unsettledDelivered = filtered.filter((p) => p.status === 'delivered' && !p.isSettled);
    if (selectedParcelIds.length === unsettledDelivered.length) {
      setSelectedParcelIds([]);
    } else {
      setSelectedParcelIds(unsettledDelivered.map((p) => p.id));
    }
  };

  const handleConfirmSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedParcelIds.length === 0) return;
    onSettleParcels(selectedParcelIds, selectedBankId, settlementNote);
    setIsSettleModalOpen(false);
    setSelectedParcelIds([]);
  };

  // Metrics
  const totalCOD = parcels.reduce((s, p) => s + p.codAmount, 0);
  const totalCourierFees = parcels.reduce((s, p) => s + p.deliveryCharge + (p.returnCharge || 0), 0);
  const pendingSettlementParcels = parcels.filter((p) => p.status === 'delivered' && !p.isSettled);
  const pendingSettlementAmount = pendingSettlementParcels.reduce((s, p) => s + (p.codAmount - p.deliveryCharge), 0);

  // Selected calculation for modal
  const selectedParcels = parcels.filter((p) => selectedParcelIds.includes(p.id));
  const selectedGrossCOD = selectedParcels.reduce((s, p) => s + p.codAmount, 0);
  const selectedFees = selectedParcels.reduce((s, p) => s + p.deliveryCharge + (p.returnCharge || 0), 0);
  const selectedNetDeposit = selectedGrossCOD - selectedFees;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-700" />
            <span>Parcel Logistics & Courier COD Settlements</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track consignments, reconcile courier deductions, and disburse collected COD into bank accounts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedParcelIds.length > 0 ? (
            <button
              onClick={() => setIsSettleModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer animate-pulse"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Settle {selectedParcelIds.length} Delivered Parcels (৳{selectedNetDeposit.toLocaleString()})</span>
            </button>
          ) : (
            <button
              onClick={handleSelectAllDeliveredUnsettled}
              disabled={pendingSettlementParcels.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <DollarSign className="w-4 h-4" />
              <span>Select {pendingSettlementParcels.length} Unsettled COD</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <span className="text-slate-500 text-xs">Unsettled Courier Debt (Receivables)</span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-0.5">
            ৳{Math.round(pendingSettlementAmount).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {pendingSettlementParcels.length} delivered parcels
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">Total Parcels Shipped</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {parcels.length} shipments
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Across Steadfast, Pathao & RedX
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">Total Courier Deductions</span>
          <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">
            ৳{Math.round(totalCourierFees).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Delivery + return charges
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">In-Transit Shipments</span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
            {parcels.filter((p) => p.status === 'in_transit').length} en route
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Awaiting customer acceptance
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Consignment ID, Tracking #, Customer Phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium outline-none"
          >
            <option value="all">All Courier Partners</option>
            <option value="Steadfast">Steadfast Courier</option>
            <option value="Pathao">Pathao</option>
            <option value="RedX">RedX</option>
            <option value="eCourier">eCourier</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium outline-none"
          >
            <option value="all">All Parcel Statuses</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered (Pending Settlement)</option>
            <option value="settled">Settled to Bank</option>
            <option value="returned">Returned to Sender</option>
          </select>
        </div>
      </div>

      {/* Parcels Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-8">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-4 py-3">Consignment & Courier</th>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3 text-right">COD Amount</th>
                <th className="px-4 py-3 text-right">Delivery Fee</th>
                <th className="px-4 py-3 text-right">Return Fee</th>
                <th className="px-4 py-3 text-right">Net Settled</th>
                <th className="px-4 py-3 text-center">Parcel Status</th>
                <th className="px-4 py-3 text-center">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const canSelect = p.status === 'delivered' && !p.isSettled;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedParcelIds.includes(p.id)}
                        disabled={!canSelect}
                        onChange={() => handleToggleSelect(p.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 font-mono">{p.trackingNumber}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {p.courierName} • Dispatched {p.dispatchDate.slice(0, 10)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-950 font-semibold">
                      {p.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{p.customerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ৳{p.codAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      ৳{p.deliveryCharge}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      {p.returnCharge > 0 ? `৳${p.returnCharge}` : '৳0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                      {p.isSettled ? `৳${p.settledAmount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                          p.status === 'settled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'delivered'
                            ? 'bg-blue-100 text-blue-800'
                            : p.status === 'returned'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.isSettled ? (
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Disbursed
                        </span>
                      ) : p.status === 'delivered' ? (
                        <button
                          onClick={() => {
                            setSelectedParcelIds([p.id]);
                            setIsSettleModalOpen(true);
                          }}
                          className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-[11px] cursor-pointer"
                        >
                          Settle Now
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">In transit</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Courier Settlement Reconciliation Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Disburse Courier Settlement into Account</h3>
              <button onClick={() => setIsSettleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Selected Parcels:</span>
                  <strong>{selectedParcels.length} shipments</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Gross COD Collected:</span>
                  <strong>৳{selectedGrossCOD.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Courier Delivery Charges Deducted:</span>
                  <strong>-৳{selectedFees.toLocaleString()}</strong>
                </div>
                <div className="pt-2 border-t flex justify-between text-sm font-bold text-emerald-900">
                  <span>Net Amount Deposited to Bank:</span>
                  <span className="text-base">৳{selectedNetDeposit.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Select Receiving Bank / MFS Account *
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.accountName} ({b.accountNumber}) • Current: ৳{b.balance.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Courier Disbursement Reference / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Steadfast Disbursement Batch #ST-OCT-22"
                  value={settlementNote}
                  onChange={(e) => setSettlementNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Confirm & Credit ৳{selectedNetDeposit.toLocaleString()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
