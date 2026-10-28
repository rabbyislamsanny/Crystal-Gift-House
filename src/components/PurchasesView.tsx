import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Users,
  CheckCircle2,
  Clock,
  Boxes,
  Truck,
  DollarSign,
  X,
  Trash2,
} from 'lucide-react';
import { PurchaseOrder, Supplier, Product } from '../types/database';

interface PurchasesViewProps {
  purchases: PurchaseOrder[];
  suppliers: Supplier[];
  products: Product[];
  onCreatePO: (po: any) => PurchaseOrder;
  onReceiveGoods: (poId: string) => { success: boolean; error?: string };
  onSaveSupplier: (sup: any) => Supplier;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  suppliers,
  products,
  onCreatePO,
  onReceiveGoods,
  onSaveSupplier,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');

  // New PO Modal
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [poItems, setPoItems] = useState<Array<{ productId: string; quantity: number; unitCost: number }>>([
    { productId: products[0]?.id || '', quantity: 10, unitCost: products[0]?.purchaseCost || 300 },
  ]);

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supBalance, setSupBalance] = useState<number>(0);
  const [supNotes, setSupNotes] = useState('');

  const handleAddItem = () => {
    setPoItems([
      ...poItems,
      { productId: products[0]?.id || '', quantity: 10, unitCost: products[0]?.purchaseCost || 300 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'productId' | 'quantity' | 'unitCost', value: any) => {
    const updated = [...poItems];
    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      updated[index].productId = value;
      if (prod) updated[index].unitCost = prod.purchaseCost;
    } else {
      (updated[index] as any)[field] = value;
    }
    setPoItems(updated);
  };

  const itemsSubtotal = poItems.reduce((s, it) => s + it.quantity * it.unitCost, 0);
  const totalUnits = poItems.reduce((s, it) => s + it.quantity, 0);
  const totalAmount = itemsSubtotal + (shippingCharges || 0);

  const handleSubmitPO = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === supplierId);
    onCreatePO({
      supplierId,
      supplierName: sup ? sup.name : 'Unknown Supplier',
      date: poDate,
      shippingCharges,
      paidAmount,
      notes,
      items: poItems,
    });
    setIsPOModalOpen(false);
  };

  const handleSubmitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSupplier({
      name: supName,
      phone: supPhone,
      company: supCompany,
      address: supAddress,
      currentBalance: supBalance,
      notes: supNotes,
    });
    setIsSupplierModalOpen(false);
    setSupName('');
    setSupPhone('');
    setSupCompany('');
    setSupAddress('');
    setSupBalance(0);
    setSupNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-700" />
            <span>Purchases & Supplier Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record supplier orders, allocate landed shipping costs, and receive goods to update Weighted-Average Cost
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'orders' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Purchase Orders ({purchases.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'suppliers' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Suppliers Directory ({suppliers.length})
            </button>
          </div>

          {activeTab === 'orders' ? (
            <button
              onClick={() => setIsPOModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase Order</span>
            </button>
          ) : (
            <button
              onClick={() => setIsSupplierModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'orders' ? (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Items & Landed Cost</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Landed Shipping</th>
                  <th className="px-4 py-3 text-right">Total Payable</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No purchase orders recorded yet. Click "New Purchase Order" to receive new inventory.
                    </td>
                  </tr>
                ) : (
                  purchases.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-950">
                        {po.poNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {po.date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {po.supplierName}
                      </td>
                      <td className="px-4 py-3">
                        {po.items.map((it) => (
                          <div key={it.id} className="text-[11px] text-slate-700">
                            <strong>{it.quantity}x</strong> {it.productName} @ ৳{it.landedUnitCost}/unit
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        ৳{po.subtotal.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        ৳{po.shippingCharges.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-900">
                        ৳{po.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            po.status === 'received'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {po.status === 'ordered' && (
                          <button
                            onClick={() => {
                              if (confirm(`Receive all goods from ${po.poNumber} into stock and update Weighted-Average Costs?`)) {
                                onReceiveGoods(po.id);
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[11px] cursor-pointer"
                          >
                            Receive Goods
                          </button>
                        )}
                        {po.status === 'received' && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Received {po.receivedDate?.slice(0, 10)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Suppliers Directory */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Company / Market</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3 text-right">Outstanding Balance</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{s.phone}</td>
                    <td className="px-4 py-3 text-slate-700">{s.company}</td>
                    <td className="px-4 py-3 text-slate-500">{s.address}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-600">
                      ৳{s.currentBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
              <h3 className="font-bold text-sm">Create Supplier Purchase Order</h3>
              <button onClick={() => setIsPOModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Select Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">PO Date *</label>
                  <input
                    type="date"
                    required
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Purchase Items ({poItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-emerald-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <select
                        value={item.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded font-mono text-center"
                      />

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-mono">৳</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Unit Cost"
                          value={item.unitCost}
                          onChange={(e) => handleItemChange(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded font-mono"
                        />
                      </div>

                      <div className="w-24 text-right font-mono font-bold text-slate-900">
                        ৳{(item.quantity * item.unitCost).toLocaleString()}
                      </div>

                      {poItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Landed Shipping Costs Allocation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                <div>
                  <label className="block font-medium text-emerald-950 mb-1">
                    Shipping & Customs Charges (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={shippingCharges}
                    onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Will be allocated across {totalUnits} units (৳{totalUnits > 0 ? (shippingCharges / totalUnits).toFixed(2) : 0}/unit landed cost)
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-emerald-950 mb-1">
                    Paid Amount to Supplier (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg outline-none font-mono"
                  />
                  <div className="text-[11px] text-slate-600 mt-1 flex justify-between font-mono">
                    <span>Remaining Balance:</span>
                    <strong className="text-red-700">৳{(totalAmount - paidAmount).toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">PO Notes / Invoice Reference</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Yiwu Port container invoice #9921"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPOModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Purchase Order (৳{totalAmount.toLocaleString()})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add New Supplier Profile</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Haji Mohammad Rafiq"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="017XXXXXXXX or international"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Company / Trade Name</label>
                <input
                  type="text"
                  value={supCompany}
                  onChange={(e) => setSupCompany(e.target.value)}
                  placeholder="e.g. Chawkbazar Packaging Mart"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Address / Market</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Chawkbazar / Yiwu District"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Opening Payable Balance ৳</label>
                <input
                  type="number"
                  value={supBalance}
                  onChange={(e) => setSupBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
