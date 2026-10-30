import { useStore } from '../state/store';
import type { Task } from '../domain/types';
import { Card, IntervalField, btnDanger, btnGhost, inputCls } from './fields';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function TasksView() {
  const { tasks, setTasks, people, settings } = useStore();
  const update = (id: string, patch: Partial<Task>) =>
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const add = () =>
    setTasks([
      ...tasks,
      {
        id: crypto.randomUUID(),
        name: `Tâche ${tasks.length + 1}`,
        duration: 60,
        preferredPersonIds: [],
        dependsOn: [],
        chainSamePerson: false,
      },
    ]);
  const remove = (id: string) =>
    setTasks(tasks.filter((t) => t.id !== id).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => d !== id) })));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tâches</h2>
        <button className={btnGhost} onClick={add}>+ Ajouter une tâche</button>
      </div>
      {tasks.length === 0 && <p className="text-slate-500">Aucune tâche.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.map((t) => (
          <Card key={t.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                aria-label="Nom de la tâche"
                className={`${inputCls} flex-1 font-medium`}
                value={t.name}
                onChange={(e) => update(t.id, { name: e.target.value })}
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="number"
                  min={1}
                  aria-label="Durée en minutes"
                  className={`${inputCls} w-20`}
                  value={t.duration}
                  onChange={(e) => update(t.id, { duration: Math.max(1, Number(e.target.value) || 1) })}
                />
                min
              </label>
              <button className={btnDanger} onClick={() => remove(t.id)}>Supprimer</button>
            </div>

            <fieldset className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!t.window}
                  onChange={(e) =>
                    update(t.id, { window: e.target.checked ? { start: 9 * 60, end: 17 * 60 } : undefined })
                  }
                />
                Plage horaire imposée (contrainte dure)
              </label>
              {t.window && (
                <IntervalField label="Plage imposée" value={t.window} days={settings.horizonDays} onChange={(window) => update(t.id, { window })} />
              )}
            </fieldset>

            <fieldset className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!t.preferredWindow}
                  onChange={(e) =>
                    update(t.id, { preferredWindow: e.target.checked ? { start: 9 * 60, end: 12 * 60 } : undefined })
                  }
                />
                Plage horaire préférée (souple)
              </label>
              {t.preferredWindow && (
                <IntervalField
                  label="Plage préférée"
                  value={t.preferredWindow}
                  days={settings.horizonDays}
                  onChange={(preferredWindow) => update(t.id, { preferredWindow })}
                />
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">Personnes préférées</legend>
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={t.preferredPersonIds.includes(p.id)}
                      onChange={() => update(t.id, { preferredPersonIds: toggle(t.preferredPersonIds, p.id) })}
                    />
                    <span style={{ color: p.color }}>●</span> {p.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">Doit suivre (dépendances)</legend>
              <div className="flex flex-wrap gap-2">
                {tasks
                  .filter((o) => o.id !== t.id)
                  .map((o) => (
                    <label key={o.id} className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={t.dependsOn.includes(o.id)}
                        onChange={() => update(t.id, { dependsOn: toggle(t.dependsOn, o.id) })}
                      />
                      {o.name}
                    </label>
                  ))}
              </div>
              {t.dependsOn.length > 0 && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={t.chainSamePerson}
                    onChange={(e) => update(t.id, { chainSamePerson: e.target.checked })}
                  />
                  Enchaîner avec la même personne
                </label>
              )}
            </fieldset>
          </Card>
        ))}
      </div>
    </div>
  );
}
