import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../utils/resolveAssetUrl";

export interface AssetFallbackProps {
  src: string;
  alt: string;
  kind?: "image" | "audio";
  className?: string;
}

export function AssetFallback({ src, alt, kind = "image", className }: AssetFallbackProps) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveAssetUrl(src);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 border-2 border-purple-600 bg-purple-950/80 p-2 text-center text-xs text-purple-200 ${className ?? ""}`}
      >
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        <span>{t("assetFallback.missing", { src })}</span>
      </div>
    );
  }

  if (kind === "audio") {
    return <audio src={resolvedSrc} controls className={className} onError={() => setFailed(true)} />;
  }

  return <img src={resolvedSrc} alt={alt} className={className} onError={() => setFailed(true)} />;
}
