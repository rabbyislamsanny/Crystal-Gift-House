import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  DollarSign,
  TrendingUp,
  Receipt,
  BarChart3,
  Settings,
  ShieldCheck,
  ShoppingBag,
  X,
  Sparkles,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'orders'
  | 'inventory'
  | 'purchases'
  | 'parcels'
  | 'advertising'
  | 'expenses'
  | 'accounting'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  lowStockCount: number;
  pendingOrdersCount: number;
  pendingParcelsCount: number;
  onOpenAcceptanceTests: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  lowStockCount,
  pendingOrdersCount,
  pendingParcelsCount,
  onOpenAcceptanceTests,
}) => {
  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', bangla: 'ড্যাশবোর্ড', icon: LayoutDashboard },
    {
      id: 'orders' as ActiveTab,
      label: 'Orders',
      bangla: 'অর্ডার ম্যানেজমেন্ট',
      icon: ShoppingCart,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      badgeColor: 'bg-emerald-500 text-white',
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Products & Stock',
      bangla: 'পণ্য ও স্টক',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-amber-500 text-slate-900 font-bold',
    },
    { id: 'purchases' as ActiveTab, label: 'Purchases & Suppliers', bangla: 'ক্রয় ও সরবরাহকারী', icon: ShoppingBag },
    {
      id: 'parcels' as ActiveTab,
      label: 'Parcels & Courier',
      bangla: 'পার্সেল ও কুরিয়ার',
      icon: Truck,
      badge: pendingParcelsCount > 0 ? pendingParcelsCount : undefined,
      badgeColor: 'bg-blue-500 text-white',
    },
    { id: 'advertising' as ActiveTab, label: 'Meta Ads & Spend', bangla: 'বিজ্ঞাপন খরচ', icon: TrendingUp },
    { id: 'expenses' as ActiveTab, label: 'Operating Expenses', bangla: 'অন্যান্য খরচ', icon: Receipt },
    { id: 'accounting' as ActiveTab, label: 'Accounting & P&L', bangla: 'হিসাব ও লাভ-ক্ষতি', icon: DollarSign },
    { id: 'reports' as ActiveTab, label: 'Reports & Export', bangla: 'রিপোর্ট ও অ্যানালিটিক্স', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: 'Settings & Backup', bangla: 'সেটিংস ও ব্যাকআপ', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-slate-900 text-slate-200 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 bg-emerald-950 border-b border-emerald-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Crystal Gift House
              </h1>
              <p className="text-[11px] text-emerald-300/80 font-medium font-sans">
                Business OS • Bangladesh
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white md:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currency & Business Badge */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 font-medium text-amber-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping mr-0.5"></span>
            BDT (৳) • Asia/Dhaka
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-semibold border border-emerald-500/20">
            PROD
          </span>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-amber-300' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <div className="truncate">
                    <div className="leading-tight">{item.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal leading-none mt-0.5 opacity-80">
                      {item.bangla}
                    </div>
                  </div>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-md ${
                      item.badgeColor || 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Acceptance Test Suite Runner Shortcut */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={() => {
              onOpenAcceptanceTests();
              onCloseMobile();
            }}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 rounded-lg transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>10 Acceptance Tests</span>
          </button>
          <div className="mt-2 text-center text-[10px] text-slate-400">
            © 2026 Crystal Gift House BD
          </div>
        </div>
      </aside>
    </>
  );
};
