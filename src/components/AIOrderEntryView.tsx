import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Copy,
  FileText,
  Layers,
  Plus,
  Trash2,
  UserCheck,
  MapPin,
  Phone,
  Package,
  CreditCard,
  Truck,
  Calendar,
  ArrowRight,
  RotateCcw,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import {
  AppSettings,
  DeliveryZone,
  Order,
  OrderStatus,
  Product,
  RolePermissionMap,
  UserAccount,
} from '../types/database';
import {
  parseBatchOrderText,
  parseOrderText,
  ParsedOrderDraft,
  recalculateAndValidateDraft,
} from '../utils/aiOrderParser';
import { BANGLADESH_DISTRICTS } from '../utils/districtData';

interface AIOrderEntryViewProps {
  products: Product[];
  existingOrders: Order[];
  settings: AppSettings;
  currentUser: UserAccount;
  rolePermissions: RolePermissionMap;
  onCreateOrder: (orderData: any) => {
    success: boolean;
    order?: Order;
    error?: string;
    duplicateWarning?: string;
  };
  onSelectOrder: (order: Order) => void;
}

const SAMPLE_PROMPT_ORDER = `Customer Name: Rahim Uddin; Phone: 01712345678; Address: House 12, Savar, Dhaka; Area: Inside Dhaka; Product: Islamic Crystal Ball; Quantity: 2; Unit Price: 650; Delivery Charge: 80; Payment: Cash on Delivery; Note: Call before delivery.`;

const SAMPLE_BANGLA_ORDER = `নাম: নুসরাত জাহান তানিয়া
মোবাইল: ০১৮১৯৫৫৬৬৭৭
ঠিকানা: বাসা ২৪, রোড ৯, ধানমন্ডি, ঢাকা
এরিয়া: ঢাকার ভিতরে
পণ্য: ৩ডি ক্রিস্টাল পদ্মফুল এলইডি বাতি
পরিমাণ: ১ পিস
দাম: ১৮৫০
ডেলিভারি চার্জ: ৮০
পেমেন্ট: ক্যাশ অন ডেলিভারি
নোট: গিফট র‍্যাপিং করে দেবেন প্লিজ।`;

const SAMPLE_BANGLISH_MULTI = `Customer Name: Tareq Mahmud
Phone: 01911445566
Address: Flat 4B, Love Lane, Kotwali, Chattogram
Area: Outside Dhaka
Product: Galaxy Crystal Ball x 2, Crystal Swan x 1
Discount: 100
Delivery Charge: 120
Payment: bKash
Advance: 300
Note: Fragile glass item, pack carefully.`;

const SAMPLE_BATCH_ORDERS = `Customer Name: Rahim Uddin; Phone: 01712345678; Address: House 12, Savar, Dhaka; Area: Inside Dhaka; Product: Islamic Crystal Ball; Quantity: 2; Unit Price: 650; Delivery Charge: 80; Payment: Cash on Delivery; Note: Call before delivery.
---
Customer Name: Sadia Afrin; Phone: 01612889900; Address: Zindabazar Main Road, Sylhet; Area: Outside Dhaka; Product: 3D Crystal Lotus Flower LED Lamp; Quantity: 1; Unit Price: 1850; Delivery Charge: 120; Payment: Cash on Delivery; Note: Office address delivery before 5 PM.`;

