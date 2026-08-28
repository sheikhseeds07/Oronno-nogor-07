import os, re
RX = "/[^" + chr(92) + "d]/g"
BD = '''// BD mobile validation shared by home checkout + every landing page.
export const PHONE_RE = /^01[3-9][0-9]{8}$/;
export const PHONE_ERROR = "সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন (01XXXXXXXXX)";
export function normalizeBdPhone(v: string): string {
  const d = (v || "").replace(__RX__, "");
  return d.startsWith("8801") ? d.slice(2, 13) : d.slice(0, 11);
}
export function isValidBdPhone(v: string): boolean { return PHONE_RE.test(normalizeBdPhone(v)); }
export function phoneErrorFor(v: string): string { return !v || isValidBdPhone(v) ? "" : PHONE_ERROR; }
'''.replace("__RX__", RX)
os.makedirs("src/lib", exist_ok=True)
open("src/lib/bd-phone.ts", "w").write(BD)

IMP = 'import { isValidBdPhone, phoneErrorFor, PHONE_ERROR } from "@/lib/bd-phone";'
def fix(s):
    m = re.search(r'import \{([^}]*)\} from "react";', s)
    if m:
        names = [x.strip() for x in m.group(1).split(",") if x.strip()]
        for n in ("useState", "useRef"):
            if n not in names: names.append(n)
        s = s[:m.start()] + 'import { ' + ", ".join(names) + ' } from "react";' + s[m.end():]
    lines = s.split("\n")
    i = max(k for k, l in enumerate(lines) if l.startswith("import"))
    lines.insert(i + 1, IMP)
    return "\n".join(lines)

ERRP = '{phoneErr && <p className="mt-1 text-[12px] font-medium text-red-600">{phoneErr}</p>}'
CLS = 'className={`w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none transition ${phoneErr ? "border-red-500 bg-red-50/60 focus:border-red-500" : "border-slate-200 bg-slate-50/60 focus:bg-white focus:border-emerald-500"}`}'

# ---- shared card used by legacy/professional/product-style + future pages ----
p = "src/components/landing/lp-shared.tsx"
s = open(p).read()
assert "phoneErr" not in s
hooks = ('const [phoneErr, setPhoneErr] = useState(""); const phoneRef = useRef<HTMLInputElement | null>(null);'
         ' const phoneValid = isValidBdPhone(values.phone);'
         ' const guardedSubmit = (e: React.FormEvent) => { if (!phoneValid) { e.preventDefault(); setPhoneErr(PHONE_ERROR);'
         ' phoneRef.current?.focus(); phoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }'
         ' setPhoneErr(""); onSubmit(e); };\n  return <div className="lp-product-checkout-group">')
anchor = 'return <div className="lp-product-checkout-group">'
assert anchor in s
s = s.replace(anchor, hooks, 1)
assert 'onSubmit={onSubmit}' in s
s = s.replace('onSubmit={onSubmit}', 'onSubmit={guardedSubmit}', 1)
pat = re.compile(r'<input required type="tel" value=\{values\.phone\}[^>]*/>')
assert pat.search(s)
newi = ('<input ref={phoneRef} required type="tel" inputMode="numeric" maxLength={11} value={values.phone}'
        ' onChange={e => { const v = e.target.value.replace(__RX__, "").slice(0, 11); onChange("phone", v); setPhoneErr(phoneErrorFor(v)); }}'
        ' onBlur={() => setPhoneErr(phoneErrorFor(values.phone))} aria-invalid={Boolean(values.phone) && !phoneValid}'
        ' placeholder="01XXXXXXXXX" ' + CLS + ' />' + ERRP).replace("__RX__", RX)
s = pat.sub(lambda _: newi, s, count=1)
open(p, "w").write(fix(s))

# ---- CleanLandingPage (seed combo etc.) ----
p = "src/components/landing/CleanLandingPage.tsx"
s = open(p).read()
s = s.replace('const [phoneError,setPhoneError]=useState(false);', 'const [phoneErr,setPhoneErr]=useState("");', 1)
s = re.sub(r' ?<PhoneErrorPopup[^>]*/>', '', s)
i = s.find('function PhoneErrorPopup(')
if i >= 0:
    m = re.search(r'\n(function |const |export |type )', s[i:])
    j = i + m.start() + 1 if m else len(s)
    s = s[:i] + s[j:]
s = s.replace('const orderSectionRef=useRef<HTMLElement|null>(null);',
              'const orderSectionRef=useRef<HTMLElement|null>(null); const phoneRef=useRef<HTMLInputElement|null>(null);', 1)
guard = ('if(!isValidBdPhone(form.phone)){setPhoneErr(PHONE_ERROR);phoneRef.current?.focus();'
         'phoneRef.current?.scrollIntoView({behavior:"smooth",block:"center"});return}setPhoneErr("");')
m = re.search(r'const submit=async\(e:React\.FormEvent\)=>\{e\.preventDefault\(\);', s)
assert m
s = s[:m.end()] + guard + s[m.end():]
s = s.replace('{setPhoneError(true)}', '{setPhoneErr(PHONE_ERROR);phoneRef.current?.focus();phoneRef.current?.scrollIntoView({behavior:"smooth",block:"center"})}', 1)
pat = re.compile(r'<input required type="tel" value=\{form\.phone\}[^>]*/>')
assert pat.search(s)
newi = ('<input ref={phoneRef} required type="tel" inputMode="numeric" maxLength={11} value={form.phone}'
        ' onChange={e=>{const v=e.target.value.replace(__RX__,"").slice(0,11);setForm({...form,phone:v});setPhoneErr(phoneErrorFor(v))}}'
        ' onBlur={()=>setPhoneErr(phoneErrorFor(form.phone))} aria-invalid={Boolean(form.phone)&&!isValidBdPhone(form.phone)}'
        ' placeholder="01XXXXXXXXX" ' + CLS + ' />' + ERRP).replace("__RX__", RX)
s = pat.sub(lambda _: newi, s, count=1)
open(p, "w").write(fix(s))
print("ok")
