import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOrderText,
  parseBatchOrderText,
  detectDuplicateOrders,
  normalizeBanglaDigits,
} from './aiOrderParser';
import { INITIAL_PRODUCTS, INITIAL_ORDERS } from '../db/database';

test('Extracts exact structured English order from prompt example and matches Islamic Crystal Ball', () => {
  const sampleText =
    'Customer Name: Rahim Uddin; Phone: 01712345678; Address: House 12, Savar, Dhaka; Area: Inside Dhaka; Product: Islamic Crystal Ball; Quantity: 2; Unit Price: 650; Delivery Charge: 80; Payment: Cash on Delivery; Note: Call before delivery.';

  const draft = parseOrderText(sampleText, INITIAL_PRODUCTS, INITIAL_ORDERS, {
    defaultInsideDhakaFee: 80,
    defaultOutsideDhakaFee: 120,
  });

  assert.equal(draft.customerName, 'Rahim Uddin');
  assert.equal(draft.customerPhone, '01712345678');
  assert.equal(draft.fullAddress, 'House 12, Savar, Dhaka');
  assert.equal(draft.deliveryZone, 'inside_dhaka');
  assert.equal(draft.areaLabel, 'Inside Dhaka');
  assert.equal(draft.items.length, 1);
  assert.equal(draft.items[0].matchedProductName, 'Islamic Crystal Ball');
  assert.equal(draft.items[0].matchedSku, 'CGH-ISLAMIC-BALL');
  assert.equal(draft.items[0].quantity, 2);
  assert.equal(draft.items[0].unitPrice, 650);
  assert.equal(draft.items[0].subtotal, 1300);
  assert.equal(draft.subtotal, 1300);
  assert.equal(draft.deliveryCharge, 80);
  assert.equal(draft.totalAmount, 1380);
  assert.equal(draft.codAmount, 1380);
  assert.equal(draft.paymentMethod, 'Cash on Delivery');
  assert.equal(draft.notes, 'Call before delivery.');
  assert.equal(draft.isValidToCreate, true);
});

test('Parses Bangla customer order with Bangla numerals and matches Bangla product name', () => {
  const banglaText = `নাম: নুসরাত জাহান
মোবাইল: ০১৮১৯৫৫৬৬৭৭
ঠিকানা: বাসা ২৪, রোড ৯, ধানমন্ডি, ঢাকা
এরিয়া: ঢাকার ভিতরে
পণ্য: ৩ডি ক্রিস্টাল পদ্মফুল এলইডি বাতি
পরিমাণ: ২ পিস
দাম: ১৮৫০
ডেলিভারি চার্জ: ৮০
পেমেন্ট: ক্যাশ অন ডেলিভারি
নোট: গিফট বক্স দেবেন`;

  const draft = parseOrderText(banglaText, INITIAL_PRODUCTS, []);
  assert.equal(normalizeBanglaDigits('০১৮১৯৫৫৬৬৭৭'), '01819556677');
  assert.equal(draft.customerName, 'নুসরাত জাহান');
  assert.equal(draft.customerPhone, '01819556677');
  assert.equal(draft.deliveryZone, 'inside_dhaka');
  assert.equal(draft.items.length, 1);
  assert.equal(draft.items[0].matchedSku, 'CGH-LOTUS-3D');
  assert.equal(draft.items[0].quantity, 2);
  assert.equal(draft.subtotal, 3700);
  assert.equal(draft.deliveryCharge, 80);
  assert.equal(draft.totalAmount, 3780);
  assert.equal(draft.isValidToCreate, true);
});

test('Parses multi-product Outside Dhaka order with default 120 BDT delivery fee and discount', () => {
  const multiText = `Customer Name: Tareq Mahmud
Phone: 01911445566
Address: Flat 4B, Love Lane, Chattogram
Area: Outside Dhaka
Product: Galaxy Crystal Ball x 2, Crystal Swan x 1
Discount: 100
Payment: bKash
Advance: 300`;

  const draft = parseOrderText(multiText, INITIAL_PRODUCTS, []);
  assert.equal(draft.deliveryZone, 'outside_dhaka');
  assert.equal(draft.deliveryCharge, 120);
  assert.equal(draft.items.length, 2);
  assert.equal(draft.items[0].matchedSku, 'CGH-MOON-BALL');
  assert.equal(draft.items[0].quantity, 2);
  assert.equal(draft.items[1].matchedSku, 'CGH-SWAN-PAIR');
  assert.equal(draft.items[1].quantity, 1);
  // Subtotal = 2 * 1250 + 1 * 1650 = 4150
  assert.equal(draft.subtotal, 4150);
  assert.equal(draft.discount, 100);
  // Total = 4150 - 100 + 120 = 4170; COD = 4170 - 300 = 3870
  assert.equal(draft.totalAmount, 4170);
  assert.equal(draft.codAmount, 3870);
  assert.equal(draft.isValidToCreate, true);
});

test('Flags missing fields and unmatched products without inventing data or auto-creating products', () => {
  const incompleteText = `Customer Name: Karim
Address: Mirpur 10, Dhaka
Product: Unknown Magic Carpet Lamp
Quantity: 1`;

  const draft = parseOrderText(incompleteText, INITIAL_PRODUCTS, []);
  assert.equal(draft.isValidToCreate, false);
  assert.ok(draft.missingFields.includes('Phone Number'));
  assert.equal(draft.items[0].matchedProductId, null);
  assert.ok(draft.ambiguities.some((a) => a.includes('Unmatched product')));
});

test('Detects duplicate orders when customer phone matches an active order', () => {
  // ord-101 in INITIAL_ORDERS has phone 01712987654, ord-102 has 01811223344 (shipped)
  const dupText = `Customer Name: Farhana Akter; Phone: 01811223344; Address: Nasirabad, Chattogram; Area: Outside Dhaka; Product: Galaxy Crystal Ball; Quantity: 1`;
  const draft = parseOrderText(dupText, INITIAL_PRODUCTS, INITIAL_ORDERS);
  assert.ok(draft.duplicateWarnings.length > 0);
  assert.equal(draft.duplicateWarnings[0].orderNumber, 'CGH-202610-002');
});

test('Parses batch multi-order paste into individual reviewable drafts', () => {
  const batchText = `Customer Name: Rahim Uddin; Phone: 01712345678; Address: House 12, Savar, Dhaka; Area: Inside Dhaka; Product: Islamic Crystal Ball; Quantity: 2; Unit Price: 650; Delivery Charge: 80; Payment: Cash on Delivery
---
Customer Name: Sadia Afrin; Phone: 01612889900; Address: Zindabazar, Sylhet; Area: Outside Dhaka; Product: 3D Crystal Lotus Flower LED Lamp; Quantity: 1; Unit Price: 1850; Delivery Charge: 120; Payment: Cash on Delivery`;

  const drafts = parseBatchOrderText(batchText, INITIAL_PRODUCTS, []);
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].customerName, 'Rahim Uddin');
  assert.equal(drafts[0].totalAmount, 1380);
  assert.equal(drafts[1].customerName, 'Sadia Afrin');
  assert.equal(drafts[1].totalAmount, 1970);
});
