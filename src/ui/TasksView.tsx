import { useStore } from '../state/store';
import type { Task } from '../domain/types';
import { wouldCycle } from '../domain/types';
import { Card, IntervalField, NumberField, btnDanger, btnGhost, inputCls } from './fields';

type Relation = 'none' | 'linked' | 'follows' | 'followed';

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
        linkedTo: [],
        chainSamePerson: false,
      },
    ]);
  const duplicate = (t: Task) => {
    const i = tasks.findIndex((x) => x.id === t.id);
    const copy: Task = {
      ...t,
      id: crypto.randomUUID(),
      name: `${t.name} (copie)`,
      preferredPersonIds: [...t.preferredPersonIds],
      dependsOn: [...t.dependsOn],
      linkedTo: [...t.linkedTo],
    };
    setTasks([...tasks.slice(0, i + 1), copy, ...tasks.slice(i + 1)]);
  };
  const relationOf = (t: Task, o: Task): Relation =>
    t.linkedTo.includes(o.id) ? 'linked'
    : t.dependsOn.includes(o.id) ? 'follows' : o.dependsOn.includes(t.id) ? 'followed' : 'none';
  /** Tâches sans le lien existant entre t et o, pour tester si un nouveau lien créerait une boucle. */
  const withoutLink = (t: Task, o: Task): Task[] =>
    tasks.map((x) =>
      x.id === t.id ? { ...x, dependsOn: x.dependsOn.filter((d) => d !== o.id), linkedTo: x.linkedTo.filter((d) => d !== o.id) }
      : x.id === o.id ? { ...x, dependsOn: x.dependsOn.filter((d) => d !== t.id), linkedTo: x.linkedTo.filter((d) => d !== t.id) }
      : x,
    );
  const setRelation = (t: Task, o: Task, rel: Relation) =>
    setTasks(
      withoutLink(t, o).map((x) =>
        rel === 'linked' && x.id === t.id ? { ...x, linkedTo: [...x.linkedTo, o.id] }
        : rel === 'linked' && x.id === o.id ? { ...x, linkedTo: [...x.linkedTo, t.id] }
        : rel === 'follows' && x.id === t.id ? { ...x, dependsOn: [...x.dependsOn, o.id] }
        : rel === 'followed' && x.id === o.id ? { ...x, dependsOn: [...x.dependsOn, t.id] }
        : x,
      ),
    );
  const remove = (id: string) =>
    setTasks(tasks.filter((t) => t.id !== id).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => d !== id), linkedTo: t.linkedTo.filter((d) => d !== id) })));

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
                <NumberField
                  label="Durée en minutes"
                  className={`${inputCls} w-20`}
                  value={t.duration}
                  onChange={(duration) => update(t.id, { duration })}
                />
                min
              </label>
              <button className={btnGhost} onClick={() => duplicate(t)}>Dupliquer</button>
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
              <legend className="mb-1 text-sm font-medium">Liens avec les autres tâches</legend>
              <ul className="space-y-1">
                {tasks
                  .filter((o) => o.id !== t.id)
                  .map((o) => {
                    const base = withoutLink(t, o);
                    const noFollow = wouldCycle(base, t.id, o.id);
                    const noFollowed = wouldCycle(base, o.id, t.id);
                    return (
                      <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{o.name}</span>
                        <select
                          aria-label={`Relation avec ${o.name}`}
                          className={inputCls}
                          value={relationOf(t, o)}
                          onChange={(e) => setRelation(t, o, e.target.value as Relation)}
                        >
                          <option value="none">Aucune relation</option>
                          <option value="linked">Liée (même personne, ordre libre)</option>
                          <option value="follows" disabled={noFollow} title={noFollow ? 'Créerait une dépendance circulaire' : undefined}>
                            Doit suivre
                          </option>
                          <option value="followed" disabled={noFollowed} title={noFollowed ? 'Créerait une dépendance circulaire' : undefined}>
                            Doit être suivie par
                          </option>
                        </select>
                      </li>
                    );
                  })}
              </ul>
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
