import { useState, type ComponentPropsWithRef } from "react";
import { IMAGE_PLACEHOLDER, safeImageSrcSet, toImg } from "@/lib/img";

type SafeImageProps = ComponentPropsWithRef<"img"> & { fallbackSrc?: string | null };

export function SafeImage({ src, srcSet, fallbackSrc, onError: _legacyErrorHandler, ...props }: SafeImageProps) {
  const source = toImg(src);
  const fallback = toImg(fallbackSrc);
  const sourceKey = `${source}|${fallback}`;
  const [fallbackKey, setFallbackKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const canFallback = fallback !== IMAGE_PLACEHOLDER && fallback !== source;
  const usingFallback = canFallback && fallbackKey === sourceKey;
  const failed = failedKey === sourceKey;
  return (
    <img
      {...props}
      src={failed ? IMAGE_PLACEHOLDER : usingFallback ? fallback : source}
      srcSet={failed || usingFallback ? undefined : safeImageSrcSet(srcSet)}
      onError={(event) => {
        const image = event.currentTarget;
        if (failed || image.getAttribute("src") === IMAGE_PLACEHOLDER) return;
        image.removeAttribute("srcset");
        if (!usingFallback && canFallback) {
          setFallbackKey(sourceKey);
          return;
        }
        setFailedKey(sourceKey);
      }}
    />
  );
}
