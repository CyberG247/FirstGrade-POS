import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, ShoppingCart, Package, BarChart3, Receipt, Shield, CheckCircle2 } from "lucide-react";

const features = [
  { icon: ShoppingCart, title: "Smart POS", desc: "Lightning-fast checkout with barcode scanning, split payments, and instant receipts." },
  { icon: Package, title: "Inventory Control", desc: "Real-time stock tracking, low-stock alerts, multi-warehouse support." },
  { icon: Receipt, title: "FIRS-Ready Invoicing", desc: "VAT-compliant receipts, TIN capture, tax audit trail built-in." },
  { icon: BarChart3, title: "Business Analytics", desc: "Daily sales, revenue trends, top sellers — all on one dashboard." },
  { icon: Shield, title: "Bank-Grade Security", desc: "Role-based access, encrypted data, full transaction audit logs." },
  { icon: Building2, title: "Multi-Branch Ready", desc: "Built for supermarkets, pharmacies, agencies, and institutions." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold text-primary leading-tight">NaijaPOS</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Enterprise Suite</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth?mode=signup"><Button>Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="container py-24 md:py-32 text-center text-primary-foreground">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-foreground/10 text-xs font-medium mb-6 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-brand-red" /> Built for Nigerian Businesses
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
            POS, Inventory & Tax Compliance — <span className="text-brand-red">All in One Platform</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto">
            The trusted enterprise system for retailers, pharmacies, supermarkets, and government agencies across Nigeria.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/auth?mode=signup">
              <Button size="lg" variant="destructive" className="px-8 h-12 text-base shadow-elevated">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Sign in to Dashboard
              </Button>
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-primary-foreground/70">
            {["FIRS VAT Compliant", "Naira Currency", "Multi-Branch", "Offline Sync"].map((t) => (
              <div key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-red" />{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-primary">Everything your business needs</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            From the cashier counter to the boardroom — one platform, total control.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-lg bg-card border shadow-card hover:shadow-elevated transition-smooth">
              <div className="h-11 w-11 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="container py-16 text-center">
          <h2 className="text-3xl font-bold">Ready to modernize your business?</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">Join Nigerian businesses already running on NaijaPOS.</p>
          <Link to="/auth?mode=signup">
            <Button size="lg" variant="destructive" className="mt-8 px-8 h-12 text-base">Create your account</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="container py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} NaijaPOS Enterprise Suite. Built for Nigeria. 🇳🇬
        </div>
      </footer>
    </div>
  );
};

export default Landing;