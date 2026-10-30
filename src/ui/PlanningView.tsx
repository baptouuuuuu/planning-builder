import { useState } from 'react';
import { exportPlanningText } from '../domain/exportText';
import { useStore } from '../state/store';
import { IssuesPanel } from './IssuesPanel';
import { Timeline } from './Timeline';
import { btnGhost, btnPrimary } from './fields';

export function PlanningView() {
  const { generate, regenerate, clearUnlocked, assignments, tasks, people, settings } = useStore();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(exportPlanningText(people, tasks, assignments, settings));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const locked = assignments.filter((a) => a.locked).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold">Planning</h2>
        <button className={btnPrimary} onClick={generate} disabled={tasks.length === 0}>Générer</button>
        <button className={btnGhost} onClick={regenerate} disabled={tasks.length === 0}>🎲 Régénérer</button>
        <button className={btnGhost} onClick={copy} disabled={assignments.length === 0}>
          {copied ? '✓ Copié' : '📋 Copier le résumé'}
        </button>
        <button className={btnGhost} onClick={clearUnlocked} disabled={assignments.length === locked}>
          Vider (garde 🔒)
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Cliquez sur un créneau pour le verrouiller 🔒 : « Régénérer » ne replanifie que le reste. {locked} verrouillé(s).
      </p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Timeline />
        <IssuesPanel />
      </div>
    </div>
  );
}
