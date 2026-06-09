import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import {
  Mail, Lock, Loader2, Eye, EyeOff, FileText, FileCheck,
  Receipt, Truck, Sparkles, ArrowRight, Shield, Zap, TrendingUp,
} from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import LoginBackground from "@/components/auth/LoginBackground";

/* ─── testimonials ──────────────────────────────────────────────── */
const TESTIMONIALS = [
  { name: "Sarah K.",       title: "Freelance Consultant",       text: "DocFlow transformed how I bill clients. Fast, beautiful, and my customers always compliment the invoices." },
  { name: "James O.",       title: "E-commerce Owner",           text: "I used to dread invoicing. Now I send professional receipts in under a minute. Absolutely love it." },
  { name: "Amaka T.",       title: "Creative Director",          text: "My clients think I have a whole finance team. It's just me and DocFlow." },
  { name: "Daniel R.",      title: "Logistics Manager",          text: "The waybill feature alone saved us hours every week. Drivers get clear delivery docs instantly." },
  { name: "Fatima A.",      title: "Boutique Owner",             text: "Looks so professional. Customers actually comment on how beautiful my receipts look!" },
  { name: "Mark L.",        title: "IT Contractor",              text: "Billing used to take half my day. DocFlow cuts it to 5 minutes. My accountant is happy too." },
  { name: "Chisom N.",      title: "Event Planner",              text: "Quotations are sent in seconds. Clients approve faster and I close deals quicker." },
  { name: "Priya M.",       title: "Marketing Consultant",       text: "The branding on the documents is spot-on. Clients always ask which tool I use." },
  { name: "Kevin B.",       title: "Freelance Developer",        text: "Clean, fast, and no clutter. Exactly what I needed for sending project invoices." },
  { name: "Ngozi E.",       title: "Catering Business Owner",    text: "I send waybills with delivery proof now. No more disputes with customers!" },
  { name: "Luis G.",        title: "Import/Export Trader",       text: "Multi-currency support is a game changer. I deal in 4 currencies and it handles all of them." },
  { name: "Blessing I.",    title: "Beauty Salon Owner",         text: "My receipts look like they came from a luxury brand. Clients keep coming back." },
  { name: "Tom W.",         title: "Construction Contractor",    text: "Professional quotations that win jobs. I've noticed clients respond faster since I switched." },
  { name: "Aisha M.",       title: "Fashion Designer",           text: "Sending styled invoices that match my brand aesthetic was always my dream. DocFlow delivers." },
  { name: "Emmanuel C.",    title: "Accountant",                 text: "I recommend DocFlow to all my small business clients. It saves them time and looks credible." },
  { name: "Sophie L.",      title: "Online Tutor",               text: "Invoicing parents for lessons used to be awkward. Now it's clean and totally professional." },
  { name: "Rahul P.",       title: "Restaurant Owner",           text: "Daily receipts, supplier waybills — all handled in one place. Makes life so much easier." },
  { name: "Grace U.",       title: "Freelance Writer",           text: "I never thought invoice software could be beautiful. DocFlow proved me wrong." },
  { name: "Olumide F.",     title: "Real Estate Agent",          text: "My quote documents look premium now. Clients take my pricing more seriously." },
  { name: "Anna V.",        title: "Interior Designer",          text: "From mood boards to invoices, my brand stays consistent. DocFlow fits right in." },
  { name: "Chukwuemeka A.", title: "Pharmacy Owner",             text: "Managing receipts for hundreds of transactions daily is seamless. Zero errors." },
  { name: "Ravi S.",        title: "Tech Startup Founder",       text: "Our investors were impressed by our polished financial documents. DocFlow helped us look big from day one." },
  { name: "Adaeze O.",      title: "Bakery Owner",               text: "Customers love receiving a proper receipt. It builds trust and they come back more." },
  { name: "Jake T.",        title: "Plumber & Tradesman",        text: "Used to write invoices by hand. Now I'm done before I leave the client's house." },
  { name: "Miriam K.",      title: "NGO Coordinator",            text: "Donor receipts and expense reports look so credible now. Makes fundraising easier." },
];

