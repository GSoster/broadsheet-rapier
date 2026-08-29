import { useTranslation } from "react-i18next";
import { AssetFallback } from "./AssetFallback";

export interface NodeInteractionActor {
  id: string;
  name: string;
  title: string;
  isUnlocked: boolean;
}

export interface NodeInteractionAction {
  id: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export interface NodeInteractionCanvasProps {
  poiName: string;
  poiDescription: string;
  imageAsset?: string;
  actors: NodeInteractionActor[];
  selectedActorId?: string | null;
  actions?: NodeInteractionAction[];
  onSelectActor: (actorId: string) => void;
  onLeave: () => void;
}

export function NodeInteractionCanvas({
  poiName,
  poiDescription,
  imageAsset,
  actors,
  selectedActorId,
  actions,
  onSelectActor,
  onLeave,
}: NodeInteractionCanvasProps) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-4 p-6">
      <button
        type="button"
        onClick={onLeave}
        className="self-start text-xs uppercase tracking-wide text-indigo-400 hover:text-indigo-200"
      >
        {t("common.back")}
      </button>
      {imageAsset ? (
        <AssetFallback src={imageAsset} alt={poiName} className="h-40 w-full rounded object-cover" />
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold text-indigo-100">{poiName}</h1>
        <p className="mt-1 text-sm text-indigo-300">{poiDescription}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actors.map((actor) => (
          <button
            key={actor.id}
            type="button"
            disabled={!actor.isUnlocked}
            onClick={() => onSelectActor(actor.id)}
            className={`rounded border px-3 py-2 text-sm text-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-indigo-500 ${
              selectedActorId === actor.id
                ? "border-indigo-400 bg-neutral-800"
                : "border-indigo-800 bg-neutral-900"
            }`}
          >
            {actor.isUnlocked ? (
              <>
                {actor.name} <span className="text-indigo-400">&middot; {actor.title}</span>
              </>
            ) : (
              t("common.locked")
            )}
          </button>
        ))}
      </div>
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-indigo-900 pt-4">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className="rounded border border-amber-700 bg-amber-950/40 px-3 py-2 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-amber-500"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
