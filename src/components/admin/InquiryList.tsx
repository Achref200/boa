'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { setInquiryHandledAction } from '@/modules/admin/actions/commerce';
import { formatDateTime } from '@/lib/datetime';

export type InquiryRow = {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  isHandled: boolean;
  createdAt: Date;
};

/**
 * Messages are stored, not emailed — BOA's mail configuration is not known yet,
 * and a message that fails to send silently is worse than one waiting here.
 * Marking a message handled is the whole workflow; there is no reply-from-admin
 * because a reply from an unverified sending domain would land in spam.
 */
export function InquiryList({ inquiries }: { inquiries: InquiryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (id: string, handled: boolean) => {
    startTransition(async () => {
      const result = await setInquiryHandledAction({ id, handled });
      if (result.ok) router.refresh();
    });
  };

  if (inquiries.length === 0) {
    return (
      <p className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 py-10 text-center text-sm text-[var(--surface-muted)]">
        Aucun message.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {inquiries.map((inquiry) => (
        <li key={inquiry.id} className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="font-medium">{inquiry.name}</p>
            <a href={`mailto:${inquiry.email}`} className="text-sm underline underline-offset-4">
              {inquiry.email}
            </a>
            {inquiry.phone ? (
              <a href={`tel:${inquiry.phone}`} className="text-sm underline underline-offset-4">
                {inquiry.phone}
              </a>
            ) : null}
            {inquiry.company ? (
              <span className="text-sm text-[var(--surface-muted)]">{inquiry.company}</span>
            ) : null}
            <StatusBadge tone={inquiry.kind === 'PROFESSIONAL' ? 'informative' : 'neutral'}>
              {inquiry.kind === 'PROFESSIONAL' ? 'Professionnel' : 'Contact'}
            </StatusBadge>
            <span className="text-xs tabular-nums text-[var(--surface-muted)]">
              {formatDateTime(inquiry.createdAt)}
            </span>

            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(inquiry.id, !inquiry.isHandled)}
              className="ms-auto min-h-10 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
            >
              {inquiry.isHandled ? 'Rouvrir' : 'Marquer traité'}
            </button>
          </div>

          {inquiry.subject ? (
            <p className="mt-3 text-sm font-medium">{inquiry.subject}</p>
          ) : null}
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--surface-muted)]">
            {inquiry.message}
          </p>
        </li>
      ))}
    </ul>
  );
}
