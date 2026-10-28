import { DeliveryZone, Order, OrderStatus, Product } from '../types/database';

export interface ParsedOrderLineItem {
  id: string;
  rawProductText: string;
  matchedProductId: string | null;
  matchedProductName: string;
  matchedSku: string;
  quantity: number;
  unitPrice: number;
  cataloguePrice: number;
  availableStock: number;
  subtotal: number;
  confidence: 'exact' | 'alias' | 'fuzzy' | 'unmatched';
  warning?: string;
}

export interface DuplicateOrderWarning {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  orderDate: string;
  itemSummary: string;
  totalAmount: number;
  reason: string;
}

export interface ParsedOrderDraft {
  id: string;
  rawText: string;
  customerName: string;
  customerPhone: string;
  fullAddress: string;
  district: string;
  deliveryZone: DeliveryZone;
  areaLabel: 'Inside Dhaka' | 'Outside Dhaka' | 'Sub-Dhaka';
  items: ParsedOrderLineItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  advancePaid: number;
  totalAmount: number;
  codAmount: number;
  paymentMethod: string;
  courierName: string;
  sourceChannel: 'Facebook Page' | 'WhatsApp' | 'Website' | 'TikTok' | 'Direct Call' | 'Showroom' | 'AI Auto Entry';
  notes: string;
  orderDate: string;
  initialStatus: OrderStatus;
  missingFields: string[];
  ambiguities: string[];
  duplicateWarnings: DuplicateOrderWarning[];
  isValidToCreate: boolean;
  parserSource: 'gemini_ai' | 'rule_engine';
}

const BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Converts Bangla numerals (০-৯) to ASCII numerals (0-9).
 */
export function normalizeBanglaDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] ?? d);
}

/**
 * Normalizes a Bangladesh phone number to 11-digit 01XXXXXXXXX format when possible.
 */
export function normalizeBdPhone(raw: string): string {
  const ascii = normalizeBanglaDigits(raw || '');
  const digitsOnly = ascii.replace(/[^\d+]/g, '');
  const cleaned = digitsOnly.replace(/^\+?88/, '');
  const match = cleaned.match(/01[3-9]\d{8}/);
  if (match) return match[0];
  return cleaned.replace(/\D/g, '');
}

