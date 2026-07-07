'use client';

import Link from 'next/link';

export interface QStackRow {
  id: string;
  title: string;
  role_family: string;
  level: string;
  methodology: string;
  visibility: 'private' | 'org' | 'public';
  forked_from_id: string | null;
  star_count: number;
  owner_id: string;
  org_id: string;
  created_at: string;
}

// One QStack rendered as a list row or a card stack. Both variants keep
// the same actions in the same relative positions (Locality-First rule
// 11): title opens, metadata chips center, stars right.
export default function QStackCard({
  qstack,
  variant,
}: {
  qstack: QStackRow;
  variant: 'row' | 'stack';
}) {
  const meta = [qstack.role_family, qstack.level, qstack.methodology].filter(Boolean);

  if (variant === 'row') {
    return (
      <Link
        data-testid="qstack-card"
        aria-label={qstack.title}
        href={`/qstacks/${qstack.id}`}
        className="flex items-center gap-4 rounded-lg border border-line bg-white px-5 py-4 shadow-card transition-shadow hover:shadow-lift"
      >
        <span className="font-display text-lg">{qstack.title}</span>
        <span className="flex gap-2 text-xs text-ink-soft">
          {meta.map((m) => (
            <span key={m} className="rounded-full bg-cream px-2 py-0.5">
              {m}
            </span>
          ))}
        </span>
        {qstack.forked_from_id ? (
          <span className="text-xs text-forest">forked</span>
        ) : null}
        <span className="ml-auto flex items-center gap-3 text-sm text-ink-soft">
          <span className="rounded-full border border-line px-2 py-0.5 text-xs">
            {qstack.visibility}
          </span>
          <span aria-label={`${qstack.star_count} stars`}>
            <span className="text-gold">&#9733;</span> {qstack.star_count}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="relative">
      {/* The stack illusion: two offset card edges behind the real card. */}
      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl border border-line bg-white" />
      <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl border border-line bg-white" />
      <Link
        data-testid="qstack-card"
        aria-label={qstack.title}
        href={`/qstacks/${qstack.id}`}
        className="relative block rounded-xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-lg leading-snug">{qstack.title}</span>
          <span className="shrink-0 text-sm text-ink-soft" aria-label={`${qstack.star_count} stars`}>
            <span className="text-gold">&#9733;</span> {qstack.star_count}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-soft">
          {meta.map((m) => (
            <span key={m} className="rounded-full bg-cream px-2 py-0.5">
              {m}
            </span>
          ))}
          <span className="rounded-full border border-line px-2 py-0.5">{qstack.visibility}</span>
          {qstack.forked_from_id ? <span className="text-forest">forked</span> : null}
        </div>
      </Link>
    </div>
  );
}
