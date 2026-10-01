import { useState, type ComponentPropsWithRef } from "react";
import { IMAGE_PLACEHOLDER, safeImageSrcSet, toImg } from "@/lib/img";

export function SafeImage({ src, srcSet, onError: _legacyErrorHandler, ...props }: ComponentPropsWithRef<"img">) {
  const source = toImg(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [retriedSource, setRetriedSource] = useState<string | null>(null);
  const failed = failedSource === source;
  return (
    <img
      {...props}
      src={failed ? IMAGE_PLACEHOLDER : source}
      srcSet={failed ? undefined : safeImageSrcSet(srcSet)}
      onError={(event) => {
        const image = event.currentTarget;
        if (failed || source === IMAGE_PLACEHOLDER || image.getAttribute("src") === IMAGE_PLACEHOLDER) return;
        image.removeAttribute("srcset");
        if (retriedSource !== source) {
          const retryUrl = new URL(source, window.location.origin);
          retryUrl.searchParams.set("image_retry", "1");
          setRetriedSource(source);
          image.src = retryUrl.toString();
          return;
        }
        image.onerror = null;
        image.src = IMAGE_PLACEHOLDER;
        setFailedSource(source);
      }}
    />
  );
}
