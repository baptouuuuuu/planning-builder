import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '../state/store';
import { PlanningView } from './PlanningView';
import { SettingsView } from './SettingsView';
import { TasksView } from './TasksView';
import { TeamView } from './TeamView';
import { btnGhost } from './fields';

const links = [
  ['/planning', 'Planning'],
  ['/team', 'Équipe'],
  ['/tasks', 'Tâches'],
  ['/settings', 'Contraintes'],
] as const;

export function App() {
  const { undo, redo, past, future, migrationNotice, dismissMigrationNotice } = useStore();
  return (
    <div className="mx-auto flex h-dvh max-w-7xl flex-col overflow-hidden">
      <header className="z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
        <h1 className="mr-4 bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-lg font-bold text-transparent">📅 Planning Builder</h1>
        <nav aria-label="Navigation principale" className="hidden gap-1 md:flex">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex gap-1">
          <button className={btnGhost} onClick={undo} disabled={past.length === 0} aria-label="Annuler">↶ Annuler</button>
          <button className={btnGhost} onClick={redo} disabled={future.length === 0} aria-label="Rétablir">↷ Rétablir</button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-4">
        {!!migrationNotice?.length && (
          <div role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>Les anciens liens ont été adaptés à une seule tâche liée. Vérifiez-les puis régénérez le planning.</p>
            <ul className="mt-1 list-inside list-disc">{migrationNotice.map((message, i) => <li key={i}>{message}</li>)}</ul>
            <button className={`${btnGhost} mt-2`} onClick={dismissMigrationNotice}>Compris</button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/planning" replace />} />
          <Route path="/planning" element={<PlanningView />} />
          <Route path="/team" element={<TeamView />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/planning" replace />} />
        </Routes>
      </main>
      <nav
        aria-label="Navigation mobile"
        className="z-10 grid shrink-0 grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `py-3 text-center text-xs font-medium ${isActive ? 'text-indigo-700' : 'text-slate-600'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
