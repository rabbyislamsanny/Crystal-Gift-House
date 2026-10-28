import React, { useState } from 'react';
import { Receipt, Plus, AlertCircle, DollarSign, X } from 'lucide-react';
import { OperatingExpense } from '../types/database';

interface ExpensesViewProps {
  expenses: OperatingExpense[];
  onSaveExpense: (expense: any) => OperatingExpense;
  onDeleteExpense?: (expenseId: string) => { success: boolean };
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [category, setCategory] = useState<OperatingExpense['category']>('Packaging');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isCourierFee, setIsCourierFee] = useState(false);

  const categories: OperatingExpense['category'][] = [
    'Packaging',
    'Salaries',
    'Rent',
    'Internet & Tools',
    'Payment Gateway',
    'Office & Refreshment',
    'Damaged Goods',
    'Courier Fees',
    'Marketing Misc',
    'Other',
  ];

  const handleOpenModal = () => {
    setEditingExpenseId(null);
    setCategory('Packaging');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount(1000);
    setPaymentStatus('paid');
    setPaymentMethod('Cash');
    setReference('');
    setNotes('');
    setIsCourierFee(false);
    setIsModalOpen(true);
  };

  const handleEditExpense = (exp: OperatingExpense) => {
    setEditingExpenseId(exp.id);
    setCategory(exp.category);
    setDate(exp.date);
    setAmount(exp.amount);
    setPaymentStatus(exp.paymentStatus);
    setPaymentMethod(exp.paymentMethod);
    setReference(exp.reference || '');
    setNotes(exp.notes || '');
    setIsCourierFee(Boolean(exp.isCourierFee));
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Expense amount must be greater than zero.');
      return;
    }
    onSaveExpense({
      id: editingExpenseId || undefined,
      category,
      date,
      amount,
      paymentStatus,
      paymentMethod,
      reference,
      notes,
      isCourierFee: isCourierFee || category === 'Courier Fees',
    });
    setIsModalOpen(false);
  };

  const totalOperatingExpense = expenses
    .filter((e) => !e.isCourierFee)
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-700" />
            <span>Operating Expense Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log overheads, packaging, office utilities & salaries with double-counting courier safeguards
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Operating Expense</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <span className="text-slate-500 text-xs">Total Operating Overheads</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            ৳{totalOperatingExpense.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Excludes courier fees counted in parcels
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">Packaging Materials Cost</span>
          <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
            ৳{expenses.filter((e) => e.category === 'Packaging').reduce((s, e) => s + e.amount, 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Gift boxes, bubble wrap & tape
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-xs">Double-Counting Safeguard</span>
          <div className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1">
            <span>Active & Enforced</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Courier fees flagged & deduplicated
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount (BDT)</th>
                <th className="px-4 py-3 text-center">Payment Status</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Reference & Notes</th>
                <th className="px-4 py-3 text-center">P&L Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-slate-600">{exp.date}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{exp.category}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    ৳{exp.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                        exp.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {exp.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{exp.paymentMethod}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {exp.reference && <strong className="text-slate-800 font-mono">{exp.reference} • </strong>}
                    {exp.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {exp.isCourierFee ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold" title="Already counted in courier settlements">
                        Parcel Deducted
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        Counted in P&L
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleEditExpense(exp)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded text-[11px] cursor-pointer"
                      >
                        Edit
                      </button>
                      {onDeleteExpense && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete expense ৳${exp.amount} (${exp.category})?`)) {
                              onDeleteExpense(exp.id);
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Log Operating Expense</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value as any;
                    setCategory(cat);
                    if (cat === 'Courier Fees') setIsCourierFee(true);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Amount (৳ BDT) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid / Accrued</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Payment Method</label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Cash / bKash / Bank"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Reference / Voucher ID</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. INV-CHAWK-88"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 100 velvet gift boxes"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              {category === 'Courier Fees' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                  <strong>Notice:</strong> This courier expense will be flagged to prevent double counting since parcel settlements already track courier fees.
                </div>
              )}

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
