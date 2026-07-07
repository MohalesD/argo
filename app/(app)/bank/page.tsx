'use client';

import BankPanel from '@/components/qstack/BankPanel';

// Standalone question bank browsing (PRD 5.3): the same retrieval
// surface that lives inside the QStack editor. Adds happen from a
// QStack so the add lands where it belongs (Locality-First); from here
// you browse, filter, and rank.
export default function BankPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl">Question bank</h1>
      <p className="mt-1 text-ink-soft">
        Every question here passed compliance screening and carries its
        provenance. Open a QStack to add questions to it.
      </p>
      <div className="mt-6">
        <BankPanel />
      </div>
    </div>
  );
}
