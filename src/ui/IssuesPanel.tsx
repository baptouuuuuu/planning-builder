import { useStore } from '../state/store';
import { scheduledTasks } from '../domain/types';
import { validate } from '../solver/validate';
import { Card } from './fields';

export function IssuesPanel() {
  const { result, tasks, assignments, people, settings } = useStore();
  const scheduled = scheduledTasks(tasks);
  const name = (id: string) => scheduled.find((t) => t.id === id)?.name ?? id;

  if (!result) {
    if (!assignments.length) return <Card><p className="text-sm text-slate-500">Aucun planning généré pour l'instant.</p></Card>;
    const conflicts = validate({ people, tasks, settings }, assignments);
    const assigned = new Set(assignments.map((a) => a.taskId));
    const missing = scheduled.filter((t) => !assigned.has(t.id));
    return <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Conflits &amp; non planifiées</h2>
      <p className="text-sm text-slate-500">Planning modifié : le score sera recalculé à la prochaine génération.</p>
      {conflicts.length === 0 && missing.length === 0 && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">✅ Toutes les tâches sont planifiées sans conflit.</p>}
      {conflicts.length > 0 && <div role="alert" className="space-y-1 text-sm text-red-700">
        <h3 className="font-semibold">Conflits ({conflicts.length})</h3>
        {conflicts.map((c, i) => <p key={i} className="rounded-md bg-red-50 p-2"><strong>{name(c.taskId)}</strong> — {c.message}</p>)}
      </div>}
      {missing.length > 0 && <div className="space-y-1 text-sm">
        <h3 className="font-semibold">Non planifiées ({missing.length})</h3>
        {missing.map((t) => <p key={t.id} className="rounded-md bg-slate-50 p-2">{t.name}</p>)}
      </div>}
    </Card>;
  }

  const { unscheduled, conflicts, score, maxScore, penalty, seed } = result;
  const pct = maxScore ? Math.round((score / maxScore) * 100) : 100;

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Conflits &amp; non planifiées</h2>
      <p className="text-sm">
        Score : <strong>{score}</strong> / {maxScore} ({pct}%) · pénalité préférences : {penalty} · seed {seed}
      </p>
      {unscheduled.length > 0 && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ Planning complet impossible : solution maximale proposée ({result.assignments.length}/{scheduled.length} tâches
          planifiées).
        </div>
      )}
      {unscheduled.length === 0 && conflicts.length === 0 && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">✅ Toutes les tâches sont planifiées sans conflit.</p>
      )}
      {unscheduled.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Non planifiées ({unscheduled.length})</h3>
          <ul className="space-y-1 text-sm">
            {unscheduled.map((u) => (
              <li key={u.taskId} className="rounded-md bg-slate-50 p-2">
                <strong>{name(u.taskId)}</strong> — {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {conflicts.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-red-700">Conflits ({conflicts.length})</h3>
          <ul className="space-y-1 text-sm">
            {conflicts.map((c, i) => (
              <li key={i} className="rounded-md bg-red-50 p-2">
                <strong>{name(c.taskId)}</strong> — {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
