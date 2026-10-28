import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  History,
  FileSpreadsheet,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Product, StockMovement, Supplier } from '../types/database';
import { calculateAvailableStock } from '../utils/stockCalculations';

interface InventoryViewProps {
  products: Product[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  onSaveProduct: (productData: any) => Product;
  onDeleteProduct?: (productId: string) => { success: boolean; error?: string };
  onAdjustStock: (params: { productId: string; newOnHand: number; reason: string }) => { success: boolean; error?: string };
  selectedProduct?: Product | null;
  onClearSelectedProduct?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  stockMovements,
  suppliers,
  onSaveProduct,
  onDeleteProduct,
  onAdjustStock,
  selectedProduct,
  onClearSelectedProduct,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'ledger'>('products');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockInput, setNewStockInput] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState('');

  // Product form state
  const [name, setName] = useState('');
  const [banglaName, setBanglaName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Table Lamps');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [packagingCost, setPackagingCost] = useState<number>(40);
  const [notes, setNotes] = useState('');

  const openNewProductModal = () => {
    setEditingProduct(null);
    setName('');
    setBanglaName('');
    setSku('CGH-' + Math.floor(1000 + Math.random() * 9000));
    setCategory('Table Lamps');
    setSupplierId(suppliers[0]?.id || '');
    setPurchaseCost(300);
    setSellingPrice(500);
    setOpeningStock(10);
    setLowStockThreshold(3);
    setPackagingCost(40);
    setNotes('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setBanglaName(p.banglaName || '');
    setSku(p.sku);
    setCategory(p.category);
    setSupplierId(p.supplierId);
    setPurchaseCost(p.purchaseCost);
    setSellingPrice(p.sellingPrice);
    setOpeningStock(p.openingStock);
    setLowStockThreshold(p.lowStockThreshold);
    setPackagingCost(p.packagingCost);
    setNotes(p.notes || '');
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === supplierId);
    onSaveProduct({
      id: editingProduct ? editingProduct.id : undefined,
      sku,
      name,
      banglaName,
      category,
      supplierId,
      supplierName: sup ? sup.name : 'Direct Import',
      purchaseCost,
      sellingPrice,
      openingStock,
      currentStock: editingProduct ? editingProduct.currentStock : openingStock,
      lowStockThreshold,
      packagingCost,
      notes,
    });
    setIsProductModalOpen(false);
  };

  const openAdjustModal = (p: Product) => {
    setAdjustingProduct(p);
    setNewStockInput(p.currentStock);
    setAdjustReason('Physical inventory audit count');
    setAdjustError('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (!adjustReason.trim()) {
      setAdjustError('Please provide an adjustment reason.');
      return;
    }
    const res = onAdjustStock({
      productId: adjustingProduct.id,
      newOnHand: newStockInput,
      reason: adjustReason,
    });
    if (res.success) {
      setIsAdjustModalOpen(false);
    } else {
      setAdjustError(res.error || 'Adjustment failed');
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    const avail = calculateAvailableStock(p.currentStock, p.reservedStock);
    if (lowStockOnly && avail > p.lowStockThreshold) return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchBn = p.banglaName && p.banglaName.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchBn) return false;
    }
    return true;
  });

  // Unique categories
  const categories = Array.from(new Set(products.map((p) => p.category)));

  // Valuation metrics
  const totalValuation = products.reduce((sum, p) => sum + p.currentStock * p.purchaseCost, 0);
  const totalOnHandUnits = products.reduce((sum, p) => sum + p.currentStock, 0);
  const totalReservedUnits = products.reduce((sum, p) => sum + p.reservedStock, 0);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-700" />
            <span>Product Catalog & Stock Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Weighted-average cost (WAC) valuation, reservation tracking & immutable movement ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              onClick={() => setActiveSubTab('products')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                activeSubTab === 'products' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Products ({products.length})
            </button>
            <button
              onClick={() => setActiveSubTab('ledger')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                activeSubTab === 'ledger' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Movement Ledger ({stockMovements.length})
            </button>
          </div>

          <button
            onClick={openNewProductModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Valuation Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <span className="text-slate-500 text-xs">Total Stock Valuation (WAC)</span>
          <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
            ৳{Math.round(totalValuation).toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-slate-500 text-xs">Total Physical On-Hand</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {totalOnHandUnits} units
          </div>
        </div>
        <div>
          <span className="text-slate-500 text-xs">Reserved for Orders</span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
            {totalReservedUnits} units
          </div>
        </div>
        <div>
          <span className="text-slate-500 text-xs">Net Available to Sell</span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
            {totalOnHandUnits - totalReservedUnits} units
          </div>
        </div>
      </div>

      {activeSubTab === 'products' ? (
        <>
          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Product Name, Bangla Name, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                  lowStockOnly
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Low Stock Only</span>
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">SKU & Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">WAC Cost</th>
                    <th className="px-4 py-3 text-right">Sale Price</th>
                    <th className="px-4 py-3 text-center">On-Hand</th>
                    <th className="px-4 py-3 text-center">Reserved</th>
                    <th className="px-4 py-3 text-center">Available</th>
                    <th className="px-4 py-3 text-right">Stock Value</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const avail = calculateAvailableStock(p.currentStock, p.reservedStock);
                    const isLow = avail <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {p.banglaName && (
                            <div className="text-[11px] text-emerald-800 font-medium">
                              {p.banglaName}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            SKU: {p.sku} • Supplier: {p.supplierName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.category}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          ৳{p.purchaseCost.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          ৳{p.sellingPrice.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-800">
                          {p.currentStock}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-blue-700">
                          {p.reservedStock > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 font-bold">
                              {p.reservedStock}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                              avail === 0
                                ? 'bg-red-100 text-red-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {avail} {isLow ? '⚠️' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-950">
                          ৳{Math.round(p.currentStock * p.purchaseCost).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openAdjustModal(p)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-[11px] cursor-pointer"
                              title="Audit stock count adjustment"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => openEditProductModal(p)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded text-[11px] cursor-pointer"
                            >
                              Edit
                            </button>
                            {onDeleteProduct && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete product "${p.name}" (${p.sku})?`)) {
                                    const res = onDeleteProduct(p.id);
                                    if (!res.success && res.error) {
                                      alert(res.error);
                                    }
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Stock Movement Ledger Table */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Immutable Stock Movement Ledger</h3>
              <p className="text-xs text-slate-500">Every inventory receipt, reservation, dispatch, and return disposition recorded</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Movement Type</th>
                  <th className="px-4 py-3 text-center">Change Qty</th>
                  <th className="px-4 py-3 text-center">On-Hand (Prev → New)</th>
                  <th className="px-4 py-3 text-center">Reserved (Prev → New)</th>
                  <th className="px-4 py-3">Reason / Reference</th>
                  <th className="px-4 py-3">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {stockMovements.map((mov) => {
                  const isPositive = ['purchase_receipt', 'return_restock'].includes(mov.movementType);
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(mov.date).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold text-slate-900">
                        {mov.productName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                            mov.movementType === 'purchase_receipt'
                              ? 'bg-emerald-100 text-emerald-800'
                              : mov.movementType === 'reservation'
                              ? 'bg-blue-100 text-blue-800'
                              : mov.movementType === 'dispatch'
                              ? 'bg-teal-100 text-teal-800'
                              : mov.movementType === 'return_restock'
                              ? 'bg-purple-100 text-purple-800'
                              : mov.movementType === 'damage_writeoff'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {mov.movementType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        <span className={isPositive ? 'text-emerald-700' : 'text-slate-800'}>
                          {isPositive ? '+' : ''}{mov.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">
                        {mov.previousOnHand} → <strong>{mov.newOnHand}</strong>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">
                        {mov.previousReserved} → <strong>{mov.newReserved}</strong>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-600 max-w-xs truncate">
                        {mov.reason}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-500">
                        {mov.performedBy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
              <h3 className="font-bold text-sm">
                {editingProduct ? 'Edit Product & Pricing' : 'Add New Crystal Product'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Product Title (English) *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 3D Crystal Lotus Flower LED Lamp"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Bangla Name (Optional)</label>
                  <input
                    type="text"
                    value={banglaName}
                    onChange={(e) => setBanglaName(e.target.value)}
                    placeholder="e.g. ৩ডি ক্রিস্টাল পদ্মফুল বাতি"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Table Lamps, Cubes, Night Lights"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Supplier *</label>
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
                  <label className="block font-medium text-slate-700 mb-1">Purchase Cost (WAC) ৳ *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Selling Price (BDT) ৳ *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Opening Stock (Units)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={openingStock}
                      onChange={(e) => setOpeningStock(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Box & Packaging Cost ৳</label>
                  <input
                    type="number"
                    min="0"
                    value={packagingCost}
                    onChange={(e) => setPackagingCost(parseFloat(e.target.value) || 40)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Notes / Description</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Product specifications, laser engraving instructions..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Adjust Stock Count</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4 text-xs">
              {adjustError && (
                <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg">
                  {adjustError}
                </div>
              )}

              <div>
                <span className="text-slate-500">Target Product:</span>
                <div className="font-bold text-slate-900 text-sm">{adjustingProduct.name}</div>
                <div className="text-slate-500 font-mono">Current Physical On-Hand: {adjustingProduct.currentStock} units</div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">New Audited Stock Count *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newStockInput}
                  onChange={(e) => setNewStockInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Audit Reason / Justification *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical inventory count discrepancy, showroom sample taken"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