/* ─── helpers ──────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text: "Working late?",  emoji: "🌙" };
  if (h < 12) return { text: "Good morning",   emoji: "☀️" };
  if (h < 17) return { text: "Good afternoon", emoji: "👋" };
  if (h < 21) return { text: "Good evening",   emoji: "🌆" };
  return       { text: "Good night",           emoji: "🌙" };
}

const FEATURES = [
  { icon: FileText,  label: "Invoices",   color: "#818cf8", desc: "Professional & branded" },
  { icon: FileCheck, label: "Quotations", color: "#a78bfa", desc: "Win more clients"        },
  { icon: Receipt,   label: "Receipts",   color: "#34d399", desc: "Instant confirmation"    },
  { icon: Truck,     label: "Waybills",   color: "#fbbf24", desc: "Track every delivery"    },
];

const STATS = [
  { icon: Zap,        value: "< 2 min", label: "per document" },
  { icon: Shield,     value: "256-bit", label: "encryption"   },
  { icon: TrendingUp, value: "1000s", label: "of businesses"   },
];

const DOCS = [
  { type: "Invoice",   num: "INV-2024-047", status: "paid",    amount: "₦142,500", color: "#818cf8", bg: "linear-gradient(135deg,#6366f1,#4338ca)" },
  { type: "Quotation", num: "QUO-2024-011", status: "sent",    amount: "$8,500",   color: "#a78bfa", bg: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  { type: "Receipt",   num: "RCP-2024-033", status: "paid",    amount: "£3,200",   color: "#34d399", bg: "linear-gradient(135deg,#10b981,#059669)" },
];

const STATUS_COLORS = { paid: "#34d399", sent: "#818cf8", pending: "#fbbf24", draft: "#94a3b8" };

/* ─── DocCard ───────────────────────────────────────────────────── */
function DocCard({ doc, style }) {
  const sc = STATUS_COLORS[doc.status] || "#94a3b8";
  return (
    <div className="absolute backdrop-blur-md rounded-2xl px-4 py-3 min-w-[148px] select-none"
      style={{
        ...style,
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: doc.bg }}>
            <div className="w-2 h-2 bg-white/90 rounded-sm" />
          </div>
          <span className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>{doc.type}</span>
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
          style={{ background: sc + "28", color: sc, border: `1px solid ${sc}40` }}>
          {doc.status}
        </span>
      </div>
      <p className="text-xs font-black text-white mb-1">{doc.num}</p>
      <div className="flex items-center justify-between">
        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>Acme Ltd.</span>
        <span className="text-[11px] font-extrabold" style={{ color: doc.color }}>{doc.amount}</span>
      </div>
    </div>
  );
}

