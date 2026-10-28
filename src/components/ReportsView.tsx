import React, { useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Truck,
  TrendingUp,
  Package,
} from 'lucide-react';
import {
  Order,
  Product,
  Parcel,
  AdExpense,
  OperatingExpense,
} from '../types/database';

interface ReportsViewProps {
  orders: Order[];
  products: Product[];
  parcels: Parcel[];
  adExpenses: AdExpense[];
  operatingExpenses: OperatingExpense[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  orders,
  products,
  parcels,
  adExpenses,
  operatingExpenses,
}) => {
  const [reportDimension, setReportDimension] = useState<'product' | 'courier' | 'channel' | 'district'>('product');

  // Product-wise aggregation
  const productReportData = products.map((prod) => {
    let unitsSold = 0;
    let grossSales = 0;
    let unitsDelivered = 0;
    let deliveredSales = 0;
    let deliveredCost = 0;

    for (const ord of orders) {
      const it = ord.items.find((i) => i.productId === prod.id);
      if (it) {
        unitsSold += it.quantity;
        grossSales += it.subtotal;
        if (ord.status === 'delivered') {
          unitsDelivered += it.quantity;
          deliveredSales += it.subtotal;
          deliveredCost += it.quantity * it.unitCostSnapshot;
        }
      }
    }

    const grossProfit = deliveredSales - deliveredCost;
    const margin = deliveredSales > 0 ? (grossProfit / deliveredSales) * 100 : 0;

    return {
      id: prod.id,
      name: prod.name,
      sku: prod.sku,
      category: prod.category,
      currentStock: prod.currentStock,
      wacCost: prod.purchaseCost,
      sellingPrice: prod.sellingPrice,
      unitsSold,
      grossSales,
      unitsDelivered,
      deliveredSales,
      deliveredCost,
      grossProfit,
      margin,
    };
  });

  // Courier performance aggregation
  const couriersList = ['Steadfast', 'Pathao', 'RedX', 'eCourier', 'Paperfly', 'Sundarban'];
  const courierReportData = couriersList.map((cName) => {
    const courierParcels = parcels.filter((p) => p.courierName === cName);
    const totalParcels = courierParcels.length;
    const deliveredCount = courierParcels.filter((p) => p.status === 'delivered' || p.status === 'settled').length;
    const returnedCount = courierParcels.filter((p) => p.status === 'returned').length;
    const inTransitCount = courierParcels.filter((p) => p.status === 'in_transit').length;
    const totalCOD = courierParcels.reduce((s, p) => s + p.codAmount, 0);
    const totalFees = courierParcels.reduce((s, p) => s + p.deliveryCharge + (p.returnCharge || 0), 0);
    const deliveryRate = totalParcels > 0 ? (deliveredCount / totalParcels) * 100 : 0;
    const returnRate = totalParcels > 0 ? (returnedCount / totalParcels) * 100 : 0;

    return {
      name: cName,
      totalParcels,
      deliveredCount,
      returnedCount,
      inTransitCount,
      totalCOD,
      totalFees,
      deliveryRate,
      returnRate,
    };
  });

  // Channel breakdown
  const channels = ['Facebook Page', 'WhatsApp', 'Website', 'TikTok', 'Direct Call', 'Showroom'];
  const channelReportData = channels.map((ch) => {
    const chOrders = orders.filter((o) => o.sourceChannel === ch);
    const totalOrders = chOrders.length;
    const deliveredOrders = chOrders.filter((o) => o.status === 'delivered').length;
    const totalSales = chOrders.reduce((s, o) => s + o.itemTotal, 0);
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    return {
      channel: ch,
      totalOrders,
      deliveredOrders,
      totalSales,
      avgOrderValue,
    };
  });

  // Export CSV based on current dimension
  const exportCurrentReport = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = '';

    if (reportDimension === 'product') {
      headers = ['SKU', 'Product Name', 'Category', 'Units Delivered', 'Delivered Sales', 'COGS', 'Gross Profit', 'Margin %', 'Current Stock'];
      rows = productReportData.map((p) => [
        p.sku,
        `"${p.name}"`,
        p.category,
        p.unitsDelivered,
        p.deliveredSales,
        p.deliveredCost,
        p.grossProfit,
        p.margin.toFixed(1) + '%',
        p.currentStock,
      ]);
      filename = 'cgh_product_performance_report.csv';
    } else if (reportDimension === 'courier') {
      headers = ['Courier', 'Total Parcels', 'Delivered', 'Returned', 'In Transit', 'Total COD', 'Courier Fees', 'Delivery Success Rate %'];
      rows = courierReportData.map((c) => [
        c.name,
        c.totalParcels,
        c.deliveredCount,
        c.returnedCount,
        c.inTransitCount,
        c.totalCOD,
        c.totalFees,
        c.deliveryRate.toFixed(1) + '%',
      ]);
      filename = 'cgh_courier_performance_report.csv';
    } else {
      headers = ['Source Channel', 'Total Orders', 'Delivered Orders', 'Total Sales', 'Average Order Value'];
      rows = channelReportData.map((ch) => [
        ch.channel,
        ch.totalOrders,
        ch.deliveredOrders,
        ch.totalSales,
        Math.round(ch.avgOrderValue),
      ]);
      filename = 'cgh_channel_attribution_report.csv';
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
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
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <span>Reports & Performance Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Detailed breakdown by Product SKU, Courier Success Rate, and Social Channel Attribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Dimension Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              onClick={() => setReportDimension('product')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                reportDimension === 'product' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Product Performance
            </button>
            <button
              onClick={() => setReportDimension('courier')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                reportDimension === 'courier' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Courier Rates
            </button>
            <button
              onClick={() => setReportDimension('channel')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                reportDimension === 'channel' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
              }`}
            >
              Channels
            </button>
          </div>

          <button
            onClick={exportCurrentReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Reports Table based on active dimension */}
      {reportDimension === 'product' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Product Name & SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Delivered Qty</th>
                  <th className="px-4 py-3 text-right">Delivered Revenue</th>
                  <th className="px-4 py-3 text-right">COGS Cost</th>
                  <th className="px-4 py-3 text-right">Gross Profit</th>
                  <th className="px-4 py-3 text-center">Profit Margin</th>
                  <th className="px-4 py-3 text-center">Current Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {productReportData.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-sans">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">SKU: {p.sku}</div>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-600">{p.category}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      {p.unitsDelivered}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ৳{p.deliveredSales.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      ৳{p.deliveredCost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-800">
                      ৳{p.grossProfit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {p.currentStock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportDimension === 'courier' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Courier Partner</th>
                  <th className="px-4 py-3 text-center">Total Parcels</th>
                  <th className="px-4 py-3 text-center">Delivered</th>
                  <th className="px-4 py-3 text-center">Returns / RTS</th>
                  <th className="px-4 py-3 text-center">In Transit</th>
                  <th className="px-4 py-3 text-right">Total COD Handled</th>
                  <th className="px-4 py-3 text-right">Courier Deductions</th>
                  <th className="px-4 py-3 text-center">Delivery Success %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {courierReportData.map((c) => (
                  <tr key={c.name} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-sans font-bold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{c.totalParcels}</td>
                    <td className="px-4 py-3 text-center text-emerald-700 font-bold">{c.deliveredCount}</td>
                    <td className="px-4 py-3 text-center text-red-600 font-bold">{c.returnedCount}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{c.inTransitCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ৳{c.totalCOD.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      ৳{c.totalFees.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                        {c.deliveryRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportDimension === 'channel' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Source Channel</th>
                  <th className="px-4 py-3 text-center">Total Orders</th>
                  <th className="px-4 py-3 text-center">Delivered Orders</th>
                  <th className="px-4 py-3 text-right">Total Order Sales</th>
                  <th className="px-4 py-3 text-right">Average Order Value (AOV)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {channelReportData.map((ch) => (
                  <tr key={ch.channel} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-sans font-bold text-slate-900">{ch.channel}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{ch.totalOrders}</td>
                    <td className="px-4 py-3 text-center text-emerald-700 font-bold">{ch.deliveredOrders}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ৳{ch.totalSales.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-900 font-bold">
                      ৳{Math.round(ch.avgOrderValue).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
