import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Users,
  CheckCircle2,
  X,
  Trash2,
  Edit3,
  Search,
  Wallet,
  Building2,
  Phone,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { PurchaseOrder, Supplier, Product, BankCashAccount } from '../types/database';

interface PurchasesViewProps {
  purchases: PurchaseOrder[];
  suppliers: Supplier[];
  products: Product[];
  bankAccounts?: BankCashAccount[];
  onCreatePO: (po: any) => PurchaseOrder;
  onDeletePO?: (poId: string) => { success: boolean; error?: string };
  onReceiveGoods: (poId: string) => { success: boolean; error?: string };
  onSaveSupplier: (sup: any) => Supplier;
  onDeleteSupplier?: (supId: string) => { success: boolean };
  onRecordSupplierPayment?: (input: {
    supplierId: string;
    supplierName: string;
    amount: number;
    accountId: string;
    date: string;
    reference?: string;
    notes?: string;
  }) => { success: boolean; error?: string };
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  suppliers,
  products,
  bankAccounts = [],
  onCreatePO,
  onDeletePO,
  onReceiveGoods,
  onSaveSupplier,
  onDeleteSupplier,
  onRecordSupplierPayment,
}) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // PO Modal (Add & Edit)
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [poItems, setPoItems] = useState<Array<{ productId: string; quantity: number; unitCost: number }>>([
    { productId: products[0]?.id || '', quantity: 10, unitCost: products[0]?.purchaseCost || 300 },
  ]);

  // Supplier Modal (Add & Edit)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supBalance, setSupBalance] = useState<number>(0);
  const [supNotes, setSupNotes] = useState('');

  // Pay Supplier Modal
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payAccountId, setPayAccountId] = useState<string>(bankAccounts[0]?.id || '');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  // Confirmation Dialog state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setBannerMessage({ type, text });
    setTimeout(() => setBannerMessage(null), 4000);
  };

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.company.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  // Filtered POs
  const filteredPOs = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        (po.notes || '').toLowerCase().includes(q) ||
        po.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  }, [purchases, poSearch]);

  // KPIs
  const totalPayables = useMemo(() => suppliers.reduce((s, sup) => s + (sup.currentBalance || 0), 0), [suppliers]);
  const totalPOValue = useMemo(() => purchases.reduce((s, po) => s + po.totalAmount, 0), [purchases]);

  // Open New Supplier Modal
  const openAddSupplierModal = () => {
    setEditingSupplierId(null);
    setSupName('');
    setSupPhone('');
    setSupCompany('');
    setSupAddress('');
    setSupBalance(0);
    setSupNotes('');
    setIsSupplierModalOpen(true);
  };

  // Open Edit Supplier Modal
  const openEditSupplierModal = (sup: Supplier) => {
    setEditingSupplierId(sup.id);
    setSupName(sup.name);
    setSupPhone(sup.phone);
    setSupCompany(sup.company || '');
    setSupAddress(sup.address || '');
    setSupBalance(sup.currentBalance || 0);
    setSupNotes(sup.notes || '');
    setIsSupplierModalOpen(true);
  };

  const handleSubmitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supPhone.trim()) return;
    onSaveSupplier({
      id: editingSupplierId || undefined,
      name: supName.trim(),
      phone: supPhone.trim(),
      company: supCompany.trim(),
      address: supAddress.trim(),
      currentBalance: Number(supBalance) || 0,
      notes: supNotes.trim(),
    });
    setIsSupplierModalOpen(false);
    showNotice('success', editingSupplierId ? `Updated supplier "${supName.trim()}".` : `Added supplier "${supName.trim()}".`);
  };

  const handleDeleteSupplierClick = (sup: Supplier) => {
    setConfirmAction({
      title: 'Delete Supplier Profile',
      message: `Are you sure you want to delete "${sup.name}" (${sup.company || sup.phone})? The record will be moved to Trash and can be restored anytime.`,
      confirmLabel: 'Delete Supplier',
      isDestructive: true,
      onConfirm: () => {
        if (onDeleteSupplier) {
          onDeleteSupplier(sup.id);
          showNotice('success', `Supplier "${sup.name}" moved to Trash.`);
        }
        setConfirmAction(null);
      },
    });
  };

  const openPaySupplierModal = (sup: Supplier) => {
    setPayingSupplier(sup);
    setPayAmount(sup.currentBalance > 0 ? sup.currentBalance : 5000);
    setPayAccountId(bankAccounts[0]?.id || '');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRef('SUP-PAY-' + Date.now().toString().slice(-4));
    setPayNotes(`Payment to ${sup.name} (${sup.company || sup.phone})`);
  };

  const handlePaySupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || payAmount <= 0) return;
    if (onRecordSupplierPayment) {
      const res = onRecordSupplierPayment({
        supplierId: payingSupplier.id,
        supplierName: payingSupplier.name,
        amount: payAmount,
        accountId: payAccountId,
        date: payDate,
        reference: payRef,
        notes: payNotes,
      });
      if (!res.success) {
        showNotice('error', res.error || 'Failed to record supplier payment.');
        return;
      }
    } else {
      // Fallback: directly reduce supplier balance
      onSaveSupplier({
        ...payingSupplier,
        currentBalance: Math.max(0, payingSupplier.currentBalance - payAmount),
      });
    }
    showNotice('success', `Recorded Cash Out payment of ৳${payAmount.toLocaleString()} to ${payingSupplier.name}.`);
    setPayingSupplier(null);
  };

  // PO Modal helpers
  const openNewPOModal = () => {
    setEditingPOId(null);
    setSupplierId(suppliers[0]?.id || '');
    setPoDate(new Date().toISOString().split('T')[0]);
    setShippingCharges(0);
    setPaidAmount(0);
    setNotes('');
    setPoItems([
      { productId: products[0]?.id || '', quantity: 10, unitCost: products[0]?.purchaseCost || 300 },
    ]);
    setIsPOModalOpen(true);
  };

  const openEditPOModal = (po: PurchaseOrder) => {
    setEditingPOId(po.id);
    setSupplierId(po.supplierId);
    setPoDate(po.date);
    setShippingCharges(po.shippingCharges);
    setPaidAmount(po.paidAmount);
    setNotes(po.notes || '');
    setPoItems(
      po.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitCost: it.unitCost,
      }))
    );
    setIsPOModalOpen(true);
  };

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
      id: editingPOId || undefined,
      supplierId,
      supplierName: sup ? sup.name : 'Unknown Supplier',
      date: poDate,
      shippingCharges,
      paidAmount,
      notes,
      items: poItems,
    });
    setIsPOModalOpen(false);
    showNotice('success', editingPOId ? 'Purchase Order updated.' : 'New Purchase Order created.');
  };

  const handleDeletePOClick = (po: PurchaseOrder) => {
    setConfirmAction({
      title: 'Delete Purchase Order',
      message: `Delete Purchase Order ${po.poNumber} (${po.supplierName} • ৳${po.totalAmount.toLocaleString()})? ${
        po.status === 'received' ? 'Received stock quantities and supplier payable balance will be reversed.' : 'Outstanding supplier balance will be reversed.'
      }`,
      confirmLabel: 'Delete PO',
      isDestructive: true,
      onConfirm: () => {
        if (onDeletePO) {
          onDeletePO(po.id);
          showNotice('success', `Purchase Order ${po.poNumber} moved to Trash.`);
        }
        setConfirmAction(null);
      },
    });
  };

  const handleReceiveGoodsClick = (po: PurchaseOrder) => {
    setConfirmAction({
      title: 'Receive Purchase Order Goods',
      message: `Receive all ${po.items.reduce((s, i) => s + i.quantity, 0)} units from ${po.poNumber} into physical inventory and update Weighted-Average Cost?`,
      confirmLabel: 'Confirm Receipt',
      isDestructive: false,
      onConfirm: () => {
        const res = onReceiveGoods(po.id);
        if (res.success) {
          showNotice('success', `Goods from ${po.poNumber} received into stock.`);
        } else {
          showNotice('error', res.error || 'Failed to receive goods.');
        }
        setConfirmAction(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {bannerMessage && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button onClick={() => setBannerMessage(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-700" />
            <span>Suppliers & Purchase Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage local & import suppliers, track supplier payables, record purchase orders, and receive stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'suppliers' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Suppliers Directory ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'orders' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Purchase Orders ({purchases.length})
            </button>
          </div>

          <button
            onClick={openAddSupplierModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>

          <button
            onClick={openNewPOModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Order</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Suppliers</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">{suppliers.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Verified manufacturers & wholesalers</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Supplier Payable</span>
          <div className={`text-xl font-bold font-mono mt-1 ${totalPayables > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            ৳{totalPayables.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Outstanding dues owed to suppliers</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Purchase Orders</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">{purchases.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {purchases.filter((p) => p.status === 'received').length} received •{' '}
            {purchases.filter((p) => p.status === 'ordered').length} pending
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total PO Volume</span>
          <div className="text-xl font-bold font-mono text-emerald-800 mt-1">৳{totalPOValue.toLocaleString()}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Includes landed shipping & customs</p>
        </div>
      </div>

      {activeTab === 'suppliers' ? (
        /* Suppliers Directory */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Search supplier by name, phone, company, or address..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-600"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <strong>{filteredSuppliers.length}</strong> of {suppliers.length} suppliers
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Company / Trade Name</th>
                  <th className="px-4 py-3">Address / Market</th>
                  <th className="px-4 py-3 text-center">Linked Products</th>
                  <th className="px-4 py-3 text-right">Payable Balance</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No suppliers found matching your search. Click "Add Supplier" to create a new supplier record.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => {
                    const linkedCount = products.filter((p) => p.supplierId === s.id).length;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{s.phone}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{s.company || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{s.address || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono font-semibold text-[11px]">
                            {linkedCount} SKU{linkedCount === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          <span className={s.currentBalance > 0 ? 'text-red-600' : 'text-emerald-700'}>
                            ৳{(s.currentBalance || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={s.notes}>
                          {s.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {s.currentBalance > 0 && (
                              <button
                                onClick={() => openPaySupplierModal(s)}
                                title="Pay Supplier (Cash Out)"
                                className="px-2 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md flex items-center gap-1 cursor-pointer"
                              >
                                <Wallet className="w-3 h-3" />
                                <span>Pay</span>
                              </button>
                            )}
                            <button
                              onClick={() => openEditSupplierModal(s)}
                              title="Edit Supplier"
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplierClick(s)}
                              title="Delete Supplier"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Purchase Orders Table */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                placeholder="Search PO number, supplier, or product..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-600"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <strong>{filteredPOs.length}</strong> purchase orders
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Items & Landed Cost</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Shipping</th>
                  <th className="px-4 py-3 text-right">Total / Paid</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No purchase orders recorded yet. Click "New Purchase Order" to order or receive inventory.
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-950">{po.poNumber}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{po.date}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{po.supplierName}</td>
                      <td className="px-4 py-3">
                        {po.items.map((it) => (
                          <div key={it.id} className="text-[11px] text-slate-700">
                            <strong>{it.quantity}x</strong> {it.productName} @ ৳{it.landedUnitCost}/unit
                          </div>
                        ))}
                        {po.notes && <div className="text-[10px] text-slate-400 mt-0.5">{po.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        ৳{po.subtotal.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        ৳{po.shippingCharges.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <div className="font-bold text-emerald-900">৳{po.totalAmount.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">Paid: ৳{po.paidAmount.toLocaleString()}</div>
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
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {po.status === 'ordered' && (
                            <button
                              onClick={() => handleReceiveGoodsClick(po)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[11px] cursor-pointer"
                            >
                              Receive Goods
                            </button>
                          )}
                          <button
                            onClick={() => openEditPOModal(po)}
                            title="Edit Purchase Order"
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {onDeletePO && (
                            <button
                              onClick={() => handleDeletePOClick(po)}
                              title="Delete Purchase Order"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Purchase Order Modal */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
              <h3 className="font-bold text-sm">
                {editingPOId ? 'Edit Supplier Purchase Order' : 'Create Supplier Purchase Order'}
              </h3>
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
                        {s.name} ({s.company || s.phone})
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
                    Allocated across {totalUnits} units (৳{totalUnits > 0 ? (shippingCharges / totalUnits).toFixed(2) : 0}/unit landed cost)
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
                    <strong className="text-red-700">৳{Math.max(0, totalAmount - paidAmount).toLocaleString()}</strong>
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
                  {editingPOId ? 'Update Purchase Order' : `Save Purchase Order (৳${totalAmount.toLocaleString()})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingSupplierId ? 'Edit Supplier Profile' : 'Add New Supplier Profile'}
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Supplier / Contact Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Haji Mohammad Rafiq"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-600"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Company / Trade Name</label>
                <input
                  type="text"
                  value={supCompany}
                  onChange={(e) => setSupCompany(e.target.value)}
                  placeholder="e.g. Chawkbazar Packaging Mart"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Address / Market Location</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Chawkbazar, Old Dhaka / Yiwu District"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {editingSupplierId ? 'Current Payable Balance (৳ BDT)' : 'Opening Payable Balance (৳ BDT)'}
                </label>
                <input
                  type="number"
                  value={supBalance}
                  onChange={(e) => setSupBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes / Products Supplied</label>
                <textarea
                  rows={2}
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="Bank/bKash payment details, lead time, or product specialties..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-600"
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
                  {editingSupplierId ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier (Cash Out) Modal */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Record Supplier Payment (Cash Out)</h3>
              <button onClick={() => setPayingSupplier(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplierSubmit} className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{payingSupplier.name}</div>
                  <div className="text-[11px] text-slate-500">{payingSupplier.company || payingSupplier.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Current Due</div>
                  <div className="font-mono font-bold text-red-600 text-sm">
                    ৳{payingSupplier.currentBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Payment Amount (৳) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              {bankAccounts.length > 0 && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pay From Account (Cash Out) *</label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} — Available: ৳{acc.balance.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Reference / Voucher #</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. bKash TrxID or Bank Transfer Ref"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Confirm Payment (৳{payAmount.toLocaleString()})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg ${
                  confirmAction.isDestructive ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{confirmAction.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{confirmAction.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer ${
                  confirmAction.isDestructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
