import React, { useState } from 'react';
import {
  Menu,
  Search,
  Plus,
  X,
  Sparkles,
  Users,
  ChevronDown,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Order, Product, Parcel, UserAccount } from '../types/database';
import { ROLE_LABELS } from '../utils/authSecurity';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenNewOrder: () => void;
  onOpenAIOrderEntry?: () => void;
  onOpenAcceptanceTests: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement?: () => void;
  onSelectOrder: (order: Order) => void;
  onSelectProduct: (product: Product) => void;
  products: Product[];
  orders: Order[];
  parcels: Parcel[];
  dateRangeLabel: string;
  currentUser?: UserAccount;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenNewOrder,
  onOpenAIOrderEntry,
  onOpenUserManagement,
  onSelectOrder,
  onSelectProduct,
  products,
  orders,
  currentUser,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const query = searchQuery.trim().toLowerCase();
  const matchedOrders = query
    ? orders
        .filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(query) ||
            o.customerName.toLowerCase().includes(query) ||
            o.customerPhone.includes(query) ||
            (o.consignmentNumber && o.consignmentNumber.toLowerCase().includes(query))
        )
        .slice(0, 5)
    : [];

  const matchedProducts = query
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query) ||
            (p.banglaName && p.banglaName.toLowerCase().includes(query))
        )
        .slice(0, 5)
    : [];

  const totalResults = matchedOrders.length + matchedProducts.length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-slate-200/90 shadow-2xs">
      {/* Left: Mobile Toggle & Search */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 text-slate-600 rounded-lg md:hidden hover:bg-slate-100 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search with Dropdown */}
        <div className="relative w-44 sm:w-64 md:w-80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU, Order #, Phone..."
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
                              SKU: {p.sku} • Avail: {p.currentStock - p.reservedStock} /{' '}
                              {p.currentStock}
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
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* AI Auto Order Entry Quick Action */}
        {onOpenAIOrderEntry && (
          <button
            onClick={onOpenAIOrderEntry}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-950 bg-amber-300 hover:bg-amber-400 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-900" />
            <span>AI Order Entry</span>
          </button>
        )}

        {/* Primary Action: New Order */}
        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-lg shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">New Order</span>
          <span className="xs:hidden">Order</span>
        </button>

        {/* Active Authenticated User Profile & Logout */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1 pl-2.5 pr-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
            title="Authenticated Account & Session"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <div className="hidden md:block text-left leading-tight">
              <div className="font-bold text-slate-900 text-[11px]">
                {currentUser ? currentUser.fullName : 'Admin'}
              </div>
              <div className="text-[10px] text-emerald-800 font-semibold">
                {currentUser ? ROLE_LABELS[currentUser.role].name : 'Super Admin'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 text-xs space-y-2">
              <div className="pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Session</span>
                </div>
                <div className="font-bold text-slate-900 mt-1">
                  {currentUser?.fullName}
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  {currentUser?.email || `@${currentUser?.username}`}
                </div>
                <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-semibold">
                  Role: {currentUser ? ROLE_LABELS[currentUser.role].name : 'Super Admin'}
                </div>
              </div>

              <div className="space-y-1">
                {onOpenUserManagement && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenUserManagement();
                      setShowUserDropdown(false);
                    }}
                    className="w-full py-1.5 px-2.5 text-left font-semibold text-emerald-900 hover:bg-emerald-50 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Users & Role Permissions</span>
                  </button>
                )}
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout();
                    }}
                    className="w-full py-1.5 px-2.5 text-left font-semibold text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out of Session</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Direct One-Click Log Out Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            data-testid="header-logout-button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer"
            title="Log out and end current session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Log Out</span>
          </button>
        )}
      </div>
    </header>
  );
};
