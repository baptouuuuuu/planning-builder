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
  const { undo, redo, past, future } = useStore();
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
        <h1 className="mr-4 text-lg font-bold text-indigo-700">📅 Planning Builder</h1>
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
      <main className="flex-1 p-4 pb-24 md:pb-4">
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
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
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
