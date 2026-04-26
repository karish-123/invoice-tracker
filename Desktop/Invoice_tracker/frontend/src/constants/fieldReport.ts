import type { FieldReportStatus, FieldReportRemark } from '../types';

export const STATUS_OPTIONS: { value: FieldReportStatus; label: string }[] = [
  { value: 'VISITED',            label: 'Visited' },
  { value: 'ORDER_DONE',         label: 'Order Done' },
  { value: 'PAYMENT_DONE',       label: 'Payment Done' },
  { value: 'ORDER_PAYMENT_DONE', label: 'Order / Payment Done' },
];

export const REMARK_OPTIONS: { value: FieldReportRemark; label: string }[] = [
  { value: 'WITH_STAND',          label: 'With Stand' },
  { value: 'URGENT',              label: 'Urgent' },
  { value: 'PAYMENT_ON_DELIVERY', label: 'Payment on Delivery' },
  { value: 'IMMEDIATE_PAYMENT',   label: 'Immediate Payment' },
  { value: 'CUSTOM',              label: 'Custom Message' },
];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map(o => [o.value, o.label])
);

export const REMARK_LABEL: Record<string, string> = Object.fromEntries(
  REMARK_OPTIONS.map(o => [o.value, o.label])
);

export const ORDER_STATUSES = new Set<FieldReportStatus>([
  'ORDER_DONE', 'PAYMENT_DONE', 'ORDER_PAYMENT_DONE',
]);
