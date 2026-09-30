import { describe, expect, it } from 'vitest';
import { receiptHtml } from './receipt';
import { receiptLabel, type SubscriptionReceipt } from './api';

const base: SubscriptionReceipt = {
  receiptNo: 'SUB-000042',
  issuedAt: '2026-09-28T10:00:00.000Z',
  seller: { name: 'Inventory Cloud Pvt. Ltd.', taxId: '609876543', address: null, phone: null, email: null },
  buyer: { businessId: 'b1', name: 'Demo Store', taxId: null },
  amount: 2000,
  currency: 'NPR',
  methodLabel: 'Cash',
  reference: null,
  periodFrom: '2026-09-25T00:00:00.000Z',
  periodTo: '2026-10-25T00:00:00.000Z',
};

describe('receipts', () => {
  it('numbers match the API: SUB- and six digits', () => {
    expect(receiptLabel(42)).toBe('SUB-000042');
    expect(receiptLabel(1234567)).toBe('SUB-1234567');
  });

  it('prints the number, seller, PAN, shop and period', () => {
    const html = receiptHtml(base);
    for (const s of ['SUB-000042', 'Inventory Cloud Pvt. Ltd.', 'PAN/VAT: 609876543', 'Demo Store', '2026-09-25 to 2026-10-25']) {
      expect(html).toContain(s);
    }
  });

  it('escapes anything typed in, so a shop name cannot inject markup', () => {
    const html = receiptHtml({ ...base, buyer: { ...base.buyer, name: '<img src=x onerror=alert(1)>' }, reference: '"><b>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&#60;img src=x onerror=alert(1)&#62;');
    expect(html).not.toContain('"><b>');
  });

  it('leaves out seller lines that are not set', () => {
    const html = receiptHtml({ ...base, seller: { name: null, taxId: null, address: null, phone: null, email: null } });
    expect(html).not.toContain('PAN/VAT:');
  });
});
