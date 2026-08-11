import { AssetFallback } from "./AssetFallback";

export interface NodeInteractionActor {
  id: string;
  name: string;
  title: string;
}

export interface NodeInteractionSelectedActor extends NodeInteractionActor {
  initialDialogue: string;
}

export interface NodeInteractionCanvasProps {
  poiName: string;
  poiDescription: string;
  imageAsset?: string;
  actors: NodeInteractionActor[];
  selectedActor?: NodeInteractionSelectedActor | null;
  onSelectActor: (actorId: string) => void;
  onLeave: () => void;
}

export function NodeInteractionCanvas({
  poiName,
  poiDescription,
  imageAsset,
  actors,
  selectedActor,
  onSelectActor,
  onLeave,
}: NodeInteractionCanvasProps) {
  return (
    <section className="flex flex-col gap-4 p-6">
      <button
        type="button"
        onClick={onLeave}
        className="self-start text-xs uppercase tracking-wide text-indigo-400 hover:text-indigo-200"
      >
        &larr; Back
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
            onClick={() => onSelectActor(actor.id)}
            className="rounded border border-indigo-800 bg-neutral-900 px-3 py-2 text-sm text-indigo-100 hover:border-indigo-500"
          >
            {actor.name} <span className="text-indigo-400">&middot; {actor.title}</span>
          </button>
        ))}
      </div>
      {selectedActor ? (
        <blockquote className="border-l-2 border-indigo-600 pl-3 text-sm italic text-indigo-200">
          &ldquo;{selectedActor.initialDialogue}&rdquo;
        </blockquote>
      ) : null}
    </section>
  );
}
