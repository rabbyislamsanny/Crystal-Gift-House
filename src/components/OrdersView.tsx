import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  ShoppingCart,
  Phone,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { Order, OrderStatus } from '../types/database';

interface OrdersViewProps {
  orders: Order[];
  onOpenNewOrder: () => void;
  onSelectOrder: (order: Order) => void;
  onBulkUpdateStatus: (orderIds: string[], newStatus: OrderStatus) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onOpenNewOrder,
  onSelectOrder,
  onBulkUpdateStatus,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtered orders
  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (courierFilter !== 'all' && o.courierName !== courierFilter) return false;
    if (districtFilter !== 'all' && o.district !== districtFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchPhone = o.customerPhone.includes(q);
      const matchConsign = o.consignmentNumber && o.consignmentNumber.toLowerCase().includes(q);
      if (!matchNum && !matchName && !matchPhone && !matchConsign) return false;
    }

    return true;
  });

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((o) => o.id));
    }
  };

  const statusBadges: Record<OrderStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-800' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-800' },
    processing: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
    packed: { bg: 'bg-sky-100', text: 'text-sky-800' },
    shipped: { bg: 'bg-teal-100', text: 'text-teal-800' },
    delivered: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
    return_requested: { bg: 'bg-orange-100', text: 'text-orange-800' },
    returned: { bg: 'bg-purple-100', text: 'text-purple-800' },
    partially_returned: { bg: 'bg-violet-100', text: 'text-violet-800' },
  };

  const exportOrdersCSV = () => {
    const headers = ['Order Number', 'Date', 'Customer', 'Phone', 'Address', 'District', 'Zone', 'Courier', 'Consignment', 'Item Total', 'Discount', 'Delivery Fee', 'Advance Paid', 'COD Amount', 'Status'];
    const rows = filtered.map((o) => [
      o.orderNumber,
      o.orderDate.slice(0, 10),
      `"${o.customerName}"`,
      o.customerPhone,
      `"${o.fullAddress.replace(/"/g, '""')}"`,
      o.district,
      o.deliveryZone,
      o.courierName,
      o.consignmentNumber || '',
      o.itemTotal,
      o.discount,
      o.deliveryFeeCharged,
      o.advancePaid,
      o.codAmount,
      o.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crystal_gift_house_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-700" />
            <span>Order Management</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-mono font-normal text-slate-600">
              {filtered.length} Orders
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full manual order lifecycle: pending confirmation, reservation, dispatch, delivery & returns
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportOrdersCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Customer Name, Phone 01XXXXXXXXX, Order #, Tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={courierFilter}
              onChange={(e) => setCourierFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium outline-none"
            >
              <option value="all">All Couriers</option>
              <option value="Steadfast">Steadfast</option>
              <option value="Pathao">Pathao</option>
              <option value="RedX">RedX</option>
              <option value="eCourier">eCourier</option>
              <option value="Paperfly">Paperfly</option>
              <option value="Sundarban">Sundarban</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Confirmation</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="returned">Returned</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar if items selected */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
            <span className="font-semibold text-emerald-900">
              {selectedIds.length} orders selected
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Bulk action:</span>
              <button
                onClick={() => {
                  onBulkUpdateStatus(selectedIds, 'confirmed');
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 cursor-pointer"
              >
                Mark Confirmed
              </button>
              <button
                onClick={() => {
                  onBulkUpdateStatus(selectedIds, 'packed');
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 bg-sky-600 text-white font-semibold rounded hover:bg-sky-700 cursor-pointer"
              >
                Mark Packed
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-slate-600 hover:text-slate-900"
              >
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-3">Order #</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Customer Details</th>
                <th className="px-3 py-3">Items & Snapshot</th>
                <th className="px-3 py-3">Courier / Consignment</th>
                <th className="px-3 py-3 text-right">COD Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No orders matching selected criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((ord) => {
                  const badge = statusBadges[ord.status] || { bg: 'bg-slate-100', text: 'text-slate-800' };
                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ord.id)}
                          onChange={() => handleToggleSelect(ord.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-emerald-950">
                        {ord.orderNumber}
                      </td>
                      <td className="px-3 py-3 text-slate-500 font-mono whitespace-nowrap">
                        {ord.orderDate.slice(0, 10)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{ord.customerName}</div>
                        <div className="text-[11px] font-mono text-slate-600">{ord.customerPhone}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">
                          {ord.district} • {ord.fullAddress}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {ord.items.map((it) => (
                          <div key={it.id} className="text-slate-700 text-[11px]">
                            <strong className="text-slate-900 font-mono">{it.quantity}x</strong> {it.productName}
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800">{ord.courierName}</div>
                        {ord.consignmentNumber ? (
                          <div className="text-[10px] text-emerald-700 font-mono font-semibold">
                            {ord.consignmentNumber}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">Unassigned</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                        ৳{ord.codAmount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${badge.bg} ${badge.text}`}
                        >
                          {ord.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => onSelectOrder(ord)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="View order details and status timeline"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