const BD_DISTRICTS: Array<{ name: string; aliases: string[]; zone: DeliveryZone }> = [
  { name: 'Dhaka', aliases: ['dhaka', 'ঢাকা', 'uttara', 'উত্তরা', 'mirpur', 'মিরপুর', 'dhanmondi', 'ধানমন্ডি', 'banani', 'বনানী', 'gulshan', 'গুলশান', 'mohammadpur', 'মোহাম্মদপুর', 'motijheel', 'মতিঝিল', 'bashundhara', 'বসুন্ধরা', 'badda', 'বাড্ডা', 'rampura', 'রামপুরা', 'malibagh', 'মালিবাগ', 'khilgaon', 'খিলগাঁও', 'jatrabari', 'যাত্রাবাড়ী', 'old dhaka', 'chawkbazar', 'savar', 'সাভার', 'keraniganj', 'কেরানীগঞ্জ', 'ashulia', 'আশুলিয়া', 'tongi', 'টঙ্গী'], zone: 'inside_dhaka' },
  { name: 'Gazipur', aliases: ['gazipur', 'গাজীপুর', 'joydebpur', 'জয়দেবপুর'], zone: 'outside_dhaka' },
  { name: 'Narayanganj', aliases: ['narayanganj', 'নারায়ণগঞ্জ', 'fatullah', 'siddhirganj'], zone: 'outside_dhaka' },
  { name: 'Chattogram', aliases: ['chattogram', 'chittagong', 'চট্টগ্রাম', 'চিটাগং', 'nasirabad', 'agrabad', 'halishahar', 'panchlaish'], zone: 'outside_dhaka' },
  { name: 'Sylhet', aliases: ['sylhet', 'সিলেট', 'zindabazar', 'amberkhana'], zone: 'outside_dhaka' },
  { name: 'Rajshahi', aliases: ['rajshahi', 'রাজশাহী'], zone: 'outside_dhaka' },
  { name: 'Khulna', aliases: ['khulna', 'খুলনা'], zone: 'outside_dhaka' },
  { name: 'Barishal', aliases: ['barishal', 'barisal', 'বরিশাল'], zone: 'outside_dhaka' },
  { name: 'Rangpur', aliases: ['rangpur', 'রংপুর'], zone: 'outside_dhaka' },
  { name: 'Mymensingh', aliases: ['mymensingh', 'ময়মনসিংহ'], zone: 'outside_dhaka' },
  { name: 'Cumilla', aliases: ['cumilla', 'comilla', 'কুমিল্লা'], zone: 'outside_dhaka' },
  { name: 'Bogura', aliases: ['bogura', 'bogra', 'বগুড়া'], zone: 'outside_dhaka' },
  { name: 'Noakhali', aliases: ['noakhali', 'নোয়াখালী'], zone: 'outside_dhaka' },
  { name: 'Feni', aliases: ['feni', 'ফেনী'], zone: 'outside_dhaka' },
  { name: "Cox's Bazar", aliases: ['cox', 'coxs bazar', 'কক্সবাজার'], zone: 'outside_dhaka' },
  { name: 'Jashore', aliases: ['jashore', 'jessore', 'যশোর'], zone: 'outside_dhaka' },
  { name: 'Kushtia', aliases: ['kushtia', 'কুষ্টিয়া'], zone: 'outside_dhaka' },
  { name: 'Tangail', aliases: ['tangail', 'টাঙ্গাইল'], zone: 'outside_dhaka' },
  { name: 'Faridpur', aliases: ['faridpur', 'ফরিদপুর'], zone: 'outside_dhaka' },
  { name: 'Brahmanbaria', aliases: ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া'], zone: 'outside_dhaka' },
  { name: 'Pabna', aliases: ['pabna', 'পাবনা'], zone: 'outside_dhaka' },
  { name: 'Dinajpur', aliases: ['dinajpur', 'দিনাজপুর'], zone: 'outside_dhaka' },
];

/**
 * Matches a product mention from customer text against the existing product catalogue.
 * Never invents or auto-creates products.
 */
export function matchProductFromCatalogue(
  rawProductQuery: string,
  catalogue: Product[]
): {
  product: Product | null;
  confidence: 'exact' | 'alias' | 'fuzzy' | 'unmatched';
} {
  const query = normalizeBanglaDigits(rawProductQuery || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!query) {
    return { product: null, confidence: 'unmatched' };
  }

  const activeProducts = catalogue.filter((p) => !p.isArchived);

  // 1. Exact SKU or Name or Bangla Name match
  for (const prod of activeProducts) {
    if (
      prod.sku.toLowerCase() === query ||
      prod.name.toLowerCase() === query ||
      (prod.banglaName && prod.banglaName.trim() === rawProductQuery.trim())
    ) {
      return { product: prod, confidence: 'exact' };
    }
  }

  // 2. Exact Alias match or SKU contained in query
  for (const prod of activeProducts) {
    if (query.includes(prod.sku.toLowerCase())) {
      return { product: prod, confidence: 'exact' };
    }
    if (prod.aliases && prod.aliases.some((a) => a.toLowerCase().trim() === query)) {
      return { product: prod, confidence: 'alias' };
    }
  }

  // 3. Substring / Alias containment or strong token overlap
  let bestProd: Product | null = null;
  let bestScore = 0;
  let bestConfidence: 'alias' | 'fuzzy' = 'fuzzy';

  const stopWords = new Set(['the', 'and', 'with', 'for', 'gift', 'piece', 'pcs', 'পিস', 'টি', 'টা']);
  const queryTokens = query.split(' ').filter((t) => t.length >= 2 && !stopWords.has(t));

  for (const prod of activeProducts) {
    const prodNameLower = prod.name.toLowerCase();
    const banglaLower = (prod.banglaName || '').toLowerCase();
    const aliasesLower = (prod.aliases || []).map((a) => a.toLowerCase());

    // Direct alias substring match
    if (aliasesLower.some((a) => a.includes(query) || query.includes(a))) {
      return { product: prod, confidence: 'alias' };
    }

    if (prodNameLower.includes(query) || query.includes(prodNameLower)) {
      return { product: prod, confidence: 'alias' };
    }

    if (banglaLower && (banglaLower.includes(query) || query.includes(banglaLower))) {
      return { product: prod, confidence: 'alias' };
    }

    const targetCorpus = [prodNameLower, banglaLower, ...aliasesLower, prod.sku.toLowerCase()].join(' ');
    let matchedTokens = 0;
    let distinctiveMatch = false;

    for (const token of queryTokens) {
      if (targetCorpus.includes(token)) {
        matchedTokens++;
        if (!['crystal', 'ক্রিস্টাল', 'led', 'lamp', 'light', '3d', '৩ডি'].includes(token)) {
          distinctiveMatch = true;
        }
      }
    }

    if (matchedTokens > 0 && distinctiveMatch) {
      const score = matchedTokens / Math.max(1, queryTokens.length);
      if (score > bestScore) {
        bestScore = score;
        bestProd = prod;
        bestConfidence = score >= 0.75 ? 'alias' : 'fuzzy';
      }
    }
  }

  if (bestProd && bestScore >= 0.4) {
    return { product: bestProd, confidence: bestConfidence };
  }

  return { product: null, confidence: 'unmatched' };
}

/**
 * Detects possible duplicate orders by phone number and product overlap.
 */
export function detectDuplicateOrders(
  draft: {
    customerPhone: string;
    items: Array<{ matchedProductId: string | null; quantity: number }>;
  },
  existingOrders: Order[]
): DuplicateOrderWarning[] {
  const normPhone = normalizeBdPhone(draft.customerPhone);
  if (!normPhone || normPhone.length < 10) return [];

  const warnings: DuplicateOrderWarning[] = [];
  const draftProductIds = new Set(draft.items.map((i) => i.matchedProductId).filter(Boolean));

  for (const ord of existingOrders) {
    if (ord.status === 'cancelled') continue;
    const ordPhone = normalizeBdPhone(ord.customerPhone);
    if (ordPhone === normPhone) {
      const sameProduct = ord.items.some((it) => draftProductIds.has(it.productId));
      const isActive = ['pending', 'confirmed', 'processing', 'packed', 'shipped'].includes(ord.status);
      const reason =
        isActive && sameProduct
          ? `Active order ${ord.orderNumber} (${ord.status}) already exists for ${ord.customerPhone} with the same product.`
          : isActive
          ? `Customer ${ord.customerPhone} already has an active ${ord.status} order (${ord.orderNumber}).`
          : `Previous order ${ord.orderNumber} (${ord.status}) found for this phone number.`;

      warnings.push({
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        customerName: ord.customerName,
        customerPhone: ord.customerPhone,
        status: ord.status,
        orderDate: ord.orderDate,
        itemSummary: ord.items.map((i) => `${i.quantity}x ${i.productName}`).join(', '),
        totalAmount: ord.codAmount + ord.advancePaid,
        reason,
      });
    }
  }

  return warnings;
}

/**
 * Recomputes financial totals, missing fields, ambiguities, and validity on a ParsedOrderDraft.
 * Respects manual user edits in the preview panel.
 */
export function recalculateAndValidateDraft(
  draft: ParsedOrderDraft,
  catalogue: Product[],
  existingOrders: Order[],
  settings?: { defaultInsideDhakaFee?: number; defaultOutsideDhakaFee?: number }
): ParsedOrderDraft {
  const items = draft.items.map((item) => {
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const prod = item.matchedProductId
      ? catalogue.find((p) => p.id === item.matchedProductId)
      : null;
    const availableStock = prod ? Math.max(0, prod.currentStock - prod.reservedStock) : 0;
    const subtotal = qty * unitPrice;

    let warning: string | undefined;
    if (!prod) {
      warning = `Product "${item.rawProductText || 'Unknown'}" does not match any catalogue item. Please select a product.`;
    } else if (qty > availableStock) {
      warning = `Requested quantity (${qty}) exceeds available stock (${availableStock} units available).`;
    }

    return {
      ...item,
      matchedProductId: prod ? prod.id : null,
      matchedProductName: prod ? prod.name : item.matchedProductName,
      matchedSku: prod ? prod.sku : '',
      cataloguePrice: prod ? prod.sellingPrice : item.cataloguePrice,
      availableStock,
      quantity: qty,
      unitPrice,
      subtotal,
      warning,
    };
  });

  const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
  const discount = Math.max(0, Number(draft.discount) || 0);
  const deliveryCharge = Math.max(0, Number(draft.deliveryCharge) || 0);
  const advancePaid = Math.max(0, Number(draft.advancePaid) || 0);
  const totalAmount = Math.max(0, subtotal - discount + deliveryCharge);
  const codAmount = Math.max(0, totalAmount - advancePaid);

  const missingFields: string[] = [];
  const ambiguities: string[] = [];

  if (!draft.customerName || draft.customerName.trim().length < 2) {
    missingFields.push('Customer Name');
  }

  const normalizedPhone = normalizeBdPhone(draft.customerPhone);
  if (!normalizedPhone) {
    missingFields.push('Phone Number');
  } else if (!/^01[3-9]\d{8}$/.test(normalizedPhone)) {
    ambiguities.push(`Phone number "${draft.customerPhone}" is not a standard 11-digit BD mobile number (01XXXXXXXXX).`);
  }

  if (!draft.fullAddress || draft.fullAddress.trim().length < 4) {
    missingFields.push('Full Delivery Address');
  }

  if (items.length === 0) {
    missingFields.push('At least 1 Product');
  }

  for (const it of items) {
    if (!it.matchedProductId) {
      ambiguities.push(
        `Unmatched product "${it.rawProductText}": Please choose an existing product from the catalogue dropdown.`
      );
    } else if (it.warning) {
      ambiguities.push(it.warning);
    }
  }

  const duplicateWarnings = detectDuplicateOrders(
    { customerPhone: draft.customerPhone, items },
    existingOrders
  );

  const hasUnmatchedProduct = items.some((i) => !i.matchedProductId);
  const isValidToCreate =
    missingFields.length === 0 &&
    !hasUnmatchedProduct &&
    /^01[3-9]\d{8}$/.test(normalizedPhone) &&
    items.length > 0;

  const insideFee = settings?.defaultInsideDhakaFee ?? 80;
  const outsideFee = settings?.defaultOutsideDhakaFee ?? 120;
  const areaLabel: 'Inside Dhaka' | 'Outside Dhaka' | 'Sub-Dhaka' =
    draft.deliveryZone === 'inside_dhaka'
      ? 'Inside Dhaka'
      : draft.deliveryZone === 'sub_dhaka'
      ? 'Sub-Dhaka'
      : 'Outside Dhaka';

  return {
    ...draft,
    customerPhone: normalizedPhone || draft.customerPhone,
    areaLabel,
    items,
    subtotal,
    discount,
    deliveryCharge: draft.deliveryCharge !== undefined ? deliveryCharge : draft.deliveryZone === 'inside_dhaka' ? insideFee : outsideFee,
    advancePaid,
    totalAmount,
    codAmount,
    missingFields,
    ambiguities,
    duplicateWarnings,
    isValidToCreate,
  };
}

/**
 * Deterministic multilingual (Bangla, Banglish, English) rule-based parser for a single order paste.
 */
export function parseOrderText(
  rawText: string,
  catalogue: Product[],
  existingOrders: Order[] = [],
  settings?: { defaultInsideDhakaFee?: number; defaultOutsideDhakaFee?: number }
): ParsedOrderDraft {
  const insideDefault = settings?.defaultInsideDhakaFee ?? 80;
  const outsideDefault = settings?.defaultOutsideDhakaFee ?? 120;

  const normalizedText = normalizeBanglaDigits(rawText || '').trim();
  // Split segments by semicolon or newline
  const segments = normalizedText
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  let customerName = '';
  let customerPhone = '';
  let fullAddress = '';
  let explicitArea = '';
  let explicitDeliveryFee: number | undefined;
  let explicitDiscount = 0;
  let explicitAdvance = 0;
  let paymentMethod = 'Cash on Delivery';
  let notes = '';
  let explicitDate = '';
  let explicitStatus: OrderStatus = 'pending';

  const rawProductEntries: Array<{
    nameText: string;
    quantity?: number;
    unitPrice?: number;
  }> = [];

  let currentPendingProduct: { nameText: string; quantity?: number; unitPrice?: number } | null = null;
  const unlabeledLines: string[] = [];

  for (const seg of segments) {
    const kvMatch = seg.match(/^([^:：\-]+)[:：\-]\s*(.+)$/);
    if (kvMatch) {
      const rawKey = kvMatch[1].trim().toLowerCase();
      const val = kvMatch[2].trim();

      if (/^(customer\s*name|name|receiver|কাস্টমারের\s*নাম|কাস্টমার|নাম|গ্রহীতা)$/i.test(rawKey)) {
        customerName = val;
        continue;
      }
      if (/^(phone|mobile|cell|contact|number|ফোন|মোবাইল|নাম্বার|নম্বর)$/i.test(rawKey)) {
        customerPhone = normalizeBdPhone(val) || val;
        continue;
      }
      if (/^(address|full\s*address|delivery\s*address|location|ঠিকানা|ডেলিভারি\s*ঠিকানা|বাসা)$/i.test(rawKey)) {
        fullAddress = val;
        continue;
      }
      if (/^(area|zone|delivery\s*area|district|এরিয়া|এরিয়া|এলাকা|জেলা)$/i.test(rawKey)) {
        explicitArea = val;
        continue;
      }
      if (/^(product|products|item|items|model|পণ্য|প্রোডাক্ট|আইটেম)$/i.test(rawKey)) {
        if (currentPendingProduct) {
          rawProductEntries.push(currentPendingProduct);
        }
        // Check if val has inline quantity or multiple comma-separated items
        currentPendingProduct = { nameText: val };
        continue;
      }
      if (/^(quantity|qty|pcs|piece|pieces|পরিমাণ|পিস|সংখ্যা|কয়টি)$/i.test(rawKey)) {
        const q = parseInt(val.replace(/[^\d]/g, ''), 10);
        if (!isNaN(q) && q > 0) {
          if (currentPendingProduct && currentPendingProduct.quantity === undefined) {
            currentPendingProduct.quantity = q;
          } else if (rawProductEntries.length > 0) {
            rawProductEntries[rawProductEntries.length - 1].quantity = q;
          } else {
            currentPendingProduct = { nameText: '', quantity: q };
          }
        }
        continue;
      }
      if (/^(unit\s*price|price|rate|দাম|মূল্য|ইউনিট\s*প্রাইস|রেট)$/i.test(rawKey)) {
        const p = parseFloat(val.replace(/[^\d.]/g, ''));
        if (!isNaN(p) && p >= 0) {
          if (currentPendingProduct && currentPendingProduct.unitPrice === undefined) {
            currentPendingProduct.unitPrice = p;
          } else if (rawProductEntries.length > 0) {
            rawProductEntries[rawProductEntries.length - 1].unitPrice = p;
          }
        }
        continue;
      }
      if (/^(discount|less|ডিসকাউন্ট|ছাড়|ছাড়)$/i.test(rawKey)) {
        const d = parseFloat(val.replace(/[^\d.]/g, ''));
        if (!isNaN(d) && d >= 0) explicitDiscount = d;
        continue;
      }
      if (/^(delivery\s*charge|delivery\s*fee|delivery|shipping|ডেলিভারি\s*চার্জ|ডেলিভারি\s*ফি|ডেলিভারি)$/i.test(rawKey)) {
        const dc = parseFloat(val.replace(/[^\d.]/g, ''));
        if (!isNaN(dc) && dc >= 0) explicitDeliveryFee = dc;
        if (/inside|ঢাকার\s*ভিতরে|ভেতরে/i.test(val) && !explicitArea) explicitArea = 'Inside Dhaka';
        if (/outside|ঢাকার\s*বাইরে/i.test(val) && !explicitArea) explicitArea = 'Outside Dhaka';
        continue;
      }
      if (/^(advance|advance\s*paid|paid|অগ্রিম|এডভান্স)$/i.test(rawKey)) {
        const adv = parseFloat(val.replace(/[^\d.]/g, ''));
        if (!isNaN(adv) && adv >= 0) explicitAdvance = adv;
        continue;
      }
      if (/^(payment|payment\s*method|pay|পেমেন্ট|পরিশোধ| মাধ্যম)$/i.test(rawKey)) {
        if (/bkash|বিকাশ/i.test(val)) paymentMethod = 'bKash';
        else if (/nagad|নগদ/i.test(val)) paymentMethod = 'Nagad';
        else if (/rocket|রকেট/i.test(val)) paymentMethod = 'Rocket';
        else if (/bank|ব্যাংক/i.test(val)) paymentMethod = 'Bank Transfer';
        else if (/cod|cash\s*on\s*delivery|ক্যাশ\s*অন\s*ডেলিভারি|ক্যাশ/i.test(val)) paymentMethod = 'Cash on Delivery';
        else paymentMethod = val;
        continue;
      }
      if (/^(note|notes|instruction|remarks|নোট|মন্তব্য|নির্দেশনা)$/i.test(rawKey)) {
        notes = notes ? `${notes}; ${val}` : val;
        continue;
      }
      if (/^(date|order\s*date|তারিখ)$/i.test(rawKey)) {
        const parsedDate = Date.parse(val);
        if (!isNaN(parsedDate)) {
          explicitDate = new Date(parsedDate).toISOString();
        }
        continue;
      }
      if (/^(status|অবস্থা|স্ট্যাটাস)$/i.test(rawKey)) {
        const stLower = val.toLowerCase();
        if (['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'].includes(stLower)) {
          explicitStatus = stLower as OrderStatus;
        }
        continue;
      }
    }

    unlabeledLines.push(seg);
  }

  if (currentPendingProduct && currentPendingProduct.nameText) {
    rawProductEntries.push(currentPendingProduct);
  }

  // Fallback extraction from unlabeled lines (e.g., WhatsApp/Messenger freeform paste)
  for (const line of unlabeledLines) {
    // Extract phone if still missing
    if (!customerPhone) {
      const phoneMatch = line.match(/(?:\+?88)?(01[3-9]\d{8})/);
      if (phoneMatch) {
        customerPhone = phoneMatch[1];
        // If line only has phone, continue
        const withoutPhone = line.replace(/(?:\+?88)?01[3-9]\d{8}/, '').replace(/[,;-]/g, '').trim();
        if (!withoutPhone) continue;
      }
    }

    // Check if line mentions Inside/Outside Dhaka
    if (!explicitArea) {
      if (/inside\s*dhaka|ঢাকার\s*ভিতরে|ঢাকার\s*ভেতরে|ইনসাইড\s*ঢাকা/i.test(line)) {
        explicitArea = 'Inside Dhaka';
      } else if (/outside\s*dhaka|ঢাকার\s*বাইরে|আউটসাইড\s*ঢাকা/i.test(line)) {
        explicitArea = 'Outside Dhaka';
      }
    }

    // Check if line matches a product in catalogue when no structured Product: key was used
    if (rawProductEntries.length === 0) {
      const matchAttempt = matchProductFromCatalogue(line, catalogue);
      if (matchAttempt.product) {
        const qtyMatch = line.match(/(?:x|\*|-|qty|পরিমাণ)?\s*(\d+)\s*(?:pcs|pc|piece|পিস|টি|টা)?/i);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        rawProductEntries.push({
          nameText: line,
          quantity: qty > 0 && qty < 100 ? qty : 1,
        });
        continue;
      }
    }

    if (!customerName && line.length >= 2 && line.length <= 45 && !/\d{4,}/.test(line) && !/road|house|sector|dhaka|রোড|বাসা|ঢাকা/i.test(line)) {
      customerName = line;
      continue;
    }

    if (!fullAddress && line.length >= 5) {
      fullAddress = line;
    }
  }

  // Determine district and deliveryZone
  let district = 'Dhaka';
  let deliveryZone: DeliveryZone = 'inside_dhaka';

  const combinedLocationText = `${explicitArea} ${fullAddress}`.toLowerCase();

  for (const d of BD_DISTRICTS) {
    if (d.aliases.some((alias) => combinedLocationText.includes(alias.toLowerCase()))) {
      district = d.name;
      deliveryZone = d.zone;
      break;
    }
  }

  if (explicitArea) {
    if (/inside\s*dhaka|ঢাকার\s*ভিতরে|ঢাকার\s*ভেতরে|ইনসাইড\s*ঢাকা/i.test(explicitArea)) {
      deliveryZone = 'inside_dhaka';
      district = 'Dhaka';
    } else if (/outside\s*dhaka|ঢাকার\s*বাইরে|আউটসাইড\s*ঢাকা/i.test(explicitArea)) {
      deliveryZone = 'outside_dhaka';
    } else if (/sub\s*dhaka|সাব\s*ঢাকা/i.test(explicitArea)) {
      deliveryZone = 'sub_dhaka';
    }
  }

  const deliveryCharge =
    explicitDeliveryFee !== undefined
      ? explicitDeliveryFee
      : deliveryZone === 'inside_dhaka'
      ? insideDefault
      : outsideDefault;

  // Expand comma/plus separated products if a single Product field contained multiple items
  const expandedProductEntries: Array<{ nameText: string; quantity?: number; unitPrice?: number }> = [];
  for (const entry of rawProductEntries) {
    const parts = entry.nameText
      .split(/\s*(?:\+|&\s+|\band\b|,)\s*/i)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length > 1 && entry.quantity === undefined) {
      for (const p of parts) {
        expandedProductEntries.push({ nameText: p });
      }
    } else {
      expandedProductEntries.push(entry);
    }
  }

  const parsedItems: ParsedOrderLineItem[] = expandedProductEntries.map((entry, idx) => {
    let cleanText = entry.nameText;
    let inlineQty = entry.quantity;
    let inlinePrice = entry.unitPrice;

    // Extract inline quantity patterns like "Islamic Crystal Ball x 2" or "2 pcs Islamic Crystal Ball" or "(2 pcs)"
    const qtyPatternEnd = cleanText.match(/^(.*?)\s*(?:x|\*|×|-)\s*(\d+)\s*(?:pcs|pc|পিস|টি|টা)?$/i);
    const qtyPatternParens = cleanText.match(/^(.*?)\s*\(\s*(\d+)\s*(?:pcs|pc|পিস|টি|টা)?\s*\)$/i);
    const qtyPatternSuffix = cleanText.match(/^(.*?)\s+(\d+)\s*(?:pcs|pc|piece|pieces|পিস|টি|টা)$/i);
    const qtyPatternPrefix = cleanText.match(/^(\d+)\s*(?:pcs|pc|piece|pieces|x|পিস|টি|টা)\s+(.+)$/i);

    if (qtyPatternEnd) {
      cleanText = qtyPatternEnd[1].trim();
      if (inlineQty === undefined) inlineQty = parseInt(qtyPatternEnd[2], 10);
    } else if (qtyPatternParens) {
      cleanText = qtyPatternParens[1].trim();
      if (inlineQty === undefined) inlineQty = parseInt(qtyPatternParens[2], 10);
    } else if (qtyPatternSuffix) {
      cleanText = qtyPatternSuffix[1].trim();
      if (inlineQty === undefined) inlineQty = parseInt(qtyPatternSuffix[2], 10);
    } else if (qtyPatternPrefix) {
      cleanText = qtyPatternPrefix[2].trim();
      if (inlineQty === undefined) inlineQty = parseInt(qtyPatternPrefix[1], 10);
    }

    const match = matchProductFromCatalogue(cleanText, catalogue);
    const prod = match.product;
    const quantity = inlineQty && inlineQty > 0 ? inlineQty : 1;
    // Use explicit unit price if provided, otherwise catalogue sellingPrice
    const unitPrice =
      inlinePrice !== undefined && inlinePrice > 0
        ? inlinePrice
        : prod
        ? prod.sellingPrice
        : 0;
    const availableStock = prod ? Math.max(0, prod.currentStock - prod.reservedStock) : 0;

    return {
      id: `draft-item-${Date.now()}-${idx}`,
      rawProductText: cleanText,
      matchedProductId: prod ? prod.id : null,
      matchedProductName: prod ? prod.name : cleanText || 'Unmatched Product',
      matchedSku: prod ? prod.sku : '',
      quantity,
      unitPrice,
      cataloguePrice: prod ? prod.sellingPrice : 0,
      availableStock,
      subtotal: quantity * unitPrice,
      confidence: match.confidence,
    };
  });

  const initialDraft: ParsedOrderDraft = {
    id: 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    rawText,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    fullAddress: fullAddress.trim(),
    district,
    deliveryZone,
    areaLabel: deliveryZone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka',
    items: parsedItems,
    subtotal: 0,
    discount: explicitDiscount,
    deliveryCharge,
    advancePaid: explicitAdvance,
    totalAmount: 0,
    codAmount: 0,
    paymentMethod,
    courierName: 'Steadfast',
    sourceChannel: 'AI Auto Entry',
    notes: notes.trim(),
    orderDate: explicitDate || new Date().toISOString(),
    initialStatus: explicitStatus,
    missingFields: [],
    ambiguities: [],
    duplicateWarnings: [],
    isValidToCreate: false,
    parserSource: 'rule_engine',
  };

  return recalculateAndValidateDraft(initialDraft, catalogue, existingOrders, settings);
}

