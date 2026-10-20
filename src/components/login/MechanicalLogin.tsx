import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sprout, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./mechanical-login.css";

type Props = { email: string; password: string; loading: boolean; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onSubmit: (event: React.FormEvent) => void; error?: string };

function Gear({ x, y, radius, reverse = false }: { x: number; y: number; radius: number; reverse?: boolean }) {
  const teeth = Array.from({ length: 16 }, (_, i) => {
    const angle = i * Math.PI / 8;
    return <rect key={i} x={-5} y={-radius-7} width={10} height={16} rx={2} transform={`rotate(${angle * 180 / Math.PI})`} />;
  });
  return <g transform={`translate(${x} ${y})`}><g className={reverse ? "ml-gear ml-gear-reverse" : "ml-gear"}>{teeth}<circle r={radius} /><circle r={radius-10} className="ml-gear-inner" /><circle r={9} className="ml-hub" />{[0, 60, 120].map(a => <path key={a} d={`M ${-radius+16} 0 H ${radius-16}`} transform={`rotate(${a})`} />)}</g></g>;
}

function Machine() {
  return <svg className="ml-machine" viewBox="0 0 1000 700" fill="none" aria-hidden="true">
    <g className="ml-drafting"><path d="M45 108H945M45 585H945M120 45V650M880 45V650" /><path d="M45 98V118M945 98V118M45 575V595M945 575V595" /></g>
    <g className="ml-rail"><path d="M230 205H739V345H870V536H620M195 233V470H295M190 536H465" /><path d="M212 217H738M200 217V420" /></g>
    <g className="ml-pulley"><circle cx="200" cy="217" r="27"/><circle cx="200" cy="217" r="15"/><path d="M200 196V238M179 217H221"/></g>
    <path className="ml-rope" d="M173 217V365M227 217V414" />
    <g className="ml-weight"><path d="M158 365H188L193 399H153Z"/><path d="M164 361V355H182V361"/><path d="M161 381H185"/></g>
    <Gear x={761} y={205} radius={59}/><Gear x={813} y={286} radius={30} reverse/><Gear x={870} y={342} radius={36}/>
    <g className="ml-dial"><circle cx="761" cy="205" r="83"/><path d="M761 115V122M761 288V295M671 205H678M844 205H851"/></g>
    <g className="ml-switch"><path d="M195 414L239 437L219 469H172Z"/><circle cx="204" cy="442" r="7"/></g>
    <g className="ml-conveyor"><rect x="260" y="545" width="405" height="29" rx="14"/><circle cx="277" cy="559" r="7"/><circle cx="648" cy="559" r="7"/><path className="ml-belt" d="M292 559H633"/><path d="M291 574V610M634 574V610M276 611H307M619 611H650"/></g>
    <g className="ml-seed ml-seed-one"><ellipse cx="345" cy="527" rx="8" ry="12" transform="rotate(32 345 527)"/><path d="M341 535L349 519"/></g>
    <g className="ml-seed ml-seed-two"><ellipse cx="458" cy="527" rx="8" ry="12" transform="rotate(-25 458 527)"/><path d="M454 535L462 519"/></g>
    <g className="ml-seed ml-seed-three"><ellipse cx="566" cy="527" rx="8" ry="12" transform="rotate(30 566 527)"/><path d="M562 535L570 519"/></g>
    <g className="ml-planter"><path d="M756 541H854L840 610H771Z"/><path d="M748 530H862V542H748Z"/><path d="M781 555L786 596M805 555V596M829 555L824 596"/></g>
    <g className="ml-growing"><path d="M805 530V467"/><path className="ml-leaf" d="M805 506C774 505 764 482 768 470C793 470 808 480 805 506Z"/><path className="ml-leaf" d="M805 489C808 463 832 451 847 457C842 482 826 492 805 489Z"/><path d="M805 477C794 467 793 452 800 443C816 453 818 466 805 477Z"/></g>
    <g className="ml-floor"><path d="M735 612H877M747 625H863M105 612H232"/><circle cx="145" cy="590" r="4"/><circle cx="164" cy="590" r="4"/><path d="M132 575H177L171 604H138Z"/></g>
    <g className="ml-labels"><text x="110" y="95">01 / INPUT</text><text x="705" y="95">02 / TRANSMISSION</text><text x="740" y="658">03 / GROWTH</text><text x="262" y="650">SHEIKH SEEDS · EST. WITH CARE</text></g>
  </svg>;
}

export function MechanicalLogin({ email, password, loading, onEmailChange, onPasswordChange, onSubmit, error }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  return <section className={`ml-page ${focused ? "ml-active" : ""} ${loading ? "ml-working" : ""}`} lang="bn">
    <header className="ml-header"><a href="/" className="ml-brand"><span className="ml-brand-icon"><Sprout /></span><span>Sheikh Seeds<small>শেকড় থেকে সম্ভাবনা</small></span></a><span className="ml-access"><span /> ADMIN ACCESS</span></header>
    <div className="ml-stage">
      <Machine />
      <div className="ml-form-wrap">
        <div className="ml-heading"><span className="ml-overline">একটি ছোট শুরু, অনেক সম্ভাবনা</span><h1>স্বাগতম, আবার<span className="ml-heading-dot">।</span></h1><p>আপনার একাউন্টে প্রবেশ করুন</p></div>
        <form onSubmit={onSubmit} onFocus={() => setFocused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
          <label htmlFor="ml-email">ইমেইল</label><div className="ml-field"><Mail size={18}/><input id="ml-email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e => onEmailChange(e.target.value)} disabled={loading}/></div>
          <label htmlFor="ml-password">পাসওয়ার্ড</label><div className="ml-field"><LockKeyhole size={18}/><input id="ml-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="আপনার পাসওয়ার্ড" value={password} onChange={e => onPasswordChange(e.target.value)} disabled={loading}/><Button type="button" variant="ghost" size="icon" className="ml-eye" aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"} title={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff/> : <Eye/>}</Button></div>
          {error && <p className="ml-error" role="alert">{error}</p>}
          <Button type="submit" disabled={loading} className="ml-submit">{loading ? <Loader2 className="animate-spin"/> : <Sprout/>}<span>{loading ? "প্রবেশ করা হচ্ছে…" : "লগইন করুন"}</span>{!loading && <ArrowRight/>}</Button>
          <div className="ml-secure"><ShieldCheck size={14}/> নিরাপদ প্রবেশ · শুধু অনুমোদিত একাউন্ট</div>
        </form>
      </div>
    </div>
    <footer className="ml-footer"><a href="/"><ArrowLeft size={15}/> হোমে ফিরে যান</a><span>যত্নে বুনি, বিশ্বাসে বেড়ে উঠি।</span><span className="ml-footer-name">SHEIKH SEEDS</span></footer>
  </section>;
}
