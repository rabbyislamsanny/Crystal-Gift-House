import React from 'react';
import { X, Printer } from 'lucide-react';
import { Order, AppSettings } from '../types/database';

interface PrintInvoiceModalProps {
  order: Order | null;
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  order,
  settings,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Modal Controls (Hidden in Print) */}
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between">
          <span className="font-semibold text-xs">Print Delivery Slip / Invoice</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Document</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Slip Content */}
        <div className="flex-1 overflow-y-auto p-8 text-slate-900 font-sans print:p-0">
          <div className="border border-slate-300 p-6 rounded-lg print:border-none print:p-0 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-emerald-950 uppercase">
                  {settings.businessName}
                </h1>
                <p className="text-xs text-slate-600 font-medium">{settings.banglaBusinessName}</p>
                <p className="text-xs text-slate-500 mt-1">{settings.address}</p>
                <p className="text-xs text-slate-500 font-mono">Hotline: {settings.phone}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono text-emerald-900">
                  {order.orderNumber}
                </div>
                <div className="text-xs text-slate-500">
                  Date: {new Date(order.orderDate).toLocaleDateString()}
                </div>
                <div className="mt-2 inline-block px-2 py-0.5 text-xs font-bold uppercase rounded border border-slate-300 bg-slate-50 font-mono">
                  {order.courierName} COD
                </div>
              </div>
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Deliver To:</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{order.customerName}</div>
                <div className="font-mono font-semibold text-slate-800 mt-0.5">{order.customerPhone}</div>
                <div className="text-slate-600 mt-1 leading-relaxed">
                  {order.fullAddress}, <strong className="text-slate-900">{order.district}</strong>
                </div>
              </div>
              <div className="text-right flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Tracking / Consignment</span>
                  <div className="font-mono font-bold text-sm text-slate-900 mt-0.5">
                    {order.consignmentNumber || 'PENDING ASSIGNMENT'}
                  </div>
                </div>
                <div className="mt-3 p-2 bg-emerald-100/70 border border-emerald-300 rounded text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-900">COD Collection:</span>
                  <div className="text-lg font-bold font-mono text-emerald-950">
                    ৳{order.codAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5 font-mono">SKU</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Price</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2.5 font-medium">{it.productName}</td>
                      <td className="p-2.5 font-mono text-slate-500">{it.sku}</td>
                      <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                      <td className="p-2.5 text-right font-mono">৳{it.unitPrice}</td>
                      <td className="p-2.5 text-right font-mono font-semibold">
                        ৳{it.subtotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs space-y-1 text-right font-mono">
                <div>Item Subtotal: ৳{order.itemTotal.toLocaleString()}</div>
                {order.discount > 0 && <div className="text-red-600">Discount: -৳{order.discount}</div>}
                <div>Delivery Fee: +৳{order.deliveryFeeCharged}</div>
                {order.advancePaid > 0 && (
                  <div className="text-emerald-700">
                    Advance Paid ({order.advancePaymentMethod}): -৳{order.advancePaid}
                  </div>
                )}
                <div className="text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                  Net Amount Payable (COD): ৳{order.codAmount.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Note & Footer */}
            {order.notes && (
              <div className="text-xs p-2 bg-amber-50 rounded border border-amber-200 text-amber-900">
                <strong>Special Instructions:</strong> {order.notes}
              </div>
            )}

            <div className="text-[10px] text-center text-slate-400 pt-3 border-t border-slate-100">
              Thank you for ordering with Crystal Gift House! For queries or claims, contact {settings.phone}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