/* ─── AnimatedLogo ──────────────────────────────────────────────── */
function AnimatedLogo({ animate, size = "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex items-center gap-3"
      style={{
        opacity: animate ? 1 : 0,
        transform: animate ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.92)",
        transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-2xl animate-pulse"
          style={{ boxShadow: "0 0 0 4px rgba(129,140,248,0.25), 0 0 20px rgba(99,102,241,0.45)", borderRadius: isLg ? "14px" : "11px" }} />
        <div className={`relative ${isLg ? "w-12 h-12 rounded-2xl" : "w-9 h-9 rounded-xl"} flex items-center justify-center shadow-2xl`}
          style={{ background: "linear-gradient(135deg,#818cf8 0%,#6366f1 60%,#4338ca 100%)" }}>
          <FileText className={`${isLg ? "h-6 w-6" : "h-4 w-4"} text-white`} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 bg-emerald-400"
          style={{ borderColor: isLg ? "#09090f" : "#f1f3fb" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping absolute inset-0 m-auto" />
        </div>
      </div>
      <div>
        <div className={`${isLg ? "text-[24px]" : "text-[18px]"} font-black tracking-tight leading-none`}
          style={{ color: isLg ? "#fff" : "#0f172a" }}>DocFlow</div>
        <div className="flex items-center gap-1 mt-0.5">
          <Sparkles className="h-2.5 w-2.5 text-yellow-400" />
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em]`}
            style={{ color: isLg ? "rgba(255,255,255,0.32)" : "rgba(99,102,241,0.7)" }}>Business Suite</span>
        </div>
      </div>
    </div>
  );
}

/* ─── main ──────────────────────────────────────────────────────── */
export default function Login() {
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [logoIn, setLogoIn]             = useState(false);
  const [heroIn, setHeroIn]             = useState(false);
  const [formIn, setFormIn]             = useState(false);
  const [docsIn, setDocsIn]             = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(() => Math.floor(Math.random() * TESTIMONIALS.length));
  const [testimonialVisible, setTestimonialVisible] = useState(true);

  const greeting = getGreeting();

  useEffect(() => {
    const t1 = setTimeout(() => setLogoIn(true), 80);
    const t2 = setTimeout(() => setHeroIn(true), 240);
    const t3 = setTimeout(() => setFormIn(true), 360);
    const t4 = setTimeout(() => setDocsIn(true), 540);

    // rotate testimonial every 6 seconds with a fade
    const interval = setInterval(() => {
      setTestimonialVisible(false);
      setTimeout(() => {
        setTestimonialIdx(i => (i + 1) % TESTIMONIALS.length);
        setTestimonialVisible(true);
      }, 400);
    }, 6000);

    return () => { [t1, t2, t3, t4].forEach(clearTimeout); clearInterval(interval); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => base44.auth.loginWithProvider("google", "/");

  const fadeUp = (visible, delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ fontFamily: "'Inter',sans-serif" }}>

      {/* ══════════════════════════════════════════════════════════
          MOBILE / TABLET  — Compact brand header (hidden on lg+)
      ══════════════════════════════════════════════════════════ */}
      <div className="lg:hidden relative overflow-hidden flex-shrink-0"
        style={{ background: "linear-gradient(150deg,#07060f 0%,#0f0e2e 40%,#18125a 70%,#0b2251 100%)", minHeight: "220px" }}>

        {/* canvas particle bg */}
        <LoginBackground />

        {/* glow orbs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(99,102,241,0.35),transparent 60%)", filter: "blur(50px)" }} />
        <div className="absolute -bottom-10 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(59,130,246,0.25),transparent 60%)", filter: "blur(40px)" }} />

        <div className="relative z-10 flex flex-col px-6 pt-10 pb-8 sm:px-10">
          {/* Logo */}
          <AnimatedLogo animate={logoIn} size="lg" />

          {/* Mini tagline */}
          <div className="mt-5" style={fadeUp(heroIn, 0)}>
            <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-white leading-tight tracking-tight">
              Beautiful docs,{" "}
              <span style={{
                background: "linear-gradient(90deg,#a5b4fc,#67e8f9)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>zero friction.</span>
            </h1>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Invoices, quotations, receipts & waybills — in minutes.
            </p>
          </div>

          {/* Feature pills row — horizontal scroll on mobile */}
          <div className="flex gap-2 mt-5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" style={fadeUp(heroIn, 80)}>
            {FEATURES.map(({ icon: Icon, label, color }) => (
              <div key={label}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 shrink-0"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: color + "28" }}>
                  <Icon className="h-3 w-3" style={{ color }} />
                </div>
                <span className="text-[10px] font-bold text-white/80">{label}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 mt-4 pt-4" style={{ ...fadeUp(heroIn, 120), borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 shrink-0" style={{ color: "rgba(129,140,248,0.75)" }} />
                <div>
                  <p className="text-[10px] font-extrabold text-white/80 leading-none">{value}</p>
                  <p className="text-[8px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          DESKTOP  — Full animated left panel (hidden below lg)
      ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg,#07060f 0%,#0f0e2e 30%,#18125a 60%,#0b2251 100%)" }}>

        <LoginBackground />

        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle at 40% 40%,rgba(99,102,241,0.30),transparent 60%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle at 70% 70%,rgba(59,130,246,0.22),transparent 60%)", filter: "blur(70px)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(167,139,250,0.12),transparent 65%)", filter: "blur(50px)" }} />

        <div className="relative z-10 flex flex-col h-full px-11 py-11">
          <AnimatedLogo animate={logoIn} size="lg" />

          <div className="my-auto pb-8 pt-12">
            {/* trust badge */}
            <div style={fadeUp(heroIn, 0)}>
              <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.11] rounded-full px-4 py-1.5 mb-7">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.72)" }}>
                  Trusted by thousands of businesses
                </span>
              </div>
            </div>

            {/* headline */}
            <div style={fadeUp(heroIn, 80)}>
              <h1 className="font-black text-white leading-[1.06] tracking-tight mb-5"
                style={{ fontSize: "clamp(2rem,2.8vw,3rem)" }}>
                Beautiful docs,<br />
                <span style={{
                  background: "linear-gradient(95deg,#a5b4fc 0%,#818cf8 40%,#67e8f9 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>zero friction.</span>
              </h1>
              <p className="text-[14.5px] leading-relaxed max-w-[290px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                Create stunning invoices, quotes, receipts & waybills — branded and ready in minutes.
              </p>
            </div>

            {/* feature grid */}
            <div className="grid grid-cols-2 gap-2 mt-8" style={fadeUp(heroIn, 160)}>
              {FEATURES.map(({ icon: Icon, label, color, desc }) => (
                <div key={label}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-default transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.14)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.transform="translateY(0)"; }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: color+"25" }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white/90 leading-tight">{label}</p>
                    <p className="text-[9px] leading-tight mt-0.5" style={{ color:"rgba(255,255,255,0.33)" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* stats */}
            <div className="flex items-center gap-7 mt-8 pt-7" style={{ ...fadeUp(heroIn,240), borderTop:"1px solid rgba(255,255,255,0.07)" }}>
              {STATS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" style={{ color:"rgba(129,140,248,0.75)" }} />
                  <div>
                    <p className="text-[12px] font-extrabold text-white/80 leading-none">{value}</p>
                    <p className="text-[9px] mt-0.5 leading-none" style={{ color:"rgba(255,255,255,0.28)" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating doc cards */}
          <div className="relative h-44 mb-5 mt-2" style={fadeUp(docsIn,0)}>
            {DOCS.map((doc,i) => (
              <DocCard key={doc.num} doc={doc} style={{
                bottom: [8,28,5][i],
                left:   i===0 ? 0 : i===1 ? "37%" : undefined,
                right:  i===2 ? 0 : undefined,
                transform:`rotate(${[-4,2.5,-1.5][i]}deg)`,
                zIndex: [1,3,2][i],
              }} />
            ))}
          </div>

          {/* Testimonial — rotates every 6s */}
          <div style={{ ...fadeUp(docsIn,100), borderTop:"1px solid rgba(255,255,255,0.07)" }} className="pt-5">
            <div className="flex items-start gap-3.5" style={{ opacity: testimonialVisible ? 1 : 0, transition: "opacity 0.4s ease" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 uppercase"
                style={{ background:"linear-gradient(135deg,#818cf8,#a78bfa)", flexShrink: 0 }}>
                {TESTIMONIALS[testimonialIdx].name[0]}
              </div>
              <div>
                <p className="text-[12px] italic leading-relaxed" style={{ color:"rgba(255,255,255,0.52)" }}>
                  "{TESTIMONIALS[testimonialIdx].text}"
                </p>
                <p className="text-[10px] mt-1.5 font-semibold" style={{ color:"rgba(255,255,255,0.22)" }}>
                  {TESTIMONIALS[testimonialIdx].name} · {TESTIMONIALS[testimonialIdx].title}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          FORM PANEL  — all screen sizes
      ══════════════════════════════════════════════════════════ */}
      <div
        className="flex-1 lg:max-w-[460px] flex flex-col justify-center relative overflow-hidden"
        style={{ background: "linear-gradient(160deg,#f8f9ff 0%,#f1f3fb 55%,#eaecf8 100%)" }}
      >
        {/* top stripe — only visible on lg (mobile has the brand panel above) */}
        <div className="hidden lg:block absolute top-0 left-0 right-0 h-[3px]"
          style={{ background:"linear-gradient(90deg,#6366f1,#818cf8,#38bdf8,#34d399)" }} />

        {/* subtle bg glows */}
        <div className="absolute top-[-60px] right-[-60px] w-72 h-72 rounded-full pointer-events-none"
          style={{ background:"radial-gradient(circle,rgba(99,102,241,0.08),transparent 60%)", filter:"blur(40px)" }} />
        <div className="absolute bottom-[-40px] left-[-40px] w-56 h-56 rounded-full pointer-events-none"
          style={{ background:"radial-gradient(circle,rgba(59,130,246,0.07),transparent 60%)", filter:"blur(35px)" }} />

        {/* ── scroll container so form never clips on tiny phones ── */}
        <div className="relative z-10 w-full px-5 sm:px-10 lg:px-12 py-8 sm:py-10 overflow-y-auto">
          <div className="max-w-sm mx-auto lg:max-w-none">

            {/* Greeting */}
            <div className="mb-6 sm:mb-8" style={fadeUp(formIn, 0)}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl leading-none">{greeting.emoji}</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500">{greeting.text}</span>
              </div>
              <h2 className="text-[1.6rem] sm:text-[1.85rem] font-black text-slate-900 leading-tight tracking-tight">
                Sign in to DocFlow
              </h2>
              <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">
                Your business documents, ready when you are.
              </p>
            </div>

            {/* Google SSO */}
            <div style={fadeUp(formIn, 60)}>
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 h-12 rounded-2xl font-semibold text-[14px] transition-all duration-200 mb-5 active:scale-[0.98]"
                style={{ background:"#fff", border:"1.5px solid #e2e8f0", color:"#374151", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#a5b4fc"; e.currentTarget.style.boxShadow="0 4px 16px rgba(99,102,241,0.14)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="translateY(0)"; }}
              >
                <GoogleIcon className="w-5 h-5 shrink-0" />
                Continue with Google
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center gap-3 mb-5" style={fadeUp(formIn,100)}>
              <div className="flex-1 h-px" style={{ background:"linear-gradient(90deg,transparent,#e2e8f0)" }} />
              <span className="text-[11px] font-semibold text-slate-400 tracking-wider whitespace-nowrap">or with email</span>
              <div className="flex-1 h-px" style={{ background:"linear-gradient(90deg,#e2e8f0,transparent)" }} />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-center gap-3 p-3.5 rounded-2xl text-sm"
                style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626" }}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background:"#fee2e2" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                </div>
                {error}
              </div>
            )}

            {/* Form card */}
            <div style={{
              ...fadeUp(formIn,140),
              background:"rgba(255,255,255,0.78)",
              backdropFilter:"blur(16px)",
              WebkitBackdropFilter:"blur(16px)",
              border:"1.5px solid rgba(255,255,255,0.92)",
              borderRadius:"20px",
              padding:"20px",
              boxShadow:"0 4px 32px rgba(99,102,241,0.08), 0 1px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)",
            }}>
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[12.5px] font-semibold text-slate-600">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-200"
                      style={{ color: focusedField==="email" ? "#6366f1" : "#94a3b8" }} />
                    <input
                      id="email" type="email" autoComplete="email" autoFocus required
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-10 pr-4 h-12 rounded-xl text-[15px] outline-none transition-all duration-200"
                      style={{
                        background: focusedField==="email" ? "#fafbff" : "#f8f9fd",
                        border:`1.5px solid ${focusedField==="email" ? "#a5b4fc" : "#e8eaf2"}`,
                        boxShadow: focusedField==="email" ? "0 0 0 4px rgba(99,102,241,0.10)" : "none",
                        color:"#1e293b", fontSize:"16px",
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[12.5px] font-semibold text-slate-600">Password</Label>
                    <Link to="/forgot-password"
                      className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-200"
                      style={{ color: focusedField==="password" ? "#6366f1" : "#94a3b8" }} />
                    <input
                      id="password" type={showPassword ? "text" : "password"}
                      autoComplete="current-password" required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-10 pr-11 h-12 rounded-xl text-[15px] outline-none transition-all duration-200"
                      style={{
                        background: focusedField==="password" ? "#fafbff" : "#f8f9fd",
                        border:`1.5px solid ${focusedField==="password" ? "#a5b4fc" : "#e8eaf2"}`,
                        boxShadow: focusedField==="password" ? "0 0 0 4px rgba(99,102,241,0.10)" : "none",
                        color:"#1e293b", fontSize:"16px",
                      }}
                    />
                    <button type="button" onClick={() => setShowPassword(v=>!v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2.5 mt-1 transition-all duration-200 disabled:opacity-70 active:scale-[0.98]"
                  style={{
                    background: loading ? "linear-gradient(135deg,#818cf8,#6366f1)" : "linear-gradient(135deg,#6366f1 0%,#4f46e5 55%,#3730a3 100%)",
                    boxShadow: loading ? "none" : "0 5px 22px rgba(99,102,241,0.50), 0 2px 6px rgba(0,0,0,0.10)",
                  }}
                  onMouseEnter={e => { if(!loading){ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 28px rgba(99,102,241,0.60)"; }}}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 5px 22px rgba(99,102,241,0.50), 0 2px 6px rgba(0,0,0,0.10)"; }}
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </div>

            {/* Register link */}
            <p className="text-center text-[13px] text-slate-400 mt-5" style={fadeUp(formIn,220)}>
              New to DocFlow?{" "}
              <Link to="/register" className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
                Create a free account →
              </Link>
            </p>

            <p className="text-center text-[11px] text-slate-300 mt-3 pb-2" style={fadeUp(formIn,260)}>
              © {new Date().getFullYear()} DocFlow · Secure & encrypted
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}