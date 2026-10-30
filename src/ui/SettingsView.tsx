import { useStore } from '../state/store';
import { formatTime, parseTime } from '../domain/types';
import { Card, btnDanger, btnGhost, inputCls } from './fields';

export function SettingsView() {
  const { settings, setSettings, seed, loadSample, reset, exportJson } = useStore();

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planning.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Contraintes globales</h2>
      <Card className="grid max-w-xl gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          Nombre de jours planifiés
          <input
            type="number"
            min={1}
            max={14}
            className={`${inputCls} block w-full`}
            value={settings.horizonDays}
            onChange={(e) =>
              setSettings({ ...settings, horizonDays: Math.min(14, Math.max(1, Number(e.target.value) || 1)) })
            }
          />
        </label>
        <div />
        <label className="space-y-1 text-sm font-medium">
          Début de journée affiché
          <input
            type="time"
            className={`${inputCls} block w-full`}
            value={formatTime(settings.dayStart)}
            onChange={(e) => e.target.value && setSettings({ ...settings, dayStart: parseTime(e.target.value) })}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Fin de journée affichée
          <input
            type="time"
            className={`${inputCls} block w-full`}
            value={formatTime(settings.dayEnd)}
            onChange={(e) => e.target.value && setSettings({ ...settings, dayEnd: parseTime(e.target.value) })}
          />
        </label>
        <p className="text-sm text-slate-500 sm:col-span-2">
          Les contraintes dures (disponibilités, non-chevauchement, durées, dépendances, créneaux verrouillés) sont
          toujours appliquées. Les préférences (personne, plage horaire) pèsent sur le score. Seed actuelle : <code>{seed}</code>.
        </p>
      </Card>
      <Card className="flex flex-wrap gap-2">
        <button className={btnGhost} onClick={download}>Exporter en JSON</button>
        <button className={btnGhost} onClick={loadSample}>Charger l'exemple</button>
        <button
          className={btnDanger}
          onClick={() => window.confirm('Tout effacer ? (annulable)') && reset()}
        >
          Tout effacer
        </button>
      </Card>
    </div>
  );
}
