import { Home, Send, Activity, Database, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { StatusBar } from "./StatusBar";

interface LayoutProps {
  children: React.ReactNode;
  activeTab?: "home" | "transfer" | "activity" | "chain" | "settings";
  showBottomNav?: boolean;
}

export function Layout({ children, activeTab = "home", showBottomNav = true }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = [
    { tab: "home", label: "Home", path: "/home", icon: Home },
    { tab: "transfer", label: "Transfer", path: "/transfer", icon: Send },
    { tab: "activity", label: "Activity", path: "/activity", icon: Activity },
    { tab: "chain", label: "Chain", path: "/chain", icon: Database },
    { tab: "settings", label: "Settings", path: "/settings", icon: Settings },
  ] as const;

  return (
    <div className="wallet-frame-bg flex min-h-dvh items-center justify-center p-4">
      <div className="wallet-device-shell flex h-[min(844px,calc(100dvh-2rem))] min-h-[620px] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px] border border-white/70 bg-card">
        <StatusBar />

        <div className="app-scroll wallet-device-screen flex-1 overflow-y-auto">
          {children}
        </div>

        {showBottomNav && (
          <div className="wallet-bottom-nav border-t border-border px-4 pb-6 pt-3">
            <nav className="flex items-center justify-around" aria-label="Primary">
              {navItems.map((item) => {
                const isActive = activeTab === item.tab || location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => navigate(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    data-active={isActive ? "true" : undefined}
                    className={`wallet-nav-button flex min-h-12 min-w-12 cursor-pointer touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-xs ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
