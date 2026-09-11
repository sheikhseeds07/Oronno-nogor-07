import { useEffect } from "react";

const WAIT_TITLE = "একটু অপেক্ষা করুন";
const ENHANCED_ATTR = "data-premium-wait-popup";

/** Adds a premium, dismissible close control to the existing wait/order-limit popup.
 * It intentionally does not change the popup's timer, validation, or order logic.
 */
export function WaitPopupEnhancer() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const enhance = () => {
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('[class*="fixed"][class*="inset-0"]'));

      overlays.forEach((overlay) => {
        if (overlay.getAttribute(ENHANCED_ATTR) === "1") return;
        if (!overlay.textContent?.includes(WAIT_TITLE)) return;

        const card = overlay.firstElementChild as HTMLElement | null;
        if (!card) return;

        overlay.setAttribute(ENHANCED_ATTR, "1");
        card.style.position = "relative";
        card.style.overflow = "hidden";

        const styleId = "premium-wait-popup-style";
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = `
            @keyframes premiumWaitIn { from { opacity:0; transform:translateY(18px) scale(.97) } to { opacity:1; transform:translateY(0) scale(1) } }
            @keyframes premiumWaitFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-4px) } }
            .premium-wait-card { animation: premiumWaitIn .42s cubic-bezier(.22,1,.36,1) both; }
            .premium-wait-hourglass { animation: premiumWaitFloat 2.4s ease-in-out infinite; }
            .premium-wait-close { position:absolute; top:14px; right:14px; z-index:20; width:38px; height:38px; border:1px solid rgba(15,23,42,.08); border-radius:999px; background:rgba(255,255,255,.92); color:#64748b; display:grid; place-items:center; font-size:24px; line-height:1; font-weight:500; box-shadow:0 8px 24px -14px rgba(15,23,42,.45); cursor:pointer; transition:transform .2s, color .2s, background .2s, box-shadow .2s; }
            .premium-wait-close:hover { transform:rotate(90deg) scale(1.04); color:#166534; background:#fff; box-shadow:0 12px 30px -14px rgba(15,23,42,.55); }
            .premium-wait-ok { margin-top:18px; width:100%; min-height:46px; border:0; border-radius:15px; background:linear-gradient(135deg,#15803d,#166534); color:#fff; font-size:14px; font-weight:800; box-shadow:0 14px 30px -18px rgba(22,101,52,.8); cursor:pointer; transition:transform .18s, box-shadow .2s; }
            .premium-wait-ok:hover { transform:translateY(-1px); box-shadow:0 18px 34px -18px rgba(22,101,52,.9); }
            .premium-wait-ok:active { transform:scale(.985); }
            @media (prefers-reduced-motion: reduce) { .premium-wait-card,.premium-wait-hourglass { animation:none!important; } }
          `;
          document.head.appendChild(style);
        }

        card.classList.add("premium-wait-card");

        const close = () => {
          overlay.style.transition = "opacity .22s ease";
          card.style.transition = "transform .22s ease, opacity .22s ease";
          overlay.style.opacity = "0";
          card.style.opacity = "0";
          card.style.transform = "scale(.97) translateY(8px)";
          window.setTimeout(() => { overlay.style.display = "none"; }, 230);
        };

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "premium-wait-close";
        closeButton.setAttribute("aria-label", "পপআপ বন্ধ করুন");
        closeButton.innerHTML = "&times;";
        closeButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        });

        const okButton = document.createElement("button");
        okButton.type = "button";
        okButton.className = "premium-wait-ok";
        okButton.textContent = "ঠিক আছে";
        okButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        });

        card.appendChild(closeButton);
        card.appendChild(okButton);

        const hourglass = Array.from(card.querySelectorAll<HTMLElement>("div")).find((el) => el.textContent?.trim() === "⏳");
        hourglass?.classList.add("premium-wait-hourglass");
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
