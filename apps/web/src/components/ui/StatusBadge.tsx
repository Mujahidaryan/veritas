import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface Props {
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'authentic' | 'tampered' | 'revoked' | 'expired' | 'not_found';
}

const map = {
  ACTIVE:    { label: 'Active',    cls: 'badge-green',  Icon: CheckCircle2 },
  active:    { label: 'Active',    cls: 'badge-green',  Icon: CheckCircle2 },
  authentic: { label: 'Authentic', cls: 'badge-green',  Icon: CheckCircle2 },
  REVOKED:   { label: 'Revoked',   cls: 'badge-red',    Icon: XCircle },
  revoked:   { label: 'Revoked',   cls: 'badge-red',    Icon: XCircle },
  tampered:  { label: 'Tampered',  cls: 'badge-red',    Icon: XCircle },
  EXPIRED:   { label: 'Expired',   cls: 'badge-amber',  Icon: Clock },
  expired:   { label: 'Expired',   cls: 'badge-amber',  Icon: Clock },
  not_found: { label: 'Not found', cls: 'badge-slate',  Icon: Clock },
};

export function StatusBadge({ status }: Props) {
  const { label, cls, Icon } = map[status] ?? map.not_found;
  return (
    <span className={cls}>
      <Icon size={10} />
      {label}
    </span>
  );
}
