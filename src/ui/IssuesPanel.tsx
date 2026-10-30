import { useStore } from '../state/store';
import { Card } from './fields';

export function IssuesPanel() {
  const { result, tasks } = useStore();
  const name = (id: string) => tasks.find((t) => t.id === id)?.name ?? id;

  if (!result) return <Card><p className="text-sm text-slate-500">Aucun planning généré pour l'instant.</p></Card>;

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
          ⚠️ Planning complet impossible : solution maximale proposée ({result.assignments.length}/{tasks.length} tâches
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
