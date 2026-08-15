import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Link2, Loader2, RefreshCw, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getPresswayyStatus, registerPresswayy, resyncPresswayy, savePresswayy, testPresswayy } from "@/lib/presswayy.functions";

export function PresswayyCard() {
  const [key, setKey] = useState("");
  const [active, setActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [busy, setBusy] = useState<"save" | "register" | "test" | "sync" | null>(null);
  const statusFn = useServerFn(getPresswayyStatus);
  const saveFn = useServerFn(savePresswayy);
  const registerFn = useServerFn(registerPresswayy);
  const testFn = useServerFn(testPresswayy);
  const syncFn = useServerFn(resyncPresswayy);

  useEffect(() => {
    statusFn().then((r) => { setConnected(r.connected); setActive(r.active); setKeyId(r.key_id); }).catch(() => undefined);
  }, [statusFn]);

  const save = async () => {
    if (!key.trim()) return toast.error("Presswayy connection key দিন");
    setBusy("save");
    try {
      const r = await saveFn({ data: { connection_key: key.trim(), store_url: "https://oronnonogor.com", inbound_base: "/presswayy/v1", platform: "tanstack", framework: "custom" } });
      setConnected(true); setActive(true); setKeyId(r.key_id); setKey("");
      toast.success("Presswayy configuration সেভ হয়েছে");
    } catch (e) { toast.error(e instanceof Error ? e.message : "সেভ ব্যর্থ"); }
    finally { setBusy(null); }
  };

  const run = async (kind: "register" | "test" | "sync") => {
    setBusy(kind);
    try {
      if (kind === "register") { await registerFn(); toast.success("Presswayy store register সফল"); }
      if (kind === "test") { await testFn(); toast.success("Presswayy connection ঠিক আছে"); }
      if (kind === "sync") { const r = await syncFn(); toast.success(`${r.products}টি product Presswayy-তে sync হয়েছে`); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "অপারেশন ব্যর্থ"); }
    finally { setBusy(null); }
  };

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-white to-muted/30 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold">Presswayy AI — Store Sync</h2>
            {connected && active ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"><CheckCircle2 className="h-3 w-3" /> Connected</span> : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"><XCircle className="h-3 w-3" /> Not connected</span>}
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">Presswayy AI-কে আপনার product catalog জানাতে এবং AI order/stock sync চালাতে HMAC-secured two-way connection।</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Connection Key</label>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={keyId ? `Connected key: ${keyId} • নতুন key দিলে replace হবে` : "id.secret"} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-mono" />
          <p className="mt-1 text-[11px] text-muted-foreground">Key browser-এ দেখানো বা source code-এ রাখা হয় না; server-side encrypted secret storage ব্যবহার করুন।</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-3"><div className="text-[11px] text-muted-foreground">Store</div><div className="text-sm font-semibold">oronnonogor.com</div></div>
          <div className="rounded-lg border bg-white p-3"><div className="text-[11px] text-muted-foreground">Inbound API</div><div className="text-sm font-semibold break-all">/presswayy/v1</div></div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> {busy === "save" ? "সেভ হচ্ছে..." : "Save Key"}</button>
        <button onClick={() => run("register")} disabled={!connected || !!busy} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><Link2 className="h-4 w-4" /> {busy === "register" ? "Connecting..." : "Register Store"}</button>
        <button onClick={() => run("test")} disabled={!connected || !!busy} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Test</button>
        <button onClick={() => run("sync")} disabled={!connected || !!busy} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync Products</button>
      </div>
    </div>
  );
}
