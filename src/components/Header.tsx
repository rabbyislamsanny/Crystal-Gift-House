import React, { useState } from 'react';
import {
  Menu,
  Search,
  Plus,
  ShieldCheck,
  Lock,
  Calendar,
  X,
  ExternalLink,
} from 'lucide-react';
import { Order, Product, Parcel } from '../types/database';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenNewOrder: () => void;
  onOpenAcceptanceTests: () => void;
  onOpenSettings: () => void;
  onSelectOrder: (order: Order) => void;
  onSelectProduct: (product: Product) => void;
  products: Product[];
  orders: Order[];
  parcels: Parcel[];
  dateRangeLabel: string;
  onChangeDateRange?: (range: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenNewOrder,
  onOpenAcceptanceTests,
  onOpenSettings,
  onSelectOrder,
  onSelectProduct,
  products,
  orders,
  parcels,
  dateRangeLabel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Search results calculation
  const query = searchQuery.trim().toLowerCase();
  const matchedOrders = query
    ? orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(query) ||
          o.customerName.toLowerCase().includes(query) ||
          o.customerPhone.includes(query) ||
          (o.consignmentNumber && o.consignmentNumber.toLowerCase().includes(query))
      ).slice(0, 5)
    : [];

  const matchedProducts = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          (p.banglaName && p.banglaName.toLowerCase().includes(query))
      ).slice(0, 5)
    : [];

  const totalResults = matchedOrders.length + matchedProducts.length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-slate-200/90 shadow-2xs">
      {/* Left: Mobile Toggle & Page Context */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 text-slate-600 rounded-lg md:hidden hover:bg-slate-100 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search with Dropdown */}
        <div className="relative w-48 sm:w-72 md:w-96">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU, Order #, Phone, Consignment..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {showSearchResults && searchQuery && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 text-xs">
              <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Search Results ({totalResults})</span>
                <button
                  onClick={() => setShowSearchResults(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>

              {totalResults === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No matching order, customer phone, or product SKU found.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {matchedOrders.length > 0 && (
                    <div className="p-1">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Orders ({matchedOrders.length})
                      </div>
                      {matchedOrders.map((o) => (
                        <div
                          key={o.id}
                          onClick={() => {
                            onSelectOrder(o);
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center justify-between p-2 hover:bg-emerald-50/60 rounded-md cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{o.orderNumber}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 capitalize font-mono">
                                {o.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {o.customerName} • {o.customerPhone} ({o.district})
                            </div>
                          </div>
                          <div className="text-right font-mono font-medium text-emerald-800">
                            ৳{o.codAmount}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {matchedProducts.length > 0 && (
                    <div className="p-1">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Products ({matchedProducts.length})
                      </div>
                      {matchedProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            onSelectProduct(p);
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center justify-between p-2 hover:bg-emerald-50/60 rounded-md cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              SKU: {p.sku} • Avail: {p.currentStock - p.reservedStock} / {p.currentStock}
                            </div>
                          </div>
                          <div className="text-right font-mono font-medium text-emerald-800">
                            ৳{p.sellingPrice}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date Filter Badge Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200/80 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Period:</span>
          <span className="font-semibold text-emerald-800">{dateRangeLabel}</span>
        </div>

        {/* Acceptance Tests Button */}
        <button
          onClick={onOpenAcceptanceTests}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer"
          title="Verify 10 Core Acceptance Criteria"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Verify OS</span>
        </button>

        {/* Primary Action: New Order */}
        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-lg shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">New Order</span>
          <span className="xs:hidden">Order</span>
        </button>

        {/* Owner Profile Indicator */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 p-1 pl-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
          title="Owner Settings & PIN"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="hidden md:inline font-semibold">Owner Admin</span>
          <div className="w-6 h-6 rounded-md bg-emerald-800 text-white flex items-center justify-center font-bold text-[10px]">
            CG
          </div>
        </button>
      </div>
    </header>
  );
};