export const AIOrderEntryView: React.FC<AIOrderEntryViewProps> = ({
  products,
  existingOrders,
  settings,
  currentUser,
  rolePermissions,
  onCreateOrder,
  onSelectOrder,
}) => {
  const [entryMode, setEntryMode] = useState<'single' | 'batch' | 'structured'>('single');
  const [rawText, setRawText] = useState<string>(SAMPLE_PROMPT_ORDER);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [drafts, setDrafts] = useState<ParsedOrderDraft[]>(() => [
    parseOrderText(SAMPLE_PROMPT_ORDER, products, existingOrders, settings),
  ]);
  const [activeDraftIndex, setActiveDraftIndex] = useState<number>(0);
  const [createdOrdersHistory, setCreatedOrdersHistory] = useState<
    Array<{ order: Order; createdAt: string; createdBy: string }>
  >([]);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    order?: Order;
  } | null>(null);

  const activeProducts = products.filter((p) => !p.isArchived);
  const currentDraft = drafts[activeDraftIndex] || null;

  const handleExtractOrder = async (textToParse?: string, modeOverride?: 'single' | 'batch') => {
    const sourceText = textToParse !== undefined ? textToParse : rawText;
    const mode = modeOverride || (entryMode === 'batch' ? 'batch' : 'single');
    if (!sourceText.trim()) {
      setFeedbackBanner({
        type: 'error',
        title: 'Empty Order Input',
        message: 'Please paste or type customer order details in the text box first.',
      });
      return;
    }

    setIsParsing(true);
    setFeedbackBanner(null);

    try {
      const response = await fetch('/api/ai/parse-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-username': currentUser.username,
          'x-user-role': currentUser.role,
          'x-user-active': String(currentUser.isActive),
        },
        body: JSON.stringify({
          rawText: sourceText,
          isBatch: mode === 'batch',
          catalogue: activeProducts,
          existingOrders,
          settings: {
            defaultInsideDhakaFee: settings.defaultInsideDhakaFee || 80,
            defaultOutsideDhakaFee: settings.defaultOutsideDhakaFee || 120,
          },
          actor: currentUser,
          rolePermissions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.drafts) && data.drafts.length > 0) {
          setDrafts(data.drafts);
          setActiveDraftIndex(0);
          setIsParsing(false);
          return;
        }
      }
    } catch (_err) {
      // Fall back to deterministic client-side parser if server call fails
    }

    const localDrafts =
      mode === 'batch'
        ? parseBatchOrderText(sourceText, activeProducts, existingOrders, settings)
        : [parseOrderText(sourceText, activeProducts, existingOrders, settings)];

    setDrafts(localDrafts);
    setActiveDraftIndex(0);
    setIsParsing(false);
  };

  const updateCurrentDraft = (updater: (prev: ParsedOrderDraft) => ParsedOrderDraft) => {
    if (!currentDraft) return;
    const updated = recalculateAndValidateDraft(
      updater(currentDraft),
      activeProducts,
      existingOrders,
      settings
    );
    const nextDrafts = [...drafts];
    nextDrafts[activeDraftIndex] = updated;
    setDrafts(nextDrafts);
  };

  const handleZoneChange = (newZone: DeliveryZone) => {
    const defaultCharge =
      newZone === 'inside_dhaka'
        ? settings.defaultInsideDhakaFee || 80
        : newZone === 'sub_dhaka'
        ? settings.defaultSubDhakaFee || 100
        : settings.defaultOutsideDhakaFee || 120;

    updateCurrentDraft((d) => ({
      ...d,
      deliveryZone: newZone,
      deliveryCharge: defaultCharge,
    }));
  };

  const handleProductMatchSelect = (itemIndex: number, productId: string) => {
    const prod = activeProducts.find((p) => p.id === productId);
    updateCurrentDraft((d) => {
      const nextItems = [...d.items];
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        matchedProductId: prod ? prod.id : null,
        matchedProductName: prod ? prod.name : 'Unmatched Product',
        matchedSku: prod ? prod.sku : '',
        unitPrice: prod ? prod.sellingPrice : nextItems[itemIndex].unitPrice,
        cataloguePrice: prod ? prod.sellingPrice : 0,
        confidence: prod ? 'exact' : 'unmatched',
      };
      return { ...d, items: nextItems };
    });
  };

  const handleAddLineItem = () => {
    const defaultProd = activeProducts[0];
    if (!defaultProd) return;
    updateCurrentDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          id: 'manual-item-' + Date.now(),
          rawProductText: defaultProd.name,
          matchedProductId: defaultProd.id,
          matchedProductName: defaultProd.name,
          matchedSku: defaultProd.sku,
          quantity: 1,
          unitPrice: defaultProd.sellingPrice,
          cataloguePrice: defaultProd.sellingPrice,
          availableStock: Math.max(0, defaultProd.currentStock - defaultProd.reservedStock),
          subtotal: defaultProd.sellingPrice,
          confidence: 'exact',
        },
      ],
    }));
  };

  const handleRemoveLineItem = (itemIndex: number) => {
    updateCurrentDraft((d) => ({
      ...d,
      items: d.items.filter((_, idx) => idx !== itemIndex),
    }));
  };

  const handleConfirmAndCreateOrder = () => {
    if (!currentDraft) return;
    const validated = recalculateAndValidateDraft(
      currentDraft,
      activeProducts,
      existingOrders,
      settings
    );
    if (!validated.isValidToCreate) {
      setFeedbackBanner({
        type: 'error',
        title: 'Cannot Create Order — Missing or Ambiguous Fields',
        message: [
          ...validated.missingFields.map((f) => `Missing: ${f}`),
          ...validated.ambiguities,
        ].join(' • '),
      });
      return;
    }

    const result = onCreateOrder({
      customerName: validated.customerName,
      customerPhone: validated.customerPhone,
      fullAddress: validated.fullAddress,
      district: validated.district,
      deliveryZone: validated.deliveryZone,
      items: validated.items.map((it) => ({
        productId: it.matchedProductId!,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      discount: validated.discount,
      deliveryFeeCharged: validated.deliveryCharge,
      advancePaid: validated.advancePaid,
      advancePaymentMethod: validated.paymentMethod,
      paymentMethod: validated.paymentMethod,
      courierName: validated.courierName || 'Steadfast',
      sourceChannel: 'AI Auto Entry',
      notes: validated.notes,
      orderDate: validated.orderDate,
      initialStatus: validated.initialStatus,
      entryMethod: entryMode === 'batch' ? 'batch_auto' : 'ai_auto',
      createdByUserId: currentUser.id,
      createdByName: currentUser.fullName,
    });

    if (!result.success || !result.order) {
      setFeedbackBanner({
        type: 'error',
        title: 'Order Creation Failed',
        message: result.error || 'Unable to save order.',
      });
      return;
    }

    setCreatedOrdersHistory((prev) => [
      {
        order: result.order!,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
      },
      ...prev,
    ]);

    setFeedbackBanner({
      type: 'success',
      title: `Order Confirmed & Created: ${result.order.orderNumber}`,
      message: `Saved for ${result.order.customerName} (${result.order.customerPhone}) • Total ৳${
        result.order.itemTotal - result.order.discount + result.order.deliveryFeeCharged
      } (COD: ৳${result.order.codAmount}) • Recorded by ${currentUser.fullName}.`,
      order: result.order,
    });

    // If in batch mode and more drafts remain, remove confirmed draft and advance
    if (drafts.length > 1) {
      const remaining = drafts.filter((_, idx) => idx !== activeDraftIndex);
      setDrafts(remaining);
      setActiveDraftIndex(Math.min(activeDraftIndex, remaining.length - 1));
    } else if (result.order) {
      const updatedOrders = existingOrders.some((o) => o.id === result.order!.id)
        ? existingOrders
        : [result.order, ...existingOrders];
      setDrafts((prev) =>
        prev.map((d, idx) =>
          idx === activeDraftIndex
            ? recalculateAndValidateDraft(d, activeProducts, updatedOrders, settings)
            : d
        )
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-700 text-amber-300 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>AI Auto Order Entry</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  Bangla • Banglish • English
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste complete customer order messages to extract fields, match catalogue products, check duplicates, and preview before creating.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs self-start lg:self-auto">
          <button
            type="button"
            onClick={() => {
              setEntryMode('single');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              entryMode === 'single'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
            <span>Single Paste</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('batch');
              setRawText(SAMPLE_BATCH_ORDERS);
              handleExtractOrder(SAMPLE_BATCH_ORDERS, 'batch');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              entryMode === 'batch'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>Batch Review Queue</span>
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('structured')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              entryMode === 'structured'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-700" />
            <span>Structured Fallback</span>
          </button>
        </div>
      </div>

      {/* Created Order Confirmation Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>{feedbackBanner.title}</span>
                {feedbackBanner.order && (
                  <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-mono text-xs">
                    {feedbackBanner.order.orderNumber}
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 opacity-90">{feedbackBanner.message}</p>
            </div>
          </div>

          {feedbackBanner.order && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSelectOrder(feedbackBanner.order!)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-emerald-900 border border-emerald-300 rounded-lg hover:bg-emerald-100 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect Order {feedbackBanner.order.orderNumber}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main 2-Column Layout: Left = Paste Box & Presets, Right = Preview & Confirm */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Large Order Text Box */}
        <div className="xl:col-span-5 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="ai-order-paste-box"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {entryMode === 'batch'
                    ? 'Paste Multiple Customer Orders (Separated by --- or Blank Line)'
                    : 'Paste Customer Complete Order Details'}
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setRawText('');
                }}
                className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            <textarea
              id="ai-order-paste-box"
              rows={10}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Example: Customer Name: Rahim Uddin; Phone: 01712345678; Address: House 12, Savar, Dhaka; Area: Inside Dhaka; Product: Islamic Crystal Ball; Quantity: 2; Unit Price: 650; Delivery Charge: 80; Payment: Cash on Delivery; Note: Call before delivery."
              className="w-full p-3.5 text-xs font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 text-slate-900"
            />

            {/* Quick Example Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500">
                Load Realistic Order Paste Examples:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode('single');
                    setRawText(SAMPLE_PROMPT_ORDER);
                    handleExtractOrder(SAMPLE_PROMPT_ORDER, 'single');
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-md cursor-pointer"
                >
                  1. Rahim Uddin (Islamic Crystal Ball x2)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode('single');
                    setRawText(SAMPLE_BANGLA_ORDER);
                    handleExtractOrder(SAMPLE_BANGLA_ORDER, 'single');
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md cursor-pointer"
                >
                  2. বাংলা মেসেঞ্জার অর্ডার (পদ্মফুল বাতি)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode('single');
                    setRawText(SAMPLE_BANGLISH_MULTI);
                    handleExtractOrder(SAMPLE_BANGLISH_MULTI, 'single');
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md cursor-pointer"
                >
                  3. Multi-Product Outside Dhaka (৳120)
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <button
              type="button"
              disabled={isParsing}
              onClick={() => handleExtractOrder()}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                {isParsing
                  ? 'Extracting & Matching Catalogue...'
                  : entryMode === 'batch'
                  ? 'Extract Batch Orders into Review Queue'
                  : 'Extract & Map Order Fields to Preview'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
              <span>
                Default Delivery: <strong>Inside Dhaka ৳{settings.defaultInsideDhakaFee || 80}</strong> •{' '}
                <strong>Outside Dhaka ৳{settings.defaultOutsideDhakaFee || 120}</strong>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold">
                {currentDraft?.parserSource === 'gemini_ai' ? 'Gemini AI + Catalogue' : 'Rule Engine + Catalogue'}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Extracted Preview & Confirm Form */}
        <div className="xl:col-span-7 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          {/* Batch Queue Selector if multiple drafts */}
          {drafts.length > 1 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
              <div className="text-xs font-bold text-slate-800 shrink-0">
                Batch Review Queue ({drafts.length} Orders):
              </div>
              <div className="flex items-center gap-1.5">
                {drafts.map((d, idx) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveDraftIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      idx === activeDraftIndex
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    #{idx + 1}: {d.customerName || 'Unnamed'} ({d.items.length} item{d.items.length === 1 ? '' : 's'})
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentDraft ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Extracted Order Preview & Manual Verification</span>
                    {currentDraft.isValidToCreate ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ready to Confirm
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Needs Review
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Review and edit any field below. Order is only saved when you click Confirm and Create Order.
                  </p>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  Creating as: <strong className="text-slate-800">{currentUser.fullName}</strong>
                </div>
              </div>

              {/* Ambiguities / Missing Fields Warning Box */}
              {(currentDraft.missingFields.length > 0 || currentDraft.ambiguities.length > 0) && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Ambiguity or Missing Information Detected — Please Correct Before Saving:</span>
                  </div>
                  {currentDraft.missingFields.length > 0 && (
                    <div>
                      <strong>Missing Fields:</strong> {currentDraft.missingFields.join(', ')}
                    </div>
                  )}
                  {currentDraft.ambiguities.map((amb, i) => (
                    <div key={i} className="text-[11px] flex items-center gap-1.5">
                      <span>• {amb}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Duplicate Order Warning Box */}
              {currentDraft.duplicateWarnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-950 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-orange-900">
                    <ShieldAlert className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>Possible Duplicate Order Warning ({currentDraft.duplicateWarnings.length} found)</span>
                  </div>
                  {currentDraft.duplicateWarnings.map((dup) => (
                    <div key={dup.orderId} className="text-[11px] flex items-center justify-between gap-2">
                      <span>
                        • <strong>{dup.orderNumber}</strong> ({dup.status}) — {dup.itemSummary} — ৳{dup.totalAmount}
                      </span>
                      <span className="font-mono text-[10px] text-orange-800">
                        {dup.orderDate.slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Customer & Delivery Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={currentDraft.customerName}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, customerName: e.target.value }))
                    }
                    placeholder="e.g. Rahim Uddin"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 focus:border-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone Number (BD 11-Digit) *
                  </label>
                  <input
                    type="text"
                    value={currentDraft.customerPhone}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, customerPhone: e.target.value }))
                    }
                    placeholder="01712345678"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:border-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Delivery Area / Zone *
                  </label>
                  <select
                    value={currentDraft.deliveryZone}
                    onChange={(e) => handleZoneChange(e.target.value as DeliveryZone)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-emerald-900 focus:border-emerald-600 outline-none"
                  >
                    <option value="inside_dhaka">
                      Inside Dhaka (৳{settings.defaultInsideDhakaFee || 80})
                    </option>
                    <option value="outside_dhaka">
                      Outside Dhaka (৳{settings.defaultOutsideDhakaFee || 120})
                    </option>
                    <option value="sub_dhaka">
                      Sub-Dhaka (৳{settings.defaultSubDhakaFee || 100})
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Delivery Address *
                  </label>
                  <input
                    type="text"
                    value={currentDraft.fullAddress}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, fullAddress: e.target.value }))
                    }
                    placeholder="House 12, Savar, Dhaka"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:border-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">District</label>
                  <select
                    value={currentDraft.district}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, district: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:border-emerald-600 outline-none"
                  >
                    {BANGLADESH_DISTRICTS.map((dist) => (
                      <option key={dist.name} value={dist.name}>
                        {dist.name} ({dist.banglaName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Extracted Products & Catalogue Mapping Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Matched Catalogue Products ({currentDraft.items.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-md border border-emerald-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product Line</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Extracted Text & Catalogue Product</th>
                        <th className="px-2 py-2 w-20 text-center">Qty</th>
                        <th className="px-2 py-2 w-28 text-right">Unit Price (৳)</th>
                        <th className="px-3 py-2 w-28 text-right">Subtotal</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentDraft.items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">
                            No product extracted. Click "Add Product Line" to select from catalogue.
                          </td>
                        </tr>
                      ) : (
                        currentDraft.items.map((item, idx) => (
                          <tr key={item.id} className="bg-white">
                            <td className="px-3 py-2.5 space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <span>Extracted: "{item.rawProductText}"</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                                    item.matchedProductId
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {item.matchedProductId ? `${item.confidence} match` : 'Unmatched'}
                                </span>
                              </div>
                              <select
                                value={item.matchedProductId || ''}
                                onChange={(e) => handleProductMatchSelect(idx, e.target.value)}
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold outline-none ${
                                  item.matchedProductId
                                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                                    : 'bg-red-50 border-red-300 text-red-900'
                                }`}
                              >
                                <option value="">-- Select Catalogue Product --</option>
                                {activeProducts.map((p) => {
                                  const avail = Math.max(0, p.currentStock - p.reservedStock);
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {p.name} • ৳{p.sellingPrice} ({avail} avail)
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td className="px-2 py-2.5">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  updateCurrentDraft((d) => {
                                    const next = [...d.items];
                                    next[idx] = { ...next[idx], quantity: q };
                                    return { ...d, items: next };
                                  });
                                }}
                                className="w-full px-2 py-1 text-center font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              <input
                                type="number"
                                min={0}
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const up = Math.max(0, parseFloat(e.target.value) || 0);
                                  updateCurrentDraft((d) => {
                                    const next = [...d.items];
                                    next[idx] = { ...next[idx], unitPrice: up };
                                    return { ...d, items: next };
                                  });
                                }}
                                className="w-full px-2 py-1 text-right font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                              ৳{item.subtotal.toLocaleString()}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                title="Remove line item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pricing, Delivery Charge, Payment Method, Status & Notes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Delivery Charge (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentDraft.deliveryCharge}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({
                        ...d,
                        deliveryCharge: Math.max(0, parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={currentDraft.discount}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({
                        ...d,
                        discount: Math.max(0, parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Advance Paid (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentDraft.advancePaid}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({
                        ...d,
                        advancePaid: Math.max(0, parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={currentDraft.paymentMethod}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, paymentMethod: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900"
                  >
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Rocket">Rocket</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={currentDraft.initialStatus}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({
                        ...d,
                        initialStatus: e.target.value as OrderStatus,
                      }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed (Reserve)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Courier Partner</label>
                  <select
                    value={currentDraft.courierName}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, courierName: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900"
                  >
                    <option value="Steadfast">Steadfast</option>
                    <option value="Pathao">Pathao</option>
                    <option value="RedX">RedX</option>
                    <option value="eCourier">eCourier</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Delivery Note / Instructions
                  </label>
                  <input
                    type="text"
                    value={currentDraft.notes}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, notes: e.target.value }))
                    }
                    placeholder="e.g. Call before delivery"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Financial Summary Bar & Confirm Button */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="grid grid-cols-3 sm:flex sm:items-center gap-4 text-xs">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase">Subtotal</div>
                    <div className="font-mono font-bold text-sm">
                      ৳{currentDraft.subtotal.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase">Delivery</div>
                    <div className="font-mono font-bold text-sm text-emerald-300">
                      +৳{currentDraft.deliveryCharge.toLocaleString()}
                    </div>
                  </div>
                  {currentDraft.discount > 0 && (
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase">Discount</div>
                      <div className="font-mono font-bold text-sm text-amber-300">
                        -৳{currentDraft.discount.toLocaleString()}
                      </div>
                    </div>
                  )}
                  <div className="pl-2 sm:border-l border-slate-700">
                    <div className="text-amber-300 text-[10px] uppercase font-semibold">
                      Total / COD Due
                    </div>
                    <div className="font-mono font-bold text-base text-white">
                      ৳{currentDraft.totalAmount.toLocaleString()}{' '}
                      <span className="text-xs text-emerald-400 font-normal">
                        (COD: ৳{currentDraft.codAmount.toLocaleString()})
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmAndCreateOrder}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Confirm and Create Order</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Paste customer order text on the left and click Extract to preview fields.
            </div>
          )}
        </div>
      </div>

      {/* Recently Created Orders via AI Entry Session */}
      {createdOrdersHistory.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Orders Confirmed in This Session ({createdOrdersHistory.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {createdOrdersHistory.map(({ order, createdBy }) => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 hover:bg-emerald-100/60 transition-colors cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-mono font-bold text-emerald-950">{order.orderNumber}</div>
                  <div className="font-semibold text-slate-800">
                    {order.customerName} • {order.customerPhone}
                  </div>
                  <div className="text-[10px] text-slate-500">Created by {createdBy}</div>
                </div>
                <div className="text-right font-mono font-bold text-emerald-800">
                  ৳{order.codAmount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
