import React, { useState } from 'react';
import { X, Plus, Trash2, AlertCircle, Sparkles } from 'lucide-react';
import { Product, Order } from '../types/database';
import { BANGLADESH_DISTRICTS, COURIER_PROVIDERS } from '../utils/districtData';
import { calculateAvailableStock } from '../utils/stockCalculations';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSubmitOrder: (orderData: any) => { success: boolean; order?: Order; error?: string; duplicateWarning?: string };
}

interface SelectedItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  products,
  onSubmitOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [deliveryZone, setDeliveryZone] = useState<'inside_dhaka' | 'sub_dhaka' | 'outside_dhaka'>('inside_dhaka');
  const [courierName, setCourierName] = useState('Steadfast');
  const [sourceChannel, setSourceChannel] = useState<'Facebook Page' | 'WhatsApp' | 'Website' | 'TikTok' | 'Direct Call' | 'Showroom'>('Facebook Page');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<SelectedItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(70);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [advanceMethod, setAdvanceMethod] = useState('bKash');

  const [validationError, setValidationError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  if (!isOpen) return null;

  // District changed: auto-update delivery zone and fee
  const handleDistrictChange = (distName: string) => {
    setDistrict(distName);
    const found = BANGLADESH_DISTRICTS.find((d) => d.name === distName);
    const zone = found ? found.defaultZone : 'outside_dhaka';
    setDeliveryZone(zone);
    const fee = zone === 'inside_dhaka' ? 70 : zone === 'sub_dhaka' ? 100 : 130;
    setDeliveryFee(fee);
  };

  const handleAddItem = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const existingIdx = items.findIndex((i) => i.productId === productId);
    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx].quantity += 1;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: prod.id,
          quantity: 1,
          unitPrice: prod.sellingPrice,
        },
      ]);
    }
  };

  const handleUpdateItem = (index: number, updates: Partial<SelectedItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const itemTotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const codAmount = Math.max(0, itemTotal - discount + deliveryFee - advancePaid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setDuplicateWarning('');

    // Validations
    if (!customerName.trim()) {
      setValidationError('Customer Name is required.');
      return;
    }
    const cleanPhone = customerPhone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 11) {
      setValidationError('Please enter a valid 11-digit Bangladeshi phone number (e.g. 01712345678).');
      return;
    }
    if (!fullAddress.trim()) {
      setValidationError('Delivery address is required.');
      return;
    }
    if (items.length === 0) {
      setValidationError('Please add at least one product to the order.');
      return;
    }

    // Check availability
    for (const it of items) {
      const prod = products.find((p) => p.id === it.productId);
      if (prod) {
        const available = calculateAvailableStock(prod.currentStock, prod.reservedStock);
        if (it.quantity > available) {
          setValidationError(`Insufficient available stock for "${prod.name}" (${available} available, ${it.quantity} requested).`);
          return;
        }
      }
    }

    const res = onSubmitOrder({
      customerName,
      customerPhone: cleanPhone,
      fullAddress,
      district,
      deliveryZone,
      courierName,
      sourceChannel,
      notes,
      items,
      discount,
      deliveryFeeCharged: deliveryFee,
      advancePaid,
      advancePaymentMethod: advancePaid > 0 ? advanceMethod : undefined,
    });

    if (res.success) {
      if (res.duplicateWarning) {
        alert(res.duplicateWarning);
      }
      onClose();
    } else {
      setValidationError(res.error || 'Failed to create order.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800/80 rounded-lg text-emerald-300">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Create Manual Order</h2>
              <p className="text-xs text-emerald-300/80">New Customer Order • Crystal Gift House</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-emerald-300 hover:text-white hover:bg-emerald-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Customer & Address Details */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              1. Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tanvir Ahmed"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Phone Number (11 digits) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="017XXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Delivery Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="House/Holding #, Road, Area, Thana"
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  District (Bangladesh) *
                </label>
                <select
                  value={district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                >
                  {BANGLADESH_DISTRICTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.banglaName}) - {d.division}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Delivery Zone & Default Rate
                </label>
                <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 flex items-center justify-between">
                  <span className="capitalize">{deliveryZone.replace('_', ' ')}</span>
                  <span className="font-mono font-bold text-emerald-800">৳{deliveryFee}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Items Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Order Products ({items.length})
              </h3>
              <div className="text-xs text-slate-500">
                Unit cost will be snapshotted from inventory WAC
              </div>
            </div>

            {/* Product Quick-Add Select */}
            <div className="flex gap-2 mb-3">
              <select
                id="product-select"
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="" disabled>
                  -- Select a product to add to order --
                </option>
                {products.map((p) => {
                  const avail = calculateAvailableStock(p.currentStock, p.reservedStock);
                  return (
                    <option key={p.id} value={p.id} disabled={avail <= 0}>
                      {p.name} ({p.sku}) - ৳{p.sellingPrice} [{avail} avail]
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Line Items Table */}
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No items added yet. Select a product above to add to this order.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 w-20">Qty</th>
                      <th className="px-3 py-2 w-28">Unit Price</th>
                      <th className="px-3 py-2 w-24">Subtotal</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => {
                      const prod = products.find((p) => p.id === it.productId);
                      const avail = prod ? calculateAvailableStock(prod.currentStock, prod.reservedStock) : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">{prod?.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              SKU: {prod?.sku} • Available: {avail}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              max={avail}
                              value={it.quantity}
                              onChange={(e) =>
                                handleUpdateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                              }
                              className="w-16 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-xs"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={it.unitPrice}
                              onChange={(e) =>
                                handleUpdateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })
                              }
                              className="w-24 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">
                            ৳{(it.quantity * it.unitPrice).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pricing, Discount, Delivery & Advance */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              3. Payment & Pricing Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Item Total (BDT)
                </label>
                <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-xs">
                  ৳{itemTotal.toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Special Discount (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Delivery Fee Charged (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Advance Paid (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono outline-none"
                />
              </div>

              {advancePaid > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Advance Payment Method
                  </label>
                  <select
                    value={advanceMethod}
                    onChange={(e) => setAdvanceMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                  >
                    <option value="bKash">bKash (Merchant / Personal)</option>
                    <option value="Nagad">Nagad (Merchant / Personal)</option>
                    <option value="Rocket">Rocket (DBBL)</option>
                    <option value="Bank">Bank Asia Transfer</option>
                    <option value="Cash">Cash in Hand</option>
                  </select>
                </div>
              )}

              <div className={advancePaid > 0 ? 'sm:col-span-2' : 'sm:col-span-4'}>
                <label className="block text-xs font-bold text-emerald-950 mb-1">
                  Net Cash On Delivery (COD Amount)
                </label>
                <div className="px-4 py-2.5 bg-emerald-900 text-white rounded-lg font-mono font-bold text-base flex items-center justify-between">
                  <span>Payable by Customer:</span>
                  <span>৳{codAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Logistics & Channel */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              4. Logistics & Channel Attribution
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assign Courier Partner *
                </label>
                <select
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                >
                  {COURIER_PROVIDERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Source Channel *
                </label>
                <select
                  value={sourceChannel}
                  onChange={(e) => setSourceChannel(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                >
                  <option value="Facebook Page">Facebook Page (Chat / Ads)</option>
                  <option value="WhatsApp">WhatsApp Direct</option>
                  <option value="Website">Website Web-Cart</option>
                  <option value="TikTok">TikTok Shop / Video</option>
                  <option value="Direct Call">Direct Phone Call</option>
                  <option value="Showroom">New Market Showroom</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Order Special Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Laser photo file uploaded on WhatsApp, deliver after 4 PM"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Create Order (৳{codAmount.toLocaleString()} COD)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
