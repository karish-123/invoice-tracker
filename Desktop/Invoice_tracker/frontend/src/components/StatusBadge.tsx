import type { CheckoutStatus } from '../types';

const map: Record<CheckoutStatus, string> = {
  OUTSTANDING: 'bg-amber-100 text-amber-800',
  RETURNED:    'bg-green-100 text-green-800',
  VOIDED:      'bg-gray-100  text-gray-600',
  PAID:        'bg-blue-100  text-blue-800',
};

export default function StatusBadge({ status }: { status: CheckoutStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${map[status]}`}>
      {status}
    </span>
  );
}