/**
 * Splits a batch paste containing multiple customer orders into individual order blocks
 * and parses each one for individual review & confirmation.
 */
export function parseBatchOrderText(
  rawBatchText: string,
  catalogue: Product[],
  existingOrders: Order[] = [],
  settings?: { defaultInsideDhakaFee?: number; defaultOutsideDhakaFee?: number }
): ParsedOrderDraft[] {
  const trimmed = (rawBatchText || '').trim();
  if (!trimmed) return [];

  // Split by explicit dividers (---, ===) or double blank lines
  let blocks = trimmed
    .split(/(?:\r?\n\s*(?:---+|\===+|\*\*\*+)\s*\r?\n)|(?:\r?\n\s*\r?\n)+/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Also check if each line is a complete semicolon-delimited order with its own "Customer Name:" + "Phone:"
  if (blocks.length === 1) {
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const allLinesAreSelfContainedOrders =
      lines.length > 1 &&
      lines.every(
        (l) =>
          (l.includes(';') && /phone|ফোন|মোবাইল|01[3-9]/i.test(l))
      );
    if (allLinesAreSelfContainedOrders) {
      blocks = lines;
    }
  }

  return blocks.map((block, index) => {
    const draft = parseOrderText(block, catalogue, existingOrders, settings);
    return {
      ...draft,
      id: `batch-draft-${Date.now()}-${index}`,
    };
  });
}
