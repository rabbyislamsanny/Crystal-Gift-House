/**
 * Inventory & Stock Logic for Crystal Gift House Business OS
 * Enforces:
 * 1. Available Stock = On-Hand Stock - Reserved Stock
 * 2. Weighted-Average Cost (WAC) formula
 * 3. Consistent reservation on confirmation, deduction on dispatch,
 *    safe release on cancellation, and inspection-based restock on return.
 */

export interface StockState {
  onHand: number;
  reserved: number;
  purchaseCost: number; // current WAC
  damagedStock: number;
}

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

export type ReturnDisposition = 'restock' | 'damaged' | 'scrap';

/**
 * Calculate available stock
 */
export function calculateAvailableStock(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

/**
 * Weighted Average Cost (WAC) calculation when new batch is received
 * Formula: ((CurrentOnHand * CurrentWAC) + (ReceivedQty * LandedUnitCost)) / (CurrentOnHand + ReceivedQty)
 */
export function calculateWeightedAverageCost(
  currentOnHand: number,
  currentWac: number,
  receivedQty: number,
  landedUnitCost: number
): number {
  if (receivedQty <= 0) return currentWac;
  if (currentOnHand <= 0) return Math.round(landedUnitCost * 100) / 100;

  const totalCurrentValue = currentOnHand * currentWac;
  const totalNewValue = receivedQty * landedUnitCost;
  const totalUnits = currentOnHand + receivedQty;

  const newWac = (totalCurrentValue + totalNewValue) / totalUnits;
  return Math.round(newWac * 100) / 100;
}

/**
 * Reserve stock when order transitions to confirmed/processing/packed
 */
export function reserveStockForOrder(
  state: StockState,
  quantity: number,
  allowBackorder: boolean = false
): { success: boolean; newState: StockState; error?: string } {
  const available = calculateAvailableStock(state.onHand, state.reserved);
  if (!allowBackorder && quantity > available) {
    return {
      success: false,
      newState: state,
      error: `Insufficient available stock (${available} available, ${quantity} requested)`,
    };
  }

  return {
    success: true,
    newState: {
      ...state,
      reserved: state.reserved + quantity,
    },
  };
}

/**
 * Deduct physical inventory when parcel is dispatched/shipped
 * Clears the reservation and reduces physical onHand
 */
export function dispatchStock(
  state: StockState,
  quantity: number
): { success: boolean; newState: StockState; error?: string } {
  if (state.onHand < quantity) {
    return {
      success: false,
      newState: state,
      error: `Cannot dispatch: on-hand stock is only ${state.onHand}`,
    };
  }

  return {
    success: true,
    newState: {
      ...state,
      onHand: state.onHand - quantity,
      reserved: Math.max(0, state.reserved - quantity),
    },
  };
}

/**
 * Cancel order before dispatch: release reserved stock
 */
export function cancelPreDispatchReservation(
  state: StockState,
  reservedQty: number
): StockState {
  return {
    ...state,
    reserved: Math.max(0, state.reserved - reservedQty),
  };
}

/**
 * Handle returned goods inspection
 * Restock: adds back to sellable on-hand
 * Damaged: adds to damagedStock ledger, never to sellable on-hand
 * Scrap: discarded, stock not returned
 */
export function inspectAndProcessReturn(
  state: StockState,
  quantity: number,
  disposition: ReturnDisposition
): { newState: StockState; restockedQty: number; damagedQty: number; scrapQty: number } {
  if (disposition === 'restock') {
    return {
      newState: {
        ...state,
        onHand: state.onHand + quantity,
      },
      restockedQty: quantity,
      damagedQty: 0,
      scrapQty: 0,
    };
  } else if (disposition === 'damaged') {
    return {
      newState: {
        ...state,
        damagedStock: (state.damagedStock || 0) + quantity,
      },
      restockedQty: 0,
      damagedQty: quantity,
      scrapQty: 0,
    };
  } else {
    return {
      newState: state,
      restockedQty: 0,
      damagedQty: 0,
      scrapQty: quantity,
    };
  }
}
