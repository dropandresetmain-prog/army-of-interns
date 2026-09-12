"use client";

import { useState } from "react";
import {
  Bell,
  CircleCheck,
  CreditCard,
  FileText,
  Home,
  MessageCircle,
  Moon,
  MoreHorizontal,
  ReceiptText,
  ShieldCheck,
  Sun,
  Wrench,
} from "lucide-react";
import { LandlordAvatarScene } from "./landlord-avatar-scene";

type ContractorStage = "New" | "Hiring" | "Matched" | "Fixed" | "Paid";
const stages: ContractorStage[] = ["New", "Hiring", "Matched", "Fixed", "Paid"];
const voiceOptions = ["Singlish", "Normal English", "Mandarin", "Tamil", "Malay"] as const;

const notifications = [
  "Alex matched a contractor for the leaking toilet.",
  "Invoice SGD 380 is pending your approval.",
];

function Journey({ activeStage = "Matched" }: { activeStage?: ContractorStage }) {
  const activeIndex = stages.indexOf(activeStage);
  return (
    <ol className="landlord-journey" aria-label="Contractor request progress">
      {stages.map((stage, index) => {
        const done = index <= activeIndex;
        const current = index === activeIndex;
        return (
          <li key={stage} className={done ? "done" : ""} aria-current={current ? "step" : undefined}>
            <i>{index < activeIndex ? <CircleCheck size={11} /> : index + 1}</i>
            <span>
              {stage}
              {current ? <span className="sr-only"> (current step)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function LandlordHeader({
  theme,
  onToggleTheme,
  unreadCount,
  notificationsOpen,
  onToggleNotifications,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  unreadCount: number;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
}) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <header className="landlord-header">
      <div>
        <span className="brand-kicker">Army of Interns</span>
        <h1>Home command</h1>
      </div>
      <div className="landlord-header-actions">
        <button aria-label={`Switch to ${nextTheme} mode`} className="landlord-icon-button" onClick={onToggleTheme}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="landlord-notifications">
          <button
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            aria-expanded={notificationsOpen}
            className="landlord-icon-button"
            onClick={onToggleNotifications}
          >
            <Bell size={18} />
            {unreadCount > 0 ? <i /> : null}
          </button>
          {notificationsOpen ? (
            <div className="landlord-notifications__panel" role="menu" aria-label="Notifications">
              {notifications.length > 0 ? (
                notifications.map((note) => <p key={note} role="menuitem">{note}</p>)
              ) : (
                <p>No new notifications.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function PropertyBar() {
  return (
    <section className="landlord-property">
      <Home size={15} />
      <div>
        <span>Active property</span>
        <b>The Cedar · Unit 18-07</b>
      </div>
      <MoreHorizontal size={18} aria-hidden="true" />
    </section>
  );
}

function ActiveRequestCard() {
  return (
    <section className="landlord-section" id="requests">
      <div className="landlord-section__heading">
        <div>
          <span className="brand-kicker">Active request</span>
          <h2>Leaking toilet</h2>
        </div>
        <span className="landlord-status-chip">
          <i /> Contractor matched
        </span>
      </div>
      <div className="landlord-request">
        <div className="landlord-request__meta">
          <span>Tenant · TENANT-01</span>
          <span>Target · Today, 17:00</span>
        </div>
        <Journey />
        <div className="landlord-request__action">
          <span>Alex has found the best available contractor.</span>
          <button aria-label="Message Alex">
            <MessageCircle size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function AlexHero() {
  return (
    <section className="landlord-hero">
      <p className="brand-kicker">Your AI property manager</p>
      <LandlordAvatarScene />
      <p className="landlord-reassurance">
        Alex keeps the people, money and maintenance around your property moving—without you having to chase.
      </p>
    </section>
  );
}

function OverviewGrid() {
  return (
    <section className="landlord-overview" aria-label="Property overview">
      <article>
        <span className="overview-icon overview-icon--maintenance">
          <Wrench size={17} />
        </span>
        <div>
          <small>Maintenance</small>
          <strong>1 active</strong>
          <p>Contractor matched</p>
        </div>
      </article>
      <article>
        <span className="overview-icon overview-icon--invoice">
          <FileText size={17} />
        </span>
        <div>
          <small>Invoices</small>
          <strong>SGD 380</strong>
          <p>Due after work</p>
        </div>
      </article>
      <article>
        <span className="overview-icon overview-icon--payment">
          <CreditCard size={17} />
        </span>
        <div>
          <small>Payments</small>
          <strong>Protected</strong>
          <p>Approval required</p>
        </div>
      </article>
    </section>
  );
}

function FinanceSplit() {
  return (
    <section className="landlord-section landlord-section--split" id="invoices">
      <article className="landlord-finance-card">
        <div>
          <span className="brand-kicker">Payment protection</span>
          <b>Approval stays with you.</b>
          <p>No contractor is confirmed or paid before your approval.</p>
        </div>
        <ShieldCheck size={18} aria-hidden="true" />
      </article>
      <article className="landlord-invoice-card">
        <ReceiptText size={18} aria-hidden="true" />
        <div>
          <span>Latest invoice</span>
          <b>Plumbing call-out · SGD 380</b>
        </div>
        <small>Pending</small>
      </article>
    </section>
  );
}

function ProfileSection({
  voice,
  onSelectVoice,
}: {
  voice: (typeof voiceOptions)[number];
  onSelectVoice: (voice: (typeof voiceOptions)[number]) => void;
}) {
  return (
    <section className="landlord-section" id="profile">
      <div className="landlord-section__heading">
        <div>
          <span className="brand-kicker">Profile</span>
          <h2>Alex&apos;s voice</h2>
        </div>
      </div>
      <div className="alex-voice" aria-label="Alex communication preference">
        <div>
          <span className="brand-kicker">Speaking as</span>
          <b>{voice}</b>
        </div>
        <div role="group" aria-label="Choose Alex's voice">
          {voiceOptions.map((option) => (
            <button
              key={option}
              className={option === voice ? "selected" : ""}
              aria-pressed={option === voice}
              onClick={() => onSelectVoice(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandlordNav() {
  return (
    <nav className="landlord-nav" aria-label="Landlord navigation">
      <a className="active" href="/landlords">
        <Home size={17} />
        Home
      </a>
      <a href="#requests">
        <Wrench size={17} />
        Requests
      </a>
      <a href="#invoices">
        <ReceiptText size={17} />
        Invoices
      </a>
      <a href="#profile">
        <span className="landlord-nav-avatar">A</span>
        Profile
      </a>
    </nav>
  );
}

export function LandlordCommandCentre() {
  const [voice, setVoice] = useState<(typeof voiceOptions)[number]>("Normal English");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <main className="landlord-page" data-theme={theme}>
      <LandlordHeader
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        unreadCount={notifications.length}
        notificationsOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((open) => !open)}
      />
      <PropertyBar />
      <ActiveRequestCard />
      <AlexHero />
      <OverviewGrid />
      <FinanceSplit />
      <ProfileSection voice={voice} onSelectVoice={setVoice} />
      <LandlordNav />
    </main>
  );
}
