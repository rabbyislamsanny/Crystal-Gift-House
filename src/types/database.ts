export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned'
  | 'partially_returned';

export type ParcelStatus =
  | 'pending_dispatch'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'settled';

export type MovementType =
  | 'purchase_receipt'
  | 'reservation'
  | 'reservation_release'
  | 'dispatch'
  | 'return_restock'
  | 'damage_writeoff'
  | 'adjustment';

export type DeliveryZone = 'inside_dhaka' | 'sub_dhaka' | 'outside_dhaka';

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string; // e.g. "Warm White LED Base"
  additionalCost: number;
  sellingPrice: number;
  currentStock: number;
  reservedStock: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  banglaName?: string;
  category: string;
  supplierId: string;
  supplierName: string;
  purchaseCost: number; // Current WAC in BDT
  sellingPrice: number; // In BDT
  openingStock: number;
  currentStock: number; // Physical On-Hand
  reservedStock: number; // Allocated to confirmed orders
  lowStockThreshold: number;
  packagingCost: number;
  damagedStock: number;
  notes?: string;
  isArchived?: boolean;
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  company: string;
  address: string;
  currentBalance: number; // Payable to supplier
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitCost: number;
  landedUnitCost: number; // Includes allocated shipping/import charge
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  status: 'ordered' | 'received' | 'cancelled';
  items: PurchaseItem[];
  subtotal: number;
  shippingCharges: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  notes?: string;
  receivedDate?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  variantId?: string;
  movementType: MovementType;
  quantity: number;
  previousOnHand: number;
  newOnHand: number;
  previousReserved: number;
  newReserved: number;
  reason: string;
  referenceId: string; // orderId, poId, or adjustmentId
  performedBy: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  district: string;
  totalOrders: number;
  totalDelivered: number;
  totalCancelled: number;
  totalReturned: number;
  createdAt: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number; // BDT
  unitCostSnapshot: number; // Cost at time of sale for accurate COGS
  subtotal: number;
}

export interface StatusChangeRecord {
  status: OrderStatus;
  timestamp: string;
  note: string;
  changedBy: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fullAddress: string;
  district: string;
  deliveryZone: DeliveryZone;
  items: OrderItem[];
  itemTotal: number;
  discount: number;
  deliveryFeeCharged: number;
  advancePaid: number;
  advancePaymentMethod?: string;
  codAmount: number; // (itemTotal - discount + deliveryFeeCharged) - advancePaid
  courierName: string;
  consignmentNumber?: string;
  sourceChannel: 'Facebook Page' | 'WhatsApp' | 'Website' | 'TikTok' | 'Direct Call' | 'Showroom';
  status: OrderStatus;
  orderDate: string; // ISO
  deliveryDate?: string;
  cancelReason?: string;
  returnReason?: string;
  returnDisposition?: 'restock' | 'damaged' | 'scrap';
  notes?: string;
  refundAmount: number;
  statusTimeline: StatusChangeRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Parcel {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  courierName: string;
  trackingNumber: string;
  consignmentId: string;
  codAmount: number;
  deliveryCharge: number;
  returnCharge: number;
  collectedAmount: number;
  settledAmount: number;
  isSettled: boolean;
  settlementDate?: string;
  dispatchDate: string;
  deliveryDate?: string;
  status: ParcelStatus;
  attempts: number;
  notes?: string;
  createdAt: string;
}

export interface AdExpenseAllocationItem {
  date: string;
  bdtAmount: number;
}

export interface AdExpense {
  id: string;
  platform: 'Meta / Facebook' | 'Google' | 'TikTok' | 'Other';
  campaignName: string;
  startDate: string;
  endDate: string;
  usdAmount: number;
  exchangeRate: number;
  bdtEquivalent: number;
  feeBdt: number; // Bank VAT / AIT fees
  totalBdt: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  allocationMethod: 'even' | 'manual';
  allocations: AdExpenseAllocationItem[];
  createdAt: string;
}

export interface OperatingExpense {
  id: string;
  category:
    | 'Packaging'
    | 'Salaries'
    | 'Rent'
    | 'Internet & Tools'
    | 'Courier Fees'
    | 'Payment Gateway'
    | 'Office & Refreshment'
    | 'Damaged Goods'
    | 'Marketing Misc'
    | 'Other';
  date: string;
  amount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paymentMethod: string;
  reference?: string;
  notes?: string;
  isCourierFee?: boolean; // If true, flagged so P&L doesn't double-count with parcel settlements
  createdAt: string;
}

export interface CourierSettlement {
  id: string;
  settlementNumber: string;
  courierName: string;
  date: string;
  totalCodCollected: number;
  courierFeesDeducted: number;
  netAmountSettled: number;
  bankAccountId: string;
  parcelIds: string[];
  notes?: string;
  createdAt: string;
}

export interface BankCashAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  balance: number;
  accountType: 'mfs' | 'bank' | 'cash';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  performedBy: string;
}

export interface AppSettings {
  businessName: string;
  banglaBusinessName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  currencySymbol: string;
  defaultExchangeRate: number; // BDT per USD
  defaultInsideDhakaFee: number;
  defaultSubDhakaFee: number;
  defaultOutsideDhakaFee: number;
  ownerPin: string;
  timezone: string;
}

export interface DatabaseState {
  products: Product[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  stockMovements: StockMovement[];
  customers: Customer[];
  orders: Order[];
  parcels: Parcel[];
  adExpenses: AdExpense[];
  operatingExpenses: OperatingExpense[];
  courierSettlements: CourierSettlement[];
  bankAccounts: BankCashAccount[];
  auditLogs: AuditLog[];
  settings: AppSettings;
}
