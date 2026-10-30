import { useStore } from '../state/store';
import type { Person } from '../domain/types';
import { Card, IntervalField, btnDanger, btnGhost, inputCls } from './fields';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16'];

export function TeamView() {
  const { people, setPeople, settings } = useStore();
  const update = (id: string, patch: Partial<Person>) =>
    setPeople(people.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = () =>
    setPeople([
      ...people,
      {
        id: crypto.randomUUID(),
        name: `Personne ${people.length + 1}`,
        color: COLORS[people.length % COLORS.length]!,
        availability: [{ start: 9 * 60, end: 17 * 60 }],
      },
    ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Équipe</h2>
        <button className={btnGhost} onClick={add}>+ Ajouter une personne</button>
      </div>
      {people.length === 0 && <p className="text-slate-500">Aucune personne. Ajoutez-en ou chargez l'exemple.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {people.map((p) => (
          <Card key={p.id}>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="color"
                aria-label={`Couleur de ${p.name}`}
                value={p.color}
                onChange={(e) => update(p.id, { color: e.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded"
              />
              <input
                aria-label="Nom"
                className={`${inputCls} flex-1 font-medium`}
                value={p.name}
                onChange={(e) => update(p.id, { name: e.target.value })}
              />
              <button className={btnDanger} onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>
                Supprimer
              </button>
            </div>
            <h3 className="mb-2 text-sm font-medium text-slate-600">Disponibilités</h3>
            <ul className="space-y-2">
              {p.availability.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <IntervalField
                    label={`Disponibilité ${i + 1}`}
                    value={a}
                    days={settings.horizonDays}
                    onChange={(v) => update(p.id, { availability: p.availability.map((x, j) => (j === i ? v : x)) })}
                  />
                  <button
                    className={btnDanger}
                    aria-label="Supprimer la plage"
                    onClick={() => update(p.id, { availability: p.availability.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              className={`${btnGhost} mt-3`}
              onClick={() => {
                const last = p.availability[p.availability.length - 1];
                const day = last ? Math.floor(last.start / 1440) : 0;
                update(p.id, { availability: [...p.availability, { start: day * 1440 + 540, end: day * 1440 + 1020 }] });
              }}
            >
              + Plage
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
