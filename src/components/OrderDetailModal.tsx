import React, { useState } from 'react';
import {
  X,
  Printer,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Package,
  AlertTriangle,
  User,
  MapPin,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { Order, OrderStatus, ReturnDisposition } from '../types/database';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (params: {
    orderId: string;
    newStatus: OrderStatus;
    note?: string;
    returnDisposition?: ReturnDisposition;
    cancelReason?: string;
  }) => { success: boolean; error?: string };
  onPrintInvoice: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onPrintInvoice,
}) => {
  const [transitionStatus, setTransitionStatus] = useState<OrderStatus | ''>('');
  const [transitionNote, setTransitionNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [returnDisposition, setReturnDisposition] = useState<ReturnDisposition>('restock');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !order) return null;

  const handleApplyStatusChange = () => {
    if (!transitionStatus) return;
    setErrorMessage('');

    if (transitionStatus === 'cancelled' && !cancelReason.trim()) {
      setErrorMessage('Please provide a reason for cancelling this order.');
      return;
    }

    const res = onUpdateStatus({
      orderId: order.id,
      newStatus: transitionStatus,
      note: transitionNote,
      returnDisposition: transitionStatus === 'returned' ? returnDisposition : undefined,
      cancelReason: transitionStatus === 'cancelled' ? cancelReason : undefined,
    });

    if (res.success) {
      setTransitionStatus('');
      setTransitionNote('');
      setCancelReason('');
    } else {
      setErrorMessage(res.error || 'Failed to update order status');
    }
  };

  const statusColors: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-900 border-amber-300',
    confirmed: 'bg-blue-100 text-blue-900 border-blue-300',
    processing: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    packed: 'bg-sky-100 text-sky-900 border-sky-300',
    shipped: 'bg-teal-100 text-teal-900 border-teal-300',
    delivered: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    cancelled: 'bg-red-100 text-red-900 border-red-300',
    return_requested: 'bg-orange-100 text-orange-900 border-orange-300',
    returned: 'bg-purple-100 text-purple-900 border-purple-300',
    partially_returned: 'bg-violet-100 text-violet-900 border-violet-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono tracking-tight">
                  {order.orderNumber}
                </h2>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    statusColors[order.status]
                  }`}
                >
                  {order.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Created: {new Date(order.orderDate).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} • Source: {order.sourceChannel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintInvoice(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-emerald-300 hover:text-white hover:bg-emerald-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Grid: Customer Info & Status Action Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer & Delivery Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span>Customer & Destination</span>
              </h3>
              <div className="space-y-1.5">
                <div className="text-sm font-bold text-slate-900">{order.customerName}</div>
                <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.customerPhone}</span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-600 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {order.fullAddress}, <strong className="text-slate-800">{order.district}</strong> ({order.deliveryZone.replace('_', ' ')})
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-600">
                  <span>Assigned Courier:</span>
                  <span className="font-semibold text-slate-900">{order.courierName}</span>
                </div>
                {order.consignmentNumber && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Consignment / Tracking:</span>
                    <span className="font-mono font-semibold text-emerald-800">{order.consignmentNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Transition Control Card */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
              <h3 className="font-bold text-emerald-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Change Order Status</span>
              </h3>
              <p className="text-slate-600">
                Current status is <strong className="capitalize">{order.status.replace('_', ' ')}</strong>. Select next stage:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {order.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTransitionStatus('confirmed')}
                      className={`p-2 rounded-lg border text-left font-semibold cursor-pointer ${
                        transitionStatus === 'confirmed' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      Confirm Order
                      <div className="text-[10px] font-normal opacity-80">Reserves stock</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransitionStatus('cancelled')}
                      className={`p-2 rounded-lg border text-left font-semibold cursor-pointer ${
                        transitionStatus === 'cancelled' ? 'bg-red-600 text-white' : 'bg-white hover:bg-slate-50 text-red-700'
                      }`}
                    >
                      Cancel Order
                      <div className="text-[10px] font-normal opacity-80">Releases reservation</div>
                    </button>
                  </>
                )}

                {['confirmed', 'processing', 'packed'].includes(order.status) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTransitionStatus('shipped')}
                      className={`p-2 rounded-lg border text-left font-semibold cursor-pointer ${
                        transitionStatus === 'shipped' ? 'bg-teal-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      Dispatch / Ship
                      <div className="text-[10px] font-normal opacity-80">Deducts stock & creates parcel</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransitionStatus('cancelled')}
                      className={`p-2 rounded-lg border text-left font-semibold cursor-pointer ${
                        transitionStatus === 'cancelled' ? 'bg-red-600 text-white' : 'bg-white hover:bg-slate-50 text-red-700'
                      }`}
                    >
                      Cancel Order
                      <div className="text-[10px] font-normal opacity-80">Releases stock reservation</div>
                    </button>
                  </>
                )}

                {order.status === 'shipped' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTransitionStatus('delivered')}
                      className={`p-2 rounded-lg border text-left font-semibold cursor-pointer ${
                        transitionStatus === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      Mark Delivered
                      <div className="text-[10px] font-normal opacity-80">Realizes net sale & COD receivable</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransitionStatus('returned')}
                      className={`p-2 rounded-lg border text-left font-semibold cursor-pointer ${
                        transitionStatus === 'returned' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-50 text-purple-800'
                      }`}
                    >
                      Process Return
                      <div className="text-[10px] font-normal opacity-80">Requires quality inspection</div>
                    </button>
                  </>
                )}

                {['delivered', 'cancelled', 'returned'].includes(order.status) && (
                  <div className="col-span-2 text-slate-500 italic p-2 bg-white rounded border border-slate-200 text-center">
                    This order is in terminal state ({order.status}). Audit trail is locked.
                  </div>
                )}
              </div>

              {/* Conditional Return Inspection Form */}
              {transitionStatus === 'returned' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2 mt-2">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-purple-700" />
                    <span>Return Quality Inspection Rule *</span>
                  </div>
                  <p className="text-purple-800">
                    Never automatically add damaged goods to sellable stock. Choose inspection disposition:
                  </p>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="returnDisposition"
                        value="restock"
                        checked={returnDisposition === 'restock'}
                        onChange={() => setReturnDisposition('restock')}
                      />
                      <span><strong>Restock to Inventory:</strong> Product is pristine & sellable.</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="returnDisposition"
                        value="damaged"
                        checked={returnDisposition === 'damaged'}
                        onChange={() => setReturnDisposition('damaged')}
                      />
                      <span><strong>Damaged / Broken:</strong> Write off to Damaged Stock ledger. NOT sellable.</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="returnDisposition"
                        value="scrap"
                        checked={returnDisposition === 'scrap'}
                        onChange={() => setReturnDisposition('scrap')}
                      />
                      <span><strong>Scrap / Lost in Transit:</strong> Destroyed or non-recoverable.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Cancellation Reason Input */}
              {transitionStatus === 'cancelled' && (
                <div className="mt-2">
                  <label className="block font-medium text-red-900 mb-1">
                    Mandatory Cancellation Reason *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Customer cancelled via phone, out of stock, fake address"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-red-200 rounded-lg outline-none"
                  />
                </div>
              )}

              {/* Transition Note Input */}
              {transitionStatus && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Optional note for status timeline..."
                    value={transitionNote}
                    onChange={(e) => setTransitionNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyStatusChange}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Apply Change
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table with Cost Snapshot */}
          <div>
            <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-[11px]">
              Order Items & Historical Cost Snapshots
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5 text-center">Quantity</th>
                    <th className="px-4 py-2.5 text-right">Unit Sale Price</th>
                    <th className="px-4 py-2.5 text-right">Snapshot Unit Cost</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{it.productName}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{it.sku}</td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-800">
                        {it.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900">
                        ৳{it.unitPrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500" title="Historical WAC at sale">
                        ৳{it.unitCostSnapshot.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-800">
                        ৳{it.subtotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Order Financial Summary Bar */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 font-mono">
                <div className="flex items-center gap-4 text-slate-600">
                  <span>Items: <strong>৳{order.itemTotal.toLocaleString()}</strong></span>
                  <span>Discount: <strong className="text-red-600">-৳{order.discount}</strong></span>
                  <span>Delivery: <strong>+৳{order.deliveryFeeCharged}</strong></span>
                  <span>Advance: <strong className="text-emerald-700">-৳{order.advancePaid}</strong></span>
                </div>
                <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <span>COD Payable:</span>
                  <span className="text-base px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                    ৳{order.codAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Timeline History */}
          <div>
            <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Immutable Status Audit Timeline</span>
            </h3>
            <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-2">
              {order.statusTimeline.map((record, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-600 border-2 border-white"></div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-bold capitalize text-slate-900">
                        {record.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(record.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} • {record.changedBy}
                      </span>
                    </div>
                    {record.note && (
                      <p className="text-slate-600 mt-1 text-[11px]">{record.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Order ID: {order.id} • District Zone: {order.deliveryZone}
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
