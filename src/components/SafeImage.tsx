import { useState, type ComponentPropsWithRef } from "react";
import { IMAGE_PLACEHOLDER, safeImageSrcSet, toImg } from "@/lib/img";

export function SafeImage({ src, srcSet, onError: _legacyErrorHandler, ...props }: ComponentPropsWithRef<"img">) {
  const source = toImg(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === source;
  return (
    <img
      {...props}
      src={failed ? IMAGE_PLACEHOLDER : source}
      srcSet={failed ? undefined : safeImageSrcSet(srcSet)}
      onError={(event) => {
        const image = event.currentTarget;
        image.onerror = null;
        if (failed || source === IMAGE_PLACEHOLDER || image.getAttribute("src") === IMAGE_PLACEHOLDER) return;
        image.removeAttribute("srcset");
        image.src = IMAGE_PLACEHOLDER;
        setFailedSource(source);
      }}
    />
  );
}
