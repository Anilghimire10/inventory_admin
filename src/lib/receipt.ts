import type { SubscriptionReceipt } from '@/lib/api';

/** Every value here is typed in by someone (shop names, references), so escape it. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/**
 * Open a subscription receipt in a new window and print it. A4, one page:
 * who was paid (the platform, from Settings), who paid, what for, how much.
 */
export function printReceipt(r: SubscriptionReceipt) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) {
    alert('Please allow pop-ups to print the receipt.');
    return;
  }
  const seller = [
    r.seller.name && `<div style="font-size:18px;font-weight:700">${esc(r.seller.name)}</div>`,
    r.seller.address && `<div>${esc(r.seller.address)}</div>`,
    [r.seller.phone, r.seller.email].filter(Boolean).length
      ? `<div>${[r.seller.phone, r.seller.email].filter(Boolean).map((v) => esc(v!)).join(' · ')}</div>`
      : '',
    r.seller.taxId && `<div>PAN/VAT: ${esc(r.seller.taxId)}</div>`,
  ]
    .filter(Boolean)
    .join('');
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:#475569">${label}</td><td style="padding:8px 0;text-align:right">${value}</td></tr>`;
  const amount = `${esc(r.currency)} ${r.amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>Receipt ${esc(r.receiptNo)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; }
</style></head><body>
  <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start">
    <div style="color:#475569;line-height:1.5">${seller}</div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:700">RECEIPT</div>
      <div style="color:#475569">${esc(r.receiptNo)}</div>
      <div style="color:#475569">${day(r.issuedAt)}</div>
    </div>
  </div>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
  <div style="color:#475569">Received from</div>
  <div style="font-size:16px;font-weight:600">${esc(r.buyer.name)}</div>
  ${r.buyer.taxId ? `<div style="color:#475569">PAN/VAT: ${esc(r.buyer.taxId)}</div>` : ''}
  <table style="margin-top:20px">
    ${row('For', 'Subscription')}
    ${row('Period', `${day(r.periodFrom)} to ${day(r.periodTo)}`)}
    ${row('Paid by', esc(r.methodLabel))}
    ${r.reference ? row('Reference', esc(r.reference)) : ''}
    <tr>
      <td style="padding:12px 0 0;border-top:2px solid #0f172a;font-weight:700;font-size:16px">Amount received</td>
      <td style="padding:12px 0 0;border-top:2px solid #0f172a;text-align:right;font-weight:700;font-size:16px">${amount}</td>
    </tr>
  </table>
  <p style="margin-top:40px;color:#94a3b8;font-size:12px">Thank you for your payment.</p>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`);
  w.document.close();
}
