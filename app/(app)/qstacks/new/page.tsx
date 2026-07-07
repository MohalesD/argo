'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

const FAMILIES = [
  'engineering', 'product_management', 'sales', 'customer_success', 'people_ops',
  'data_analytics', 'marketing', 'finance', 'operations', 'design',
];
const LEVELS = ['junior', 'mid', 'senior', 'lead'];
const METHODOLOGIES = ['structured_behavioral', 'STAR', 'case_based', 'mixed'];

export default function NewQStackPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [roleFamily, setRoleFamily] = useState('');
  const [level, setLevel] = useState('');
  const [methodology, setMethodology] = useState('structured_behavioral');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ws) return;
    setSaving(true);
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase
      .from('qstacks')
      .insert({
        org_id: ws.orgId,
        owner_id: ws.userId,
        title,
        role_family: roleFamily,
        level,
        methodology,
      })
      .select('id')
      .single();
    if (err || !data) {
      setError(err?.message ?? 'Save failed');
      setSaving(false);
      return;
    }
    router.push(`/qstacks/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl">New QStack</h1>
      <p className="mt-1 text-ink-soft">
        Name it, then build it from the screened bank on the next screen.
      </p>
      <form onSubmit={save} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Title</span>
          <input
            data-testid="qstack-title-input"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior CSM Screening"
            className="rounded-lg border border-line bg-white px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Role family</span>
            <select
              value={roleFamily}
              onChange={(e) => setRoleFamily(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2"
            >
              <option value="">Any</option>
              {FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Level</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2"
            >
              <option value="">Any</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Methodology</span>
          <select
            value={methodology}
            onChange={(e) => setMethodology(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2"
          >
            {METHODOLOGIES.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <button
          data-testid="qstack-save"
          type="submit"
          disabled={saving || !ws}
          className="rounded-lg bg-gold px-4 py-2.5 font-medium hover:bg-gold-hover disabled:opacity-60"
        >
          {saving ? 'Creating...' : 'Create QStack'}
        </button>
        {error ? (
          <p className="text-sm text-flag">Could not create it ({error}). Your fields are intact; adjust and retry.</p>
        ) : null}
      </form>
    </div>
  );
}
