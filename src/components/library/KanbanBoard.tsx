'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { QStackRow } from './QStackCard';

interface Column {
  id: string;
  name: string;
  position: number;
}

interface PositionRow {
  qstack_id: string;
  column_id: string;
  position: number;
}

interface LastMove {
  qstackId: string;
  fromColumnId: string | null;
  toColumnId: string;
}

const DEFAULT_COLUMNS = ['Drafting', 'Ready to run', 'In rotation'];

// Kanban organization of QStacks (PRD 5.2.2): org-defined columns,
// drag and drop with immediate visible confirmation and an undo
// affordance local to the moved card. Mouse, keyboard (space to lift,
// arrows to move, space to drop), and touch all work via dnd-kit.
export default function KanbanBoard({ orgId, qstacks }: { orgId: string; qstacks: QStackRow[] }) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    let { data: cols } = await supabase
      .from('kanban_columns')
      .select('id, name, position')
      .eq('org_id', orgId)
      .order('position');
    if (!cols || cols.length === 0) {
      // First board open for this org: seed the default columns.
      const { data: created } = await supabase
        .from('kanban_columns')
        .insert(DEFAULT_COLUMNS.map((name, i) => ({ org_id: orgId, name, position: i + 1 })))
        .select('id, name, position');
      cols = created ?? [];
    }
    setColumns((cols as Column[]) ?? []);
    const { data: pos } = await supabase
      .from('qstack_positions')
      .select('qstack_id, column_id, position');
    setPositions((pos as PositionRow[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveCard(qstackId: string, toColumnId: string, recordUndo = true) {
    const prev = positions.find((p) => p.qstack_id === qstackId) ?? null;
    if (prev?.column_id === toColumnId) return;
    const nextPosition =
      Math.max(0, ...positions.filter((p) => p.column_id === toColumnId).map((p) => p.position)) + 1;

    // Optimistic move with local feedback within 200 ms (PRD 5.2).
    setPositions((cur) => [
      ...cur.filter((p) => p.qstack_id !== qstackId),
      { qstack_id: qstackId, column_id: toColumnId, position: nextPosition },
    ]);
    if (recordUndo) setLastMove({ qstackId, fromColumnId: prev?.column_id ?? null, toColumnId });
    setSavedFlash(qstackId);
    setTimeout(() => setSavedFlash(null), 1600);

    const supabase = supabaseBrowser();
    await supabase
      .from('qstack_positions')
      .upsert(
        { qstack_id: qstackId, column_id: toColumnId, position: nextPosition },
        { onConflict: 'qstack_id' },
      );
  }

  async function undoLastMove() {
    if (!lastMove) return;
    const { qstackId, fromColumnId } = lastMove;
    setLastMove(null);
    if (fromColumnId) {
      await moveCard(qstackId, fromColumnId, false);
    } else {
      setPositions((cur) => cur.filter((p) => p.qstack_id !== qstackId));
      await supabaseBrowser().from('qstack_positions').delete().eq('qstack_id', qstackId);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const qstackId = String(event.active.id);
    const over = event.over?.id;
    if (!over) return;
    void moveCard(qstackId, String(over));
  }

  const unplaced = qstacks.filter((q) => !positions.some((p) => p.qstack_id === q.id));

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        <BoardColumn
          key="unplaced"
          columnId="unplaced"
          name="Not on the board"
          droppable={false}
        >
          {unplaced.map((q) => (
            <BoardCard key={q.id} qstack={q} saved={savedFlash === q.id} lastMove={lastMove} onUndo={undoLastMove} />
          ))}
        </BoardColumn>
        {columns.map((col) => (
          <BoardColumn key={col.id} columnId={col.id} name={col.name} droppable>
            {positions
              .filter((p) => p.column_id === col.id)
              .sort((a, b) => a.position - b.position)
              .map((p) => qstacks.find((q) => q.id === p.qstack_id))
              .filter((q): q is QStackRow => !!q)
              .map((q) => (
                <BoardCard key={q.id} qstack={q} saved={savedFlash === q.id} lastMove={lastMove} onUndo={undoLastMove} />
              ))}
          </BoardColumn>
        ))}
      </div>
    </DndContext>
  );
}

function BoardColumn({
  columnId,
  name,
  droppable,
  children,
}: {
  columnId: string;
  name: string;
  droppable: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId, disabled: !droppable });
  return (
    <section
      ref={setNodeRef}
      data-testid="kanban-column"
      aria-label={name}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-3 transition-colors ${
        isOver ? 'border-gold bg-gold-soft' : 'border-line bg-cream'
      }`}
    >
      <h3 className="px-1 text-sm font-semibold text-ink-soft">{name}</h3>
      {children}
    </section>
  );
}

function BoardCard({
  qstack,
  saved,
  lastMove,
  onUndo,
}: {
  qstack: QStackRow;
  saved: boolean;
  lastMove: LastMove | null;
  onUndo: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: qstack.id,
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;
  const justMoved = lastMove?.qstackId === qstack.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="qstack-card"
      aria-label={qstack.title}
      className={`rounded-lg border border-line bg-white p-3 shadow-card ${isDragging ? 'z-20 shadow-lift' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          aria-label={`Move ${qstack.title}`}
          className="cursor-grab touch-none rounded px-1 text-ink-soft hover:bg-cream"
        >
          &#8942;&#8942;
        </button>
        <Link href={`/qstacks/${qstack.id}`} className="text-sm font-medium hover:text-gold-hover">
          {qstack.title}
        </Link>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-6 text-xs text-ink-soft">
        {saved ? <span className="text-forest">Moved</span> : null}
        {justMoved ? (
          <button
            data-testid="kanban-undo"
            onClick={onUndo}
            className="rounded border border-line px-1.5 py-0.5 hover:border-gold"
          >
            Undo move
          </button>
        ) : null}
      </div>
    </div>
  );
}
