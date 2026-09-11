import { useEffect } from "react";

const WAIT_TITLE = "একটু অপেক্ষা করুন";
const REPEAT_ORDER_TEXT = "আপনি ইতিমধ্যে একটি অর্ডার করেছেন";
const ENHANCED_ATTR = "data-premium-wait-popup";

/**
 * Gives every public checkout/landing-page repeat-order warning the same
 * premium popup treatment used by the main checkout. This is presentation
 * only: it never changes the order-limit validation or timer logic.
 */
export function WaitPopupEnhancer() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const styleId = "premium-wait-popup-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes premiumWaitBackdrop { from { opacity:0 } to { opacity:1 } }
        @keyframes premiumWaitCard { 0% { opacity:0; transform:translateY(28px) scale(.94) } 60% { opacity:1; transform:translateY(-4px) scale(1.015) } 100% { opacity:1; transform:none } }
        @keyframes premiumWaitAura { 0%,100% { transform:scale(.92); opacity:.35 } 50% { transform:scale(1.08); opacity:.7 } }
        @keyframes premiumWaitTick { 0% { stroke-dashoffset:48; transform:scale(.72); opacity:0 } 55% { opacity:1 } 100% { stroke-dashoffset:0; transform:scale(1); opacity:1 } }
        @keyframes premiumWaitIcon { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-3px) } }
        @keyframes premiumWaitShine { 0% { transform:translateX(-160%) } 45%,100% { transform:translateX(160%) } }
        .premium-wait-backdrop { animation:premiumWaitBackdrop .28s ease-out both; }
        .premium-wait-card { animation:premiumWaitCard .62s cubic-bezier(.22,1,.36,1) both; }
        .premium-wait-aura { animation:premiumWaitAura 2.8s ease-in-out infinite; }
        .premium-wait-icon { animation:premiumWaitIcon 2.8s ease-in-out infinite; }
        .premium-wait-tick { stroke-dasharray:48; stroke-dashoffset:48; animation:premiumWaitTick .65s .12s cubic-bezier(.22,1,.36,1) forwards; transform-origin:center; }
        .premium-wait-shine { animation:premiumWaitShine 3.2s ease-in-out infinite; }
        .premium-wait-close { transition:transform .2s,background-color .2s,box-shadow .2s; }
        .premium-wait-close:hover { transform:rotate(90deg) scale(1.05); background-color:rgba(15,23,42,.08); box-shadow:0 8px 22px -12px rgba(15,23,42,.45); }
        .premium-wait-ok { transition:transform .18s,box-shadow .2s; }
        .premium-wait-ok:hover { transform:translateY(-1px); box-shadow:0 16px 32px -16px rgba(22,101,52,.7); }
        .premium-wait-ok:active { transform:scale(.985); }
        @media(prefers-reduced-motion:reduce){.premium-wait-backdrop,.premium-wait-card,.premium-wait-aura,.premium-wait-icon,.premium-wait-tick,.premium-wait-shine{animation:none!important}.premium-wait-tick{stroke-dashoffset:0!important}}
      `;
      document.head.appendChild(style);
    }

    const closeOverlay = (overlay: HTMLElement, card: HTMLElement) => {
      overlay.style.transition = "opacity .22s ease";
      card.style.transition = "transform .22s ease, opacity .22s ease";
      overlay.style.opacity = "0";
      card.style.opacity = "0";
      card.style.transform = "scale(.97) translateY(8px)";
      window.setTimeout(() => { overlay.style.display = "none"; }, 230);
    };

    const enhance = () => {
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('[class*="fixed"][class*="inset-0"]'));

      overlays.forEach((overlay) => {
        if (overlay.getAttribute(ENHANCED_ATTR) === "1") return;
        const text = overlay.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const isRepeatOrder = text.includes(REPEAT_ORDER_TEXT) || text.includes(WAIT_TITLE);
        if (!isRepeatOrder) return;

        const card = overlay.firstElementChild as HTMLElement | null;
        if (!card) return;

        overlay.setAttribute(ENHANCED_ATTR, "1");
        overlay.classList.add("premium-wait-backdrop");
        card.classList.add("premium-wait-card");
        card.style.position = "relative";
        card.style.overflow = "hidden";

        const close = () => closeOverlay(overlay, card);

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "premium-wait-close";
        closeButton.setAttribute("aria-label", "পপআপ বন্ধ করুন");
        closeButton.innerHTML = "&times;";
        closeButton.style.cssText = "position:absolute;top:13px;right:13px;z-index:20;width:38px;height:38px;border:1px solid rgba(15,23,42,.08);border-radius:999px;background:rgba(255,255,255,.9);color:#64748b;display:grid;place-items:center;font-size:24px;line-height:1;font-weight:500;cursor:pointer;";
        closeButton.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); close(); });

        const existingIcon = Array.from(card.querySelectorAll<HTMLElement>("div")).find((el) => el.textContent?.trim() === "⏳");
        if (existingIcon) {
          existingIcon.textContent = "";
          existingIcon.classList.add("premium-wait-icon");
          existingIcon.style.cssText = "position:relative;display:grid;place-items:center;width:74px;height:74px;margin:0 auto 16px;border-radius:24px;background:linear-gradient(145deg,#ecfdf3,#dcfce7);color:#15803d;box-shadow:0 16px 38px -22px rgba(22,101,52,.6);font-size:0;";
          const aura = document.createElement("span");
          aura.className = "premium-wait-aura";
          aura.style.cssText = "position:absolute;inset:8px;border-radius:20px;background:rgba(34,197,94,.12);";
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("viewBox", "0 0 48 48");
          svg.setAttribute("fill", "none");
          svg.setAttribute("width", "42");
          svg.setAttribute("height", "42");
          svg.style.position = "relative";
          svg.style.zIndex = "1";
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("cx", "24"); circle.setAttribute("cy", "24"); circle.setAttribute("r", "19"); circle.setAttribute("stroke", "#16a34a"); circle.setAttribute("stroke-width", "3.5");
          const tick = document.createElementNS("http://www.w3.org/2000/svg", "path");
          tick.setAttribute("d", "M14 24.5l6.5 6.5L34 17.5"); tick.setAttribute("stroke", "#15803d"); tick.setAttribute("stroke-width", "3.8"); tick.setAttribute("stroke-linecap", "round"); tick.setAttribute("stroke-linejoin", "round"); tick.classList.add("premium-wait-tick");
          svg.append(circle, tick); existingIcon.append(aura, svg);
        }

        card.appendChild(closeButton);

        if (!card.querySelector(".premium-wait-ok")) {
          const okButton = document.createElement("button");
          okButton.type = "button";
          okButton.className = "premium-wait-ok";
          okButton.textContent = "ঠিক আছে";
          okButton.style.cssText = "margin-top:18px;width:100%;min-height:46px;border:0;border-radius:15px;background:linear-gradient(135deg,#15803d,#166534);color:#fff;font-size:14px;font-weight:800;box-shadow:0 14px 30px -18px rgba(22,101,52,.8);cursor:pointer;position:relative;overflow:hidden;";
          const shine = document.createElement("span");
          shine.className = "premium-wait-shine";
          shine.style.cssText = "position:absolute;inset:0 auto 0 -30%;width:28%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.3),transparent);pointer-events:none;";
          okButton.appendChild(shine);
          const label = document.createElement("span"); label.textContent = "ঠিক আছে"; label.style.position = "relative"; label.style.zIndex = "1"; okButton.appendChild(label);
          okButton.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); close(); });
          card.appendChild(okButton);
        }
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
