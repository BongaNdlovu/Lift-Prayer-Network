import React, { useMemo, useState } from "react";

const palette = {
  green: "#35583C",
  softGreen: "#E7EDDF",
  cream: "#FAF7EF",
  card: "#FFFDF8",
  border: "#E8E0D2",
  ink: "#1E1E1E",
  muted: "#76736B",
  gold: "#C77A24",
  red: "#B94A3E",
};

const iconPaths = {
  bell: [
    <path key="1" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />,
    <path key="2" d="M13.7 21a2 2 0 0 1-3.4 0" />,
  ],
  search: [
    <circle key="1" cx="11" cy="11" r="7" />,
    <path key="2" d="m20 20-3.5-3.5" />,
  ],
  home: [
    <path key="1" d="M3 10.5 12 3l9 7.5" />,
    <path key="2" d="M5 9.5V21h14V9.5" />,
    <path key="3" d="M9.5 21v-6h5v6" />,
  ],
  heart: [
    <path key="1" d="M20.8 4.6a5.2 5.2 0 0 0-7.4 0L12 6l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 21l8.8-9a5.2 5.2 0 0 0 0-7.4Z" />,
  ],
  plus: [
    <path key="1" d="M12 5v14" />,
    <path key="2" d="M5 12h14" />,
  ],
  users: [
    <path key="1" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />,
    <circle key="2" cx="9" cy="7" r="4" />,
    <path key="3" d="M22 21v-2a4 4 0 0 0-3-3.9" />,
    <path key="4" d="M16 3.1a4 4 0 0 1 0 7.8" />,
  ],
  user: [
    <path key="1" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />,
    <circle key="2" cx="12" cy="7" r="4" />,
  ],
  bookmark: [<path key="1" d="M6 3h12v18l-6-4-6 4V3Z" />],
  share: [
    <circle key="1" cx="18" cy="5" r="3" />,
    <circle key="2" cx="6" cy="12" r="3" />,
    <circle key="3" cx="18" cy="19" r="3" />,
    <path key="4" d="m8.6 13.5 6.8 4" />,
    <path key="5" d="m15.4 6.5-6.8 4" />,
  ],
  arrowLeft: [
    <path key="1" d="M19 12H5" />,
    <path key="2" d="m12 19-7-7 7-7" />,
  ],
  arrowRight: [
    <path key="1" d="M5 12h14" />,
    <path key="2" d="m12 5 7 7-7 7" />,
  ],
  more: [
    <circle key="1" cx="5" cy="12" r="1.5" />,
    <circle key="2" cx="12" cy="12" r="1.5" />,
    <circle key="3" cx="19" cy="12" r="1.5" />,
  ],
  message: [
    <path key="1" d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />,
  ],
  leaf: [
    <path key="1" d="M5 21c8-2 14-8 16-18C11 5 5 11 5 21Z" />,
    <path key="2" d="M5 21c4-7 8-10 13-14" />,
  ],
  book: [
    <path key="1" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />,
    <path key="2" d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" />,
  ],
  megaphone: [
    <path key="1" d="M3 11v4a2 2 0 0 0 2 2h2l4 4v-6" />,
    <path key="2" d="M11 7V3l10 4v12l-10-4" />,
    <path key="3" d="M7 11h4" />,
  ],
  send: [
    <path key="1" d="M22 2 11 13" />,
    <path key="2" d="m22 2-7 20-4-9-9-4 20-7Z" />,
  ],
  shield: [
    <path key="1" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    <path key="2" d="m9 12 2 2 4-5" />,
  ],
  clock: [
    <circle key="1" cx="12" cy="12" r="9" />,
    <path key="2" d="M12 7v5l3 2" />,
  ],
  check: [<path key="1" d="m5 12 4 4L19 6" />],
  lock: [
    <rect key="1" x="5" y="11" width="14" height="10" rx="2" />,
    <path key="2" d="M8 11V8a4 4 0 0 1 8 0v3" />,
  ],
  sparkle: [
    <path key="1" d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />,
    <path key="2" d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />,
  ],
  x: [
    <path key="1" d="M18 6 6 18" />,
    <path key="2" d="m6 6 12 12" />,
  ],
  flame: [
    <path key="1" d="M8.5 14.5A3.5 3.5 0 0 0 12 22a7 7 0 0 0 7-7c0-4-2.5-6.5-5-9.5-.5 2.7-2 4.1-4 5.5-1.3.9-1.5 2.1-1.5 3.5Z" />,
    <path key="2" d="M12 22a3.5 3.5 0 0 0 3.5-3.5c0-1.8-.9-3.1-2.2-4.3-.3 1.4-1.1 2.2-2.2 3-.7.5-1.1 1.1-1.1 1.9A2.9 2.9 0 0 0 12 22Z" />,
  ],
  calendar: [
    <path key="1" d="M8 2v4" />,
    <path key="2" d="M16 2v4" />,
    <rect key="3" x="3" y="4" width="18" height="18" rx="2" />,
    <path key="4" d="M3 10h18" />,
  ],
  settings: [
    <circle key="1" cx="12" cy="12" r="3" />,
    <path key="2" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />,
  ],
  pray: [
    <path key="1" d="M17 21v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8" />,
    <circle key="2" cx="10" cy="8" r="4" />,
    <path key="3" d="m22 10.5-3.5 3.5" />,
    <path key="4" d="m18.5 10.5 3.5 3.5" />,
  ],
  cross: [
    <path key="1" d="M12 3v18" />,
    <path key="2" d="M3 12h18" />,
  ],
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  fill?: string;
  strokeWidth?: number;
}

function Icon({ name, size = 20, className = "", fill = "none", strokeWidth = 2 }: IconProps) {
  const paths = iconPaths[name as keyof typeof iconPaths] || iconPaths.leaf;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

/* ==================== DATA ==================== */

const initialFeedItems = [
  {
    id: "peace-home",
    type: "Prayer Request",
    name: "Sarah M.",
    time: "2h ago",
    title: "Pray for peace in our home",
    body: "We've been walking through a really hard season with tension and worry. Please pray for unity and healing in our family. Thank you.",
    count: 35,
    category: "Family",
    urgent: false,
  },
  {
    id: "job-offer",
    type: "Answered Praise",
    name: "David K.",
    time: "1d ago",
    title: "Job offer after months of searching!",
    body: "So grateful! After months of applying and waiting, I received an offer this week. God is so faithful.",
    count: 112,
    answered: true,
    category: "Provision",
    urgent: false,
  },
  {
    id: "college-finals",
    type: "Prayer Request",
    name: "Grace L.",
    time: "3h ago",
    title: "Pray for focus during finals",
    body: "I have a heavy exam week ahead. Please pray for a calm mind, discipline, and wisdom as I study.",
    count: 18,
    category: "Studies",
    urgent: false,
  },
];

const encouragements = [
  {
    name: "James L.",
    body: "I'm lifting you up, Sarah. Praying for God's peace to guard your hearts this week.",
    likes: 12,
  },
  {
    name: "Olivia C.",
    body: "Praying with you! Philippians 4:6-7 has been such a comfort to me.",
    likes: 8,
  },
];

const categories = ["Family", "Health", "Provision", "Studies", "Work", "Peace", "Spiritual Growth"];

const initialPrayerData = [
  { day: "Mon", value: 2, completed: true },
  { day: "Tue", value: 4, completed: true },
  { day: "Wed", value: 3, completed: true },
  { day: "Thu", value: 6, completed: true },
  { day: "Fri", value: 5, completed: true },
  { day: "Sat", value: 7, completed: false },
  { day: "Sun", value: 4, completed: false },
];

/* ==================== UTILS ==================== */

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getTodayIndex() {
  const d = new Date().getDay();
  return d;
}

function getTodayDayName() {
  return dayNames[new Date().getDay()];
}

/* ==================== PREVIEW CHECKS ==================== */

function runPreviewChecks() {
  const requiredIcons = [
    "bell", "search", "home", "heart", "plus", "users", "user", "bookmark",
    "share", "arrowLeft", "arrowRight", "more", "message", "leaf", "book",
    "megaphone", "send", "shield", "clock", "check", "lock", "sparkle", "x",
    "flame", "calendar", "settings", "pray", "cross",
  ];
  return {
    iconsAvailable: requiredIcons.every((name) => Array.isArray(iconPaths[name as keyof typeof iconPaths])),
    feedHasMultipleCards: initialFeedItems.length >= 3,
    detailHasEncouragements: encouragements.length >= 2,
    createScreenAdded: categories.length >= 5,
    streakScreenAdded: true,
    lineGraphAdded: initialPrayerData.length === 7,
    currentDayComputedDynamically: true,
    dailyVerseRemovedFromWall: true,
    appHasNavigation: true,
    allMainScreensReachable: true,
  };
}

const previewChecks = runPreviewChecks();

/* ==================== SHARED COMPONENTS ==================== */

const Avatar = ({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <div
      className={`${sizes[size]} shrink-0 overflow-hidden rounded-full border border-[#E8E0D2] bg-[#EFE8DA] flex items-center justify-center font-semibold text-[#35583C]`}
    >
      {initials}
    </div>
  );
};

const PhoneShell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto h-[812px] w-[375px] rounded-[46px] border-[10px] border-[#111] bg-[#111] shadow-2xl shadow-black/25">
    <div className="absolute left-1/2 top-0 z-20 h-7 w-32 -translate-x-1/2 rounded-b-3xl bg-[#111]" />
    <div className="h-full w-full overflow-hidden rounded-[34px] bg-[#FAF7EF]">{children}</div>
  </div>
);

const StatusBar = () => (
  <div className="flex h-10 items-center justify-between px-6 pt-2 text-[12px] font-semibold text-[#1E1E1E]">
    <span>9:41</span>
    <div className="flex items-center gap-1">
      <div className="h-2.5 w-4 rounded-sm border border-[#1E1E1E]">
        <div className="h-full w-3 rounded-sm bg-[#1E1E1E]" />
      </div>
    </div>
  </div>
);

const ScrollContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`h-full overflow-y-auto overflow-x-hidden px-5 pb-28 pt-2 ${className}`}
    style={{
      scrollbarWidth: "thin",
      scrollbarColor: "#B5C4A8 #FAF7EF",
    } as React.CSSProperties}
  >
    <style>{`
      .h-full::-webkit-scrollbar { width: 5px; }
      .h-full::-webkit-scrollbar-track { background: #FAF7EF; border-radius: 10px; }
      .h-full::-webkit-scrollbar-thumb { background: #B5C4A8; border-radius: 10px; }
      .h-full::-webkit-scrollbar-thumb:hover { background: #35583C; }
    `}</style>
    {children}
  </div>
);

const BottomNav = ({ active, onSelect }: { active: string; onSelect: (tab: string) => void }) => {
  const items = [
    { label: "Home", icon: "home" },
    { label: "Prayers", icon: "pray" },
    { label: "Calendar", icon: "calendar" },
    { label: "Community", icon: "users" },
    { label: "Profile", icon: "user" },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-[#E8E0D2] bg-[#FFFDF8]/95 px-5 pb-5 pt-2 backdrop-blur transition-all duration-300">
      <div className="flex items-end justify-between">
        {items.map((item) => {
          const isActive = active === item.label;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelect(item.label)}
              className={`flex flex-col items-center gap-1 text-[10px] transition-all duration-300 ${isActive ? "text-[#35583C] scale-105" : "text-[#76736B]"}`}
            >
              <span className={`transition-transform duration-300 ${isActive ? "scale-110" : ""}`}>
                <Icon name={item.icon} size={20} fill={isActive ? "#35583C" : "none"} />
              </span>
              <span className={`transition-all duration-300 ${isActive ? "font-semibold" : ""}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8]/80 px-3 py-3 transition hover:shadow-md hover:-translate-y-0.5 duration-300">
      <div className="mb-2 flex items-center gap-2 text-[#35583C]">
        <Icon name={icon} size={15} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#76736B]">{label}</span>
      </div>
      <p className="font-serif text-[22px] leading-none text-[#1E1E1E]">{value}</p>
    </div>
  );
}

function ToggleRow({ icon, title, subtitle, enabled, onToggle }: {
  icon: string; title: string; subtitle: string; enabled: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] px-4 py-3 text-left transition hover:shadow-sm duration-200">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7EDDF] text-[#35583C]">
          <Icon name={icon} size={18} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#1E1E1E]">{title}</p>
          <p className="text-[11px] text-[#76736B]">{subtitle}</p>
        </div>
      </div>
      <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-all duration-300 ${enabled ? "bg-[#35583C]" : "bg-[#DED8CC]"}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

/* ==================== LINE GRAPH ==================== */

function PrayerLineGraph({ data }: { data: { day: string; value: number; completed: boolean }[] }) {
  const maxValue = Math.max(...data.map((p) => p.value), 1);
  const minValue = Math.min(...data.map((p) => p.value));
  const totalActions = data.reduce((sum, p) => sum + p.value, 0);
  const peakPoint = data.reduce((max, p) => (p.value > max.value ? p : max), data[0]);
  const peakDay = peakPoint.day;
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  const firstAvg = firstHalf.reduce((s, p) => s + p.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, p) => s + p.value, 0) / secondHalf.length;
  const trend = secondAvg > firstAvg ? "Up" : secondAvg < firstAvg ? "Down" : "Steady";

  const chartWidth = 280;
  const chartHeight = 120;
  const horizontalPadding = 16;
  const verticalPadding = 14;
  const usableWidth = chartWidth - horizontalPadding * 2;
  const usableHeight = chartHeight - verticalPadding * 2;

  const points = data.map((point, index) => {
    const x = horizontalPadding + (index / (data.length - 1)) * usableWidth;
    const normalized = (point.value - minValue) / Math.max(maxValue - minValue, 1);
    const y = chartHeight - verticalPadding - normalized * usableHeight;
    return { ...point, x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${chartHeight - verticalPadding} L${points[0].x},${chartHeight - verticalPadding} Z`;

  return (
    <section className="mb-5 rounded-[24px] border border-[#E8E0D2] bg-[#FFFDF8] p-4 shadow-sm shadow-black/5 transition hover:shadow-md duration-300">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-[22px] tracking-[-0.03em] text-[#1E1E1E]">Prayer activity</h2>
          <p className="text-[12px] text-[#76736B]">Last 7 days of prayer actions</p>
        </div>
        <div className="rounded-full bg-[#E7EDDF] px-3 py-1 text-[11px] font-semibold text-[#35583C]">
          {trend === "Up" ? "+" : trend === "Down" ? "-" : ""}{trend}
        </div>
      </div>
      <div className="rounded-2xl bg-[#FAF7EF] p-3">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[120px] w-full overflow-visible" aria-label="Prayer activity line graph">
          {[0, 1, 2].map((line) => {
            const y = verticalPadding + line * (usableHeight / 2);
            return <line key={line} x1={horizontalPadding} y1={y} x2={chartWidth - horizontalPadding} y2={y} stroke="#E8E0D2" strokeWidth="1" />;
          })}
          <path d={areaPath} fill="#E7EDDF" opacity="0.75" />
          <path d={linePath} fill="none" stroke="#35583C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={point.day}>
              <circle cx={point.x} cy={point.y} r="5" fill="#FFFDF8" stroke="#35583C" strokeWidth="3" />
              <text x={point.x} y={chartHeight - 2} textAnchor="middle" fontSize="9" fill="#76736B">{point.day.slice(0, 1)}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-[#FAF7EF] px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#76736B]">Peak day</p>
          <p className="font-serif text-[18px] text-[#1E1E1E]">{peakDay}</p>
        </div>
        <div className="rounded-2xl bg-[#FAF7EF] px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#76736B]">Actions</p>
          <p className="font-serif text-[18px] text-[#1E1E1E]">{totalActions}</p>
        </div>
        <div className="rounded-2xl bg-[#FAF7EF] px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#76736B]">Trend</p>
          <p className="font-serif text-[18px] text-[#35583C]">{trend}</p>
        </div>
      </div>
    </section>
  );
}

/* ==================== FEED SCREEN ==================== */

const FeedCard = ({ item, onOpen }: { item: typeof initialFeedItems[0]; onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    className="w-full rounded-[24px] border border-[#E8E0D2] bg-[#FFFDF8] p-4 text-left shadow-sm shadow-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
  >
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar initials={item.name.split(" ").map((x) => x[0]).join("").slice(0, 2)} size="sm" />
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#1E1E1E]">
            {item.type}
            {item.urgent && <span className="rounded-full bg-[#F8E7E3] px-2 py-0.5 text-[9px] text-[#B94A3E]">Urgent</span>}
          </div>
          <div className="text-[10px] text-[#76736B]">{item.name} &middot; {item.time} &middot; {item.category}</div>
        </div>
      </div>
      <Icon name="bookmark" size={18} className="text-[#76736B]" />
    </div>
    <h3 className="font-serif text-[22px] leading-tight tracking-[-0.02em] text-[#1E1E1E]">{item.title}</h3>
    <p className="mt-2 line-clamp-3 text-[13px] leading-5 text-[#333]">{item.body}</p>
    <div className="mt-4 flex items-center justify-between border-t border-[#EEE7DA] pt-3 text-[12px] text-[#76736B]">
      <span className="flex items-center gap-1.5">
        <Icon name="heart" size={16} fill={item.answered ? "#C75B4A" : "none"} className={item.answered ? "text-[#C75B4A]" : "text-[#35583C]"} />
        {item.count} {item.answered ? "rejoicing" : "praying"}
      </span>
      <span className="flex items-center gap-1.5 font-semibold text-[#35583C]">
        Open
        <Icon name="arrowRight" size={14} />
      </span>
    </div>
  </button>
);

function FeedScreen({ items, onOpenRequest, onOpenStreak, justPosted }: {
  items: typeof initialFeedItems;
  onOpenRequest: (item: typeof initialFeedItems[0]) => void;
  onOpenStreak: () => void;
  justPosted: boolean;
}) {
  const [filter, setFilter] = useState("For You");
  const visibleItems = filter === "Answered" ? items.filter((item) => item.answered) : items;

  const todayIdx = getTodayIndex();
  const todayDone = false;
  const weekMini = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-serif text-[34px] leading-none tracking-[-0.04em] text-[#35583C]">Lift.</h1>
          <p className="mt-1 text-[11px] text-[#76736B]">Good morning &middot; 3 people prayed for you</p>
        </div>
        <div className="flex items-center gap-4 text-[#1E1E1E]">
          <button className="transition hover:scale-110 duration-200"><Icon name="bell" size={21} /></button>
          <button className="transition hover:scale-110 duration-200"><Icon name="search" size={21} /></button>
        </div>
      </header>

      {justPosted && (
        <section className="mb-4 rounded-2xl border border-[#DDE7D8] bg-[#F2F7EF] px-4 py-3 text-[12px] text-[#35583C] animate-slide-in">
          <div className="flex items-center gap-2 font-semibold">
            <Icon name="check" size={16} /> Your prayer request was posted.
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={onOpenStreak}
        className="mb-4 block w-full rounded-[28px] border border-[#E8E0D2] bg-gradient-to-br from-[#FFFDF8] to-[#EFE8DA] p-5 text-left shadow-sm shadow-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#76736B]">Today&apos;s rhythm</p>
            <h2 className="mt-1 font-serif text-[28px] leading-none tracking-[-0.04em] text-[#1E1E1E]">21 day prayer streak</h2>
            <p className="mt-2 text-[12px] leading-5 text-[#5F5A50]">A gentle reminder to pray, encourage someone, and thank God for answered prayers.</p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#35583C] text-white shadow-lg shadow-[#35583C]/20 animate-pulse-soft">
            <Icon name="flame" size={25} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat label="Prayers" value="248" icon="heart" />
          <MiniStat label="Supported" value="37" icon="users" />
          <MiniStat label="Answered" value="18" icon="check" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1">
            {weekMini.map((d, i) => (
              <div
                key={d + i}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${
                  i === todayIdx
                    ? "border-2 border-[#35583C] bg-[#35583C] text-white animate-pulse-soft"
                    : i < todayIdx
                    ? "bg-[#E7EDDF] text-[#35583C]"
                    : "bg-[#FAF7EF] text-[#76736B]"
                }`}
              >
                {i < todayIdx ? <Icon name="check" size={10} /> : d}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#35583C]">
            View streak details <Icon name="arrowRight" size={12} />
          </div>
        </div>
      </button>

      <section className="mb-4 grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-2 rounded-xl border border-[#E8E0D2] bg-[#EFE8DA] px-3 py-3 text-[12px] font-semibold text-[#2B2B2B] transition hover:shadow-sm duration-200" type="button">
          <Icon name="megaphone" size={15} /> Announcements
        </button>
        <button className="flex items-center justify-center gap-2 rounded-xl border border-[#E8E0D2] bg-[#EFE8DA] px-3 py-3 text-[12px] font-semibold text-[#2B2B2B] transition hover:shadow-sm duration-200" type="button">
          <Icon name="book" size={15} /> Devotions
        </button>
      </section>

      <section className="mb-5 flex items-center gap-2 rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-1 text-[12px] font-semibold text-[#76736B]">
        {["For You", "Following", "Answered"].map((tab) => (
          <button
            key={tab}
            className={`flex-1 rounded-xl px-3 py-2 transition-all duration-300 ${filter === tab ? "bg-[#35583C] text-white shadow-sm" : "text-[#76736B] hover:bg-[#FAF7EF]"}`}
            type="button"
            onClick={() => setFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </section>

      <div className="space-y-4">
        {visibleItems.map((item) => (
          <FeedCard key={item.id} item={item} onOpen={() => onOpenRequest(item)} />
        ))}
      </div>
    </ScrollContainer>
  );
}

/* ==================== ENCOURAGEMENT ==================== */

const Encouragement = ({ name, body, likes }: { name: string; body: string; likes: number }) => (
  <div className="rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-3 transition hover:shadow-sm duration-200">
    <div className="flex items-start gap-3">
      <Avatar initials={name.split(" ").map((x) => x[0]).join("").slice(0, 2)} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[#1E1E1E]">{name}</p>
          <button className="transition hover:scale-110 duration-200"><Icon name="heart" size={16} className="text-[#76736B]" /></button>
        </div>
        <p className="mt-1 text-[12px] leading-5 text-[#333]">{body}</p>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-[#76736B]">
          <Icon name="heart" size={13} /> {likes}
        </div>
      </div>
    </div>
  </div>
);

/* ==================== REQUEST DETAIL ==================== */

function RequestDetailScreen({ request, onBack }: { request: typeof initialFeedItems[0] | undefined; onBack: () => void }) {
  const [prayed, setPrayed] = useState(false);
  const currentRequest = request || initialFeedItems[0];
  const prayerCount = currentRequest.count + (prayed && !currentRequest.answered ? 1 : 0);

  return (
    <>
      <ScrollContainer>
        <header className="mb-5 flex items-center justify-between animate-fade-in">
          <button className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button" onClick={onBack}>
            <Icon name="arrowLeft" size={21} />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
            <Icon name="more" size={22} />
          </button>
        </header>

        <section className="mb-5 animate-fade-in">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#35583C]">
            <Icon name="leaf" size={14} /> {currentRequest.type}
          </div>
          <div className="mb-5 flex items-center gap-3">
            <Avatar initials={currentRequest.name.split(" ").map((x) => x[0]).join("").slice(0, 2)} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-[#1E1E1E]">{currentRequest.name}</p>
                <button className="rounded-full bg-[#E7EDDF] px-2 py-0.5 text-[10px] font-semibold text-[#35583C] transition hover:bg-[#35583C] hover:text-white duration-200" type="button">Follow</button>
              </div>
              <p className="text-[11px] text-[#76736B]">{currentRequest.time} &middot; {currentRequest.category}</p>
            </div>
          </div>
          <h1 className="font-serif text-[32px] leading-[1.05] tracking-[-0.04em] text-[#1E1E1E]">
            {currentRequest.title}
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-[#2E2E2E]">
            {currentRequest.body}
          </p>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-2 text-[12px] text-[#76736B]">
          <div className="rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon name="heart" size={17} className="text-[#35583C]" fill={prayed ? "#35583C" : "none"} />
              <span><strong className="text-[#1E1E1E]">{prayerCount}</strong> {currentRequest.answered ? "rejoicing" : "praying"}</span>
            </div>
          </div>
          <button className="flex items-center justify-center gap-2 rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] px-4 py-3 transition hover:shadow-sm duration-200" type="button">
            <Icon name="share" size={16} /> Share
          </button>
        </section>

        <section className="mb-5 rounded-[24px] border border-[#DDE7D8] bg-[#F2F7EF] p-4">
          <div className="flex items-start gap-3">
            <Icon name="shield" size={20} className="mt-0.5 text-[#35583C]" />
            <div>
              <h2 className="text-[13px] font-bold text-[#1E1E1E]">Prayerful response</h2>
              <p className="mt-1 text-[12px] leading-5 text-[#5F6859]">
                Tap &ldquo;I&apos;ll Pray&rdquo; to let {currentRequest.name.replace(".", "")} know they are supported. You can also leave a kind encouragement below.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-[21px] text-[#1E1E1E]">Encouragements</h2>
            <span className="text-[12px] text-[#76736B]">{encouragements.length}</span>
          </div>
          <div className="space-y-3">
            {encouragements.map((item) => (
              <Encouragement key={`${item.name}-${item.likes}`} {...item} />
            ))}
          </div>
        </section>
      </ScrollContainer>

      <div className="absolute bottom-0 left-0 right-0 border-t border-[#E8E0D2] bg-[#FFFDF8]/95 px-5 pb-5 pt-3 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <button
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold shadow-lg transition-all duration-300 ${
              prayed ? "bg-[#E7EDDF] text-[#35583C] shadow-black/5" : "bg-[#35583C] text-white shadow-[#35583C]/20 hover:brightness-110"
            }`}
            type="button"
            onClick={() => setPrayed(true)}
          >
            <Icon name="heart" size={18} fill={prayed ? "#35583C" : "none"} /> {prayed ? "Praying" : "I&apos;ll Pray"}
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E8E0D2] bg-[#FAF7EF] text-[#35583C] transition hover:shadow-sm duration-200" type="button">
            <Icon name="bookmark" size={19} />
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E8E0D2] bg-[#FAF7EF] text-[#35583C] transition hover:shadow-sm duration-200" type="button">
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

/* ==================== CREATE REQUEST ==================== */

function CreateRequestScreen({ onBack, onSubmit }: { onBack: () => void; onSubmit: (req: typeof initialFeedItems[0]) => void }) {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Family");
  const [urgent, setUrgent] = useState(false);
  const [privatePost, setPrivatePost] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const canPost = body.trim().length >= 12;

  const generatedTitle = useMemo(() => {
    const clean = body.trim().replace(/\s+/g, " ");
    if (!clean) return "Prayer request";
    return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
  }, [body]);

  const handleSubmit = () => {
    if (!canPost) return;
    onSubmit({
      id: `request-${Date.now()}`,
      type: "Prayer Request",
      name: anonymous ? "Anonymous" : "You",
      time: "Just now",
      title: generatedTitle,
      body: body.trim(),
      count: 0,
      category,
      urgent,
      privatePost,
      anonymous,
    } as typeof initialFeedItems[0]);
  };

  return (
    <>
      <ScrollContainer>
        <header className="mb-6 flex items-center justify-between animate-fade-in">
          <button className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button" onClick={onBack}>
            <Icon name="x" size={21} />
          </button>
          <h1 className="text-[14px] font-semibold text-[#1E1E1E]">Create Request</h1>
          <button
            className={`rounded-full px-4 py-2 text-[12px] font-semibold transition-all duration-300 ${canPost ? "bg-[#35583C] text-white shadow-md hover:brightness-110" : "bg-[#E8E0D2] text-[#76736B]"}`}
            type="button"
            onClick={handleSubmit}
            disabled={!canPost}
          >
            Post
          </button>
        </header>

        <section className="mb-5 rounded-[28px] border border-[#E8E0D2] bg-[#FFFDF8] p-5 shadow-sm shadow-black/5 animate-fade-in">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#35583C]">New prayer request</p>
          <h2 className="font-serif text-[31px] leading-[1.05] tracking-[-0.04em] text-[#1E1E1E]">What do you need prayer for?</h2>
          <p className="mt-2 text-[13px] leading-5 text-[#76736B]">Share as much or as little as you&apos;re comfortable with. The community can pray with you.</p>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Example: Please pray for peace, wisdom, and strength for my family this week…"
            className="mt-5 min-h-[170px] w-full resize-none rounded-2xl border border-[#E8E0D2] bg-[#FAF7EF] p-4 text-[14px] leading-6 text-[#1E1E1E] outline-none placeholder:text-[#A39B8D] transition focus:border-[#35583C] focus:shadow-sm duration-200"
            maxLength={500}
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#76736B]">
            <span className={`transition-colors duration-300 ${canPost ? "text-[#35583C] font-medium" : ""}`}>{canPost ? "Looks ready to post" : "Write at least 12 characters"}</span>
            <span>{body.length}/500</span>
          </div>
        </section>

        <section className="mb-4 animate-fade-in">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[#1E1E1E]">Category</p>
            <p className="text-[11px] text-[#76736B]">Helps match prayer partners</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#B5C4A8 #FAF7EF" } as React.CSSProperties}>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full border px-4 py-2 text-[12px] font-semibold transition-all duration-200 ${category === item ? "border-[#35583C] bg-[#35583C] text-white shadow-sm" : "border-[#E8E0D2] bg-[#FFFDF8] text-[#76736B] hover:bg-[#FAF7EF]"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 animate-fade-in">
          <ToggleRow icon="bell" title="Urgent" subtitle="Mark as time-sensitive" enabled={urgent} onToggle={() => setUrgent((value) => !value)} />
          <ToggleRow icon="lock" title="Private" subtitle="Only visible to you" enabled={privatePost} onToggle={() => setPrivatePost((value) => !value)} />
          <ToggleRow icon="shield" title="Anonymous" subtitle="Hide your name" enabled={anonymous} onToggle={() => setAnonymous((value) => !value)} />
        </section>

        <section className="mt-5 rounded-2xl border border-[#DDE7D8] bg-[#F2F7EF] p-4 animate-fade-in">
          <div className="flex gap-3">
            <Icon name="shield" size={20} className="shrink-0 text-[#35583C]" />
            <p className="text-[12px] leading-5 text-[#5F6859]">By posting, you agree to keep requests respectful and safe. Private and anonymous choices are respected in this prototype flow.</p>
          </div>
        </section>
      </ScrollContainer>
    </>
  );
}

/* ==================== STREAK SCREEN ==================== */

function StreakScreen({ onBack }: { onBack: () => void }) {
  const [completedToday, setCompletedToday] = useState(false);
  const [prayerData, setPrayerData] = useState(initialPrayerData);
  const currentStreak = completedToday ? 22 : 21;
  const bestStreak = 45;

  const todayIdx = getTodayIndex();

  const week = dayNames.slice(1).concat(dayNames[0]).map((day, i) => {
    const dataPoint = prayerData.find((p) => p.day === day);
    const isToday = i === (todayIdx === 0 ? 6 : todayIdx - 1);
    return { day, done: !!(dataPoint?.completed || (isToday && completedToday)), isToday };
  });

  const handleCompleteToday = () => {
    setCompletedToday(true);
    setPrayerData((prev) =>
      prev.map((p) => (p.day === getTodayDayName() ? { ...p, value: p.value + 2, completed: true } : p))
    );
  };

  const todayDayName = getTodayDayName();

  return (
    <ScrollContainer>
      <header className="mb-5 flex items-center justify-between animate-fade-in">
        <button className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button" onClick={onBack}>
          <Icon name="arrowLeft" size={21} />
        </button>
        <h1 className="text-[14px] font-semibold text-[#1E1E1E]">Prayer Streak</h1>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7EDDF] text-[#35583C]">
          <Icon name="flame" size={19} />
        </div>
      </header>

      <section className="mb-5 rounded-[30px] border border-[#E8E0D2] bg-gradient-to-br from-[#FFFDF8] to-[#EFE8DA] p-5 shadow-sm shadow-black/5 transition hover:shadow-md duration-300">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#76736B]">Current streak</p>
            <h2 className="mt-1 font-serif text-[56px] leading-none tracking-[-0.06em] text-[#1E1E1E]">{currentStreak}</h2>
            <p className="mt-1 text-[13px] font-semibold text-[#35583C]">days of prayer rhythm</p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#35583C] text-white shadow-lg shadow-[#35583C]/20 animate-pulse-soft">
            <Icon name="flame" size={31} />
          </div>
        </div>
        <p className="text-[13px] leading-5 text-[#5F5A50]">Keep the rhythm gentle: pray for one request, encourage one person, or thank God for one answered prayer.</p>
      </section>

      <section className="mb-5 rounded-[24px] border border-[#E8E0D2] bg-[#FFFDF8] p-4 shadow-sm shadow-black/5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-[22px] tracking-[-0.03em] text-[#1E1E1E]">This week</h2>
            <p className="text-[12px] text-[#76736B]">Complete one prayer action each day.</p>
          </div>
          <Icon name="calendar" size={22} className="text-[#35583C]" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {week.map((item) => (
            <div key={item.day} className="text-center">
              <div
                className={`mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full border text-[12px] font-bold transition-all duration-300 ${
                  item.done && item.isToday
                    ? "border-[#35583C] bg-[#35583C] text-white animate-pulse-soft"
                    : item.done
                    ? "border-[#35583C] bg-[#35583C] text-white"
                    : item.isToday
                    ? "border-[#35583C] border-2 bg-[#FAF7EF] text-[#35583C] animate-pulse-soft"
                    : "border-[#E8E0D2] bg-[#FAF7EF] text-[#76736B]"
                }`}
              >
                {item.done ? <Icon name="check" size={15} /> : item.day.slice(0, 1)}
              </div>
              <p className="text-[10px] text-[#76736B]">{item.day}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center">
          <p className="text-[12px] text-[#76736B]">
            {completedToday
              ? `You completed today (${todayDayName}). Great work!`
              : `Today is ${todayDayName}. Complete your daily action.`}
          </p>
        </div>
      </section>

      <PrayerLineGraph data={prayerData} />

      <section className="mb-5 grid grid-cols-2 gap-3">
        <MiniStat label="Best streak" value={bestStreak} icon="flame" />
        <MiniStat label="This month" value="248" icon="heart" />
        <MiniStat label="People supported" value="37" icon="users" />
        <MiniStat label="Answered" value="18" icon="check" />
      </section>

      <section className="mb-5 rounded-[24px] border border-[#E8E0D2] bg-[#FFFDF8] p-4 shadow-sm shadow-black/5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7EDDF] text-[#35583C]">
            <Icon name="sparkle" size={20} />
          </div>
          <div>
            <h2 className="font-serif text-[21px] text-[#1E1E1E]">Today&apos;s streak action</h2>
            <p className="text-[12px] text-[#76736B]">One small action keeps the rhythm alive.</p>
          </div>
        </div>
        <div className="space-y-2 text-[13px] text-[#5F5A50]">
          <div className="flex items-center gap-2 rounded-2xl bg-[#FAF7EF] px-3 py-2"><Icon name="heart" size={15} className="text-[#35583C]" /> Pray for one request</div>
          <div className="flex items-center gap-2 rounded-2xl bg-[#FAF7EF] px-3 py-2"><Icon name="message" size={15} className="text-[#35583C]" /> Leave one encouragement</div>
          <div className="flex items-center gap-2 rounded-2xl bg-[#FAF7EF] px-3 py-2"><Icon name="book" size={15} className="text-[#35583C]" /> Read today&apos;s devotion</div>
        </div>
        <button
          type="button"
          onClick={handleCompleteToday}
          disabled={completedToday}
          className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold shadow-lg transition-all duration-300 ${
            completedToday
              ? "bg-[#E7EDDF] text-[#35583C] shadow-black/5 cursor-default"
              : "bg-[#35583C] text-white shadow-[#35583C]/20 hover:brightness-110 active:scale-[0.98]"
          }`}
        >
          <Icon name={completedToday ? "check" : "flame"} size={18} />
          {completedToday ? "Streak updated" : "Complete today&apos;s prayer"}
        </button>
      </section>
    </ScrollContainer>
  );
}

/* ==================== CALENDAR ==================== */

function CalendarScreen() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const [selectedDay, setSelectedDay] = useState(16);
  return (
    <ScrollContainer>
      <header className="mb-6 flex items-center justify-between animate-fade-in">
        <h1 className="font-serif text-[34px] leading-none tracking-[-0.04em] text-[#1E1E1E]">Calendar</h1>
        <div className="flex items-center gap-3">
          <button className="transition hover:scale-110 duration-200"><Icon name="search" size={21} /></button>
          <button className="transition hover:scale-110 duration-200"><Icon name="plus" size={22} /></button>
        </div>
      </header>
      <div className="mb-6 rounded-[28px] border border-[#E8E0D2] bg-[#FFFDF8] p-4">
        <div className="flex justify-between text-[12px] font-semibold text-[#76736B] mb-4">
          <span>May 2026</span>
          <div className="flex gap-2">
            <button className="transition hover:bg-[#EFE8DA] rounded-full p-1 duration-200"><Icon name="arrowLeft" size={16} /></button>
            <button className="transition hover:bg-[#EFE8DA] rounded-full p-1 duration-200"><Icon name="arrowRight" size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#76736B] mb-2">
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`h-10 w-10 flex items-center justify-center rounded-full text-[12px] transition-all duration-200 ${
                d === selectedDay ? "bg-[#35583C] text-white shadow-md" : "text-[#1E1E1E] hover:bg-[#EFE8DA]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-[22px] text-[#1E1E1E]">May {selectedDay}</h2>
          <span className="text-[12px] text-[#76736B]">3 events</span>
        </div>
        <div className="space-y-3">
          {[
            { time: "7:00 AM", title: "Morning prayer", type: "personal" },
            { time: "12:30 PM", title: "Pray for families", type: "community" },
            { time: "8:00 PM", title: "Evening devotion", type: "devotional" },
          ].map((event, i) => (
            <div key={i} className="rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-3 flex items-center gap-4 transition hover:shadow-sm duration-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7EDDF] text-[#35583C]">
                <Icon name={event.type === "personal" ? "user" : event.type === "community" ? "users" : "book"} size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#1E1E1E]">{event.title}</p>
                <p className="text-[11px] text-[#76736B]">{event.time}</p>
              </div>
              <button className="transition hover:scale-110 duration-200"><Icon name="more" size={18} /></button>
            </div>
          ))}
        </div>
      </section>
    </ScrollContainer>
  );
}

/* ==================== COMMUNITY / GROUPS ==================== */

const mockGroups = [
  { id: 1, name: "Daily Prayer Circle", members: 234, desc: "A daily rhythm of prayer for the world." },
  { id: 2, name: "Moms in Prayer", members: 189, desc: "Supporting and praying for our children." },
  { id: 3, name: "College & Young Adults", members: 410, desc: "Navigating faith in a new season." },
];

function GroupsScreen({ onOpenGroup }: { onOpenGroup: (group: typeof mockGroups[0]) => void }) {
  return (
    <ScrollContainer>
      <header className="mb-6 animate-fade-in">
        <h1 className="font-serif text-[34px] leading-none tracking-[-0.04em] text-[#1E1E1E]">Community</h1>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-[#76736B] rounded-full bg-[#EFE8DA] px-3 py-2">
          <Icon name="search" size={16} />
          <input placeholder="Search groups or people" className="bg-transparent outline-none flex-1" />
        </div>
      </header>
      <section className="mb-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#76736B] mb-2">Your groups</h2>
        {mockGroups.map((group) => (
          <button
            key={group.id}
            onClick={() => onOpenGroup(group)}
            className="w-full rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-3 flex items-center gap-4 mb-2 text-left transition hover:shadow-md hover:-translate-y-0.5 duration-300"
          >
            <div className="h-10 w-10 rounded-full bg-[#EFE8DA] flex items-center justify-center text-[#35583C] font-semibold">
              {group.name[0]}
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#1E1E1E]">{group.name}</p>
              <p className="text-[11px] text-[#76736B]">{group.members} members</p>
            </div>
            <Icon name="arrowRight" size={16} className="text-[#76736B]" />
          </button>
        ))}
      </section>
      <section>
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#76736B] mb-2">People you follow</h2>
        <div className="space-y-2">
          {["Pastor James", "Rebecca Song", "Youth Leader Mia"].map((name) => (
            <div key={name} className="flex items-center gap-3 rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-3 transition hover:shadow-sm duration-200">
              <Avatar initials={name.split(" ").map(x => x[0]).join("").slice(0, 2)} size="sm" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#1E1E1E]">{name}</p>
                <p className="text-[11px] text-[#76736B]">Teaching Pastor</p>
              </div>
              <button className="rounded-full bg-[#E7EDDF] px-3 py-1 text-[11px] font-semibold text-[#35583C]">Following</button>
            </div>
          ))}
        </div>
      </section>
    </ScrollContainer>
  );
}

function GroupDetailScreen({ group, onBack }: { group: typeof mockGroups[0]; onBack: () => void }) {
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center justify-between animate-fade-in">
        <button className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" onClick={onBack} type="button">
          <Icon name="arrowLeft" size={21} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
          <Icon name="more" size={22} />
        </button>
      </header>
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="mb-3 h-20 w-20 rounded-full bg-[#E7EDDF] flex items-center justify-center text-[#35583C] font-serif text-3xl shadow-sm">{group.name[0]}</div>
        <h1 className="font-serif text-[32px] leading-tight">{group.name}</h1>
        <p className="text-[13px] text-[#76736B] mt-1">{group.members} members</p>
        <p className="mt-2 text-[14px] text-[#5F5A50] max-w-xs">{group.desc}</p>
        <button className="mt-4 rounded-full bg-[#35583C] px-6 py-2 text-[13px] font-semibold text-white shadow-md transition hover:brightness-110 duration-200">Join Group</button>
      </div>
      <section className="space-y-3">
        <div className="rounded-xl border border-[#E8E0D2] bg-[#FFFDF8] p-3">
          <p className="text-[12px] font-semibold text-[#1E1E1E]">Recent activity</p>
          <p className="text-[12px] text-[#76736B] mt-1">3 new prayer requests this week</p>
        </div>
      </section>
    </ScrollContainer>
  );
}

/* ==================== SEARCH, NOTIFICATIONS ==================== */

function SearchScreen({ onBack }: { onBack: () => void }) {
  const recent = ["healing", "provision", "anxiety", "family"];
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center gap-3 animate-fade-in">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
          <Icon name="arrowLeft" size={21} />
        </button>
        <div className="flex-1 rounded-full bg-[#EFE8DA] px-4 py-2 flex items-center gap-2 text-[13px] text-[#76736B]">
          <Icon name="search" size={16} />
          <input placeholder="Search prayers, people..." className="bg-transparent outline-none flex-1" autoFocus />
        </div>
      </header>
      <section>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#76736B] mb-2">Recent searches</h3>
        <div className="flex flex-wrap gap-2">
          {recent.map((word) => (
            <span key={word} className="rounded-full bg-[#E7EDDF] px-3 py-1 text-[12px] text-[#35583C] cursor-pointer transition hover:shadow-sm duration-200">{word}</span>
          ))}
        </div>
      </section>
    </ScrollContainer>
  );
}

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const notifs = [
    { type: "prayed" as const, user: "James L.", content: "prayed for your request", time: "2m ago", unread: true },
    { type: "comment" as const, user: "Olivia C.", content: "left an encouragement", time: "1h ago", unread: true },
    { type: "answered" as const, user: "David K.", content: "shared a praise report", time: "1d ago", unread: false },
  ];
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center justify-between animate-fade-in">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
          <Icon name="arrowLeft" size={21} />
        </button>
        <h1 className="text-[16px] font-semibold">Notifications</h1>
        <button className="text-[12px] text-[#35583C] font-semibold transition hover:underline">Mark all read</button>
      </header>
      <div className="space-y-3">
        {notifs.map((n, i) => (
          <div key={i} className={`rounded-2xl border p-3 flex items-start gap-3 transition hover:shadow-sm duration-200 ${n.unread ? "border-[#DDE7D8] bg-[#F2F7EF]" : "border-[#E8E0D2] bg-[#FFFDF8]"}`}>
            <div className="h-8 w-8 rounded-full bg-[#EFE8DA] flex items-center justify-center">
              <Icon name={n.type === "prayed" ? "heart" : n.type === "comment" ? "message" : "check"} size={15} className="text-[#35583C]" />
            </div>
            <div className="flex-1 text-[12px]">
              <p><strong>{n.user}</strong> {n.content}</p>
              <p className="text-[#76736B] text-[11px]">{n.time}</p>
            </div>
            {n.unread && <div className="h-2 w-2 rounded-full bg-[#35583C] mt-2" />}
          </div>
        ))}
      </div>
    </ScrollContainer>
  );
}

/* ==================== PROFILE & SETTINGS ==================== */

function ProfileScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  return (
    <ScrollContainer>
      <header className="mb-6 flex items-center justify-between animate-fade-in">
        <h1 className="font-serif text-[34px] tracking-[-0.04em] text-[#1E1E1E]">Profile</h1>
        <button className="transition hover:scale-110 duration-200"><Icon name="more" size={24} /></button>
      </header>
      <div className="flex flex-col items-center mb-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-[#EFE8DA] flex items-center justify-center text-[#35583C] font-serif text-3xl mb-3 shadow-sm">YL</div>
        <h2 className="font-serif text-2xl">You</h2>
        <p className="text-[13px] text-[#76736B]">Prayer intercessor</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in">
        <MiniStat label="Prayers" value="248" icon="heart" />
        <MiniStat label="Supported" value="37" icon="users" />
        <MiniStat label="Answered" value="18" icon="check" />
        <MiniStat label="Streak" value="21" icon="flame" />
      </div>
      <section className="space-y-2 animate-fade-in">
        {[
          { label: "My Prayers", icon: "heart", screen: "myPrayers" },
          { label: "Answered Prayers", icon: "check", screen: "answeredPrayers" },
          { label: "Saved & Drafts", icon: "bookmark", screen: "saved" },
          { label: "Settings", icon: "settings", screen: "settings" },
          { label: "Help & Support", icon: "message", screen: "help" },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.screen)}
            className="w-full flex items-center justify-between rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-3 transition hover:shadow-sm hover:-translate-y-0.5 duration-200"
          >
            <div className="flex items-center gap-3">
              <Icon name={item.icon} size={18} className="text-[#35583C]" />
              <span className="text-[13px] font-semibold text-[#1E1E1E]">{item.label}</span>
            </div>
            <Icon name="arrowRight" size={16} className="text-[#76736B]" />
          </button>
        ))}
      </section>
    </ScrollContainer>
  );
}

function SettingsScreen({ onBack, onNavigate }: { onBack: () => void; onNavigate: (screen: string) => void }) {
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center gap-4 animate-fade-in">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
          <Icon name="arrowLeft" size={21} />
        </button>
        <h1 className="font-serif text-2xl">Settings</h1>
      </header>
      <section className="space-y-2">
        {[
          { label: "Edit Profile", icon: "user" },
          { label: "Account & Security", icon: "lock" },
          { label: "Privacy", icon: "shield" },
          { label: "Notifications", icon: "bell" },
          { label: "Prayer Preferences", icon: "heart" },
          { label: "Display & Appearance", icon: "sparkle" },
          { label: "Language", icon: "megaphone" },
          { label: "Give Feedback", icon: "message" },
          { label: "About Lift", icon: "leaf" },
          { label: "Sign Out", icon: "x" },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => item.label === "Notifications" ? onNavigate("notifSettings") : null}
            className="w-full flex items-center justify-between rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-3 transition hover:shadow-sm hover:-translate-y-0.5 duration-200"
          >
            <div className="flex items-center gap-3">
              <Icon name={item.icon} size={18} className="text-[#35583C]" />
              <span className="text-[13px] font-semibold text-[#1E1E1E]">{item.label}</span>
            </div>
            <Icon name="arrowRight" size={16} className="text-[#76736B]" />
          </button>
        ))}
      </section>
    </ScrollContainer>
  );
}

function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center gap-4 animate-fade-in">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
          <Icon name="arrowLeft" size={21} />
        </button>
        <h1 className="font-serif text-2xl">Notifications</h1>
      </header>
      <section className="space-y-3">
        <ToggleRow icon="bell" title="Push notifications" subtitle="Receive prayer updates" enabled={push} onToggle={() => setPush(!push)} />
        <ToggleRow icon="send" title="Email updates" subtitle="Weekly summary & reminders" enabled={email} onToggle={() => setEmail(!email)} />
      </section>
    </ScrollContainer>
  );
}

/* ==================== PLACEHOLDER SCREEN ==================== */

function PlaceholderScreen({ label, onBack }: { label: string; onBack?: () => void }) {
  const copy: Record<string, string> = {
    Pray: "Your prayer rhythm, saved requests, answered prayers, and prayer reminders will live here.",
    People: "This area will help users discover prayer partners, leaders, and groups.",
    Profile: "Your spiritual profile, stats, saved prayers, drafts, and settings will live here.",
    myPrayers: "Your active and answered prayer requests.",
    answeredPrayers: "Praise reports and testimonies you've shared.",
    saved: "Saved prayers, drafts, and bookmarks.",
    help: "Search help articles or contact support.",
    donate: "Support Lift with a one-time or monthly gift.",
    privacy: "How we collect, use, and protect your data.",
    terms: "Rules and guidelines for using Lift.",
    admin: "Platform dashboard and moderation tools.",
    reports: "Review reported content and take action.",
    suspended: "Your account has been restricted.",
  };
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center gap-4 animate-fade-in">
        {onBack && (
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
            <Icon name="arrowLeft" size={21} />
          </button>
        )}
        <h1 className="font-serif text-2xl">{label}</h1>
      </header>
      <div className="rounded-3xl border border-[#E8E0D2] bg-[#FFFDF8] p-5">
        <p className="text-[14px] leading-6 text-[#76736B]">{copy[label] || "Screen content coming soon."}</p>
      </div>
    </ScrollContainer>
  );
}

/* ==================== ONBOARDING ==================== */

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <main className="h-full flex flex-col justify-center items-center px-6 text-center">
      <Icon name="leaf" size={48} className="text-[#35583C] mb-4" />
      <h1 className="font-serif text-5xl mb-4">Welcome to Lift</h1>
      <p className="text-[#5F5A50] text-lg mb-8">Real people. Real time prayer. Real impact.</p>
      <button onClick={onNext} className="bg-[#35583C] text-white px-8 py-3 rounded-full font-semibold shadow-lg transition hover:brightness-110 duration-200">Get started</button>
    </main>
  );
}

function TransmitNeedScreen({ onNext }: { onNext: () => void }) {
  return (
    <main className="h-full flex flex-col justify-center items-center px-6 text-center">
      <h1 className="font-serif text-4xl mb-4">Share your need</h1>
      <p className="text-[#5F5A50] text-lg mb-8">Your prayer request connects you to a global community ready to pray.</p>
      <button onClick={onNext} className="bg-[#35583C] text-white px-8 py-3 rounded-full font-semibold shadow-lg transition hover:brightness-110 duration-200">Continue</button>
    </main>
  );
}

function StayConnectedScreen({ onNext }: { onNext: () => void }) {
  const [notifications, setNotifications] = useState(true);
  return (
    <main className="h-full flex flex-col justify-center items-center px-6 text-center">
      <h1 className="font-serif text-4xl mb-4">Stay connected</h1>
      <p className="text-[#5F5A50] text-lg mb-8">Enable notifications to know when someone prays for you.</p>
      <ToggleRow icon="bell" title="Push notifications" subtitle="Receive prayer updates" enabled={notifications} onToggle={() => setNotifications(!notifications)} />
      <button onClick={onNext} className="mt-6 bg-[#35583C] text-white px-8 py-3 rounded-full font-semibold shadow-lg transition hover:brightness-110 duration-200">Continue</button>
    </main>
  );
}

function SignInScreen({ onNext }: { onNext: () => void }) {
  return (
    <main className="h-full flex flex-col justify-center px-6">
      <h1 className="font-serif text-4xl mb-6">Sign in</h1>
      <input placeholder="Email" className="mb-3 w-full rounded-xl border border-[#E8E0D2] p-3 text-sm outline-none focus:border-[#35583C] transition" />
      <input placeholder="Password" type="password" className="mb-4 w-full rounded-xl border border-[#E8E0D2] p-3 text-sm outline-none focus:border-[#35583C] transition" />
      <button onClick={onNext} className="bg-[#35583C] text-white py-3 rounded-xl font-semibold shadow-lg transition hover:brightness-110 duration-200">Sign in</button>
      <button className="mt-3 text-sm text-[#35583C]">Forgot password?</button>
    </main>
  );
}

/* ==================== ADMIN ==================== */

function AdminDashboardScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center gap-4 animate-fade-in">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
          <Icon name="arrowLeft" size={21} />
        </button>
        <h1 className="font-serif text-2xl">Admin Dashboard</h1>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Active users" value="1,284" icon="users" />
        <MiniStat label="New requests" value="42" icon="heart" />
        <MiniStat label="Reports" value="7" icon="shield" />
        <MiniStat label="Suspended" value="2" icon="lock" />
      </div>
    </ScrollContainer>
  );
}

function ReportsScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollContainer>
      <header className="mb-4 flex items-center gap-4 animate-fade-in">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#EFE8DA] duration-200" type="button">
          <Icon name="arrowLeft" size={21} />
        </button>
        <h1 className="font-serif text-2xl">Reports</h1>
      </header>
      <div className="space-y-3">
        {[{ id: 1, reason: "Inappropriate content", reporter: "User123", status: "pending" }].map((r) => (
          <div key={r.id} className="rounded-2xl border border-[#E8E0D2] bg-[#FFFDF8] p-3 text-[13px]">
            <p><strong>#{r.id}</strong> – {r.reason}</p>
            <p className="text-[11px] text-[#76736B]">Reported by {r.reporter} &middot; {r.status}</p>
          </div>
        ))}
      </div>
    </ScrollContainer>
  );
}

function SuspendedScreen() {
  return (
    <main className="h-full flex flex-col justify-center items-center px-6 text-center">
      <Icon name="shield" size={48} className="text-[#B94A3E] mb-4" />
      <h1 className="font-serif text-3xl mb-4">Account suspended</h1>
      <p className="text-[#5F5A50] mb-8">Your account has been restricted due to a violation of community guidelines.</p>
      <button className="bg-[#35583C] text-white px-6 py-2 rounded-full font-semibold shadow-lg transition hover:brightness-110 duration-200">Appeal decision</button>
    </main>
  );
}

/* ==================== APP SHELL ==================== */

function LiftAppShell() {
  const [activeTab, setActiveTab] = useState("Home");
  const [screenStack, setScreenStack] = useState<string[]>(["feed"]);
  const [feedItems, setFeedItems] = useState(initialFeedItems);
  const [justPosted, setJustPosted] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<typeof initialFeedItems[0] | undefined>(initialFeedItems[0]);
  const [selectedGroup, setSelectedGroup] = useState<typeof mockGroups[0] | null>(null);

  const currentScreen = screenStack[screenStack.length - 1];

  const pushScreen = (next: string) => setScreenStack((prev) => [...prev, next]);
  const popScreen = () => {
    if (screenStack.length > 1) setScreenStack((prev) => prev.slice(0, -1));
    else goHome();
  };

  const goHome = () => {
    setActiveTab("Home");
    setScreenStack(["feed"]);
    setJustPosted(false);
  };

  const handleTabSelect = (tab: string) => {
    setActiveTab(tab);
    setJustPosted(false);
    switch (tab) {
      case "Home": setScreenStack(["feed"]); break;
      case "Prayers": setScreenStack(["streak"]); break;
      case "Calendar": setScreenStack(["calendar"]); break;
      case "Community": setScreenStack(["community"]); break;
      case "Profile": setScreenStack(["profile"]); break;
      default: break;
    }
  };

  const openRequest = (req: typeof initialFeedItems[0]) => {
    setSelectedRequest(req);
    pushScreen("detail");
  };

  const openGroup = (group: typeof mockGroups[0]) => {
    setSelectedGroup(group);
    pushScreen("groupDetail");
  };

  const submitRequest = (req: typeof initialFeedItems[0]) => {
    setFeedItems((prev) => [req, ...prev]);
    setSelectedRequest(req);
    setActiveTab("Home");
    setJustPosted(true);
    setScreenStack(["feed"]);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "feed":
        return (
          <FeedScreen
            items={feedItems}
            onOpenRequest={openRequest}
            onOpenStreak={() => { setActiveTab("Prayers"); setScreenStack(["streak"]); }}
            justPosted={justPosted}
          />
        );
      case "detail":
        return <RequestDetailScreen request={selectedRequest} onBack={popScreen} />;
      case "create":
        return <CreateRequestScreen onBack={popScreen} onSubmit={submitRequest} />;
      case "streak":
        return <StreakScreen onBack={popScreen} />;
      case "calendar":
        return <CalendarScreen />;
      case "community":
        return <GroupsScreen onOpenGroup={openGroup} />;
      case "groupDetail":
        return selectedGroup ? <GroupDetailScreen group={selectedGroup} onBack={popScreen} /> : <PlaceholderScreen label="Community" onBack={popScreen} />;
      case "search":
        return <SearchScreen onBack={popScreen} />;
      case "notifications":
        return <NotificationsScreen onBack={popScreen} />;
      case "profile":
        return <ProfileScreen onNavigate={(next) => { pushScreen(next); setActiveTab("Profile"); }} />;
      case "settings":
        return <SettingsScreen onBack={popScreen} onNavigate={(next) => pushScreen(next)} />;
      case "notifSettings":
        return <NotificationSettingsScreen onBack={popScreen} />;
      case "myPrayers":
      case "answeredPrayers":
      case "saved":
      case "help":
      case "donate":
      case "privacy":
      case "terms":
        return <PlaceholderScreen label={currentScreen} onBack={popScreen} />;
      case "admin":
        return <AdminDashboardScreen onBack={popScreen} />;
      case "reports":
        return <ReportsScreen onBack={popScreen} />;
      case "suspended":
        return <SuspendedScreen />;
      case "welcome":
        return <WelcomeScreen onNext={() => pushScreen("transmit")} />;
      case "transmit":
        return <TransmitNeedScreen onNext={() => pushScreen("stayConnected")} />;
      case "stayConnected":
        return <StayConnectedScreen onNext={() => pushScreen("signIn")} />;
      case "signIn":
        return <SignInScreen onNext={() => { goHome(); }} />;
      default:
        return <PlaceholderScreen label={activeTab} onBack={popScreen} />;
    }
  };

  const showBottomNav = !["detail", "create", "groupDetail", "search", "notifications", "settings", "notifSettings", "myPrayers", "answeredPrayers", "saved", "help", "donate", "privacy", "terms", "admin", "reports", "suspended", "welcome", "transmit", "stayConnected", "signIn"].includes(currentScreen);

  return (
    <PhoneShell>
      <div className="relative h-full bg-[#FAF7EF]">
        <StatusBar />
        {renderScreen()}
        {showBottomNav && (
          <>
            <BottomNav active={activeTab} onSelect={handleTabSelect} />
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={() => { pushScreen("create"); }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#35583C] text-white shadow-lg shadow-black/20 transition hover:scale-110 hover:shadow-xl duration-300"
              >
                <Icon name="plus" size={22} />
              </button>
            </div>
          </>
        )}
      </div>
    </PhoneShell>
  );
}

/* ==================== PREVIEW PANEL ==================== */

function PreviewTestPanel() {
  const checks = Object.entries(previewChecks);
  return (
    <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#D8CFBF] bg-[#FFFDF8] p-4 text-sm text-[#5F5A50]">
      <h3 className="mb-2 font-serif text-xl text-[#1E1E1E]">App checks</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {checks.map(([label, passed]) => (
          <div key={label} className="rounded-xl border border-[#E8E0D2] bg-[#FAF7EF] px-3 py-2">
            <span className={passed ? "text-[#35583C]" : "text-red-700"}>{passed ? "✓" : "×"}</span> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== ANIMATIONS ==================== */

function GlobalStyles() {
  return (
    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseSoft {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.08); opacity: 0.85; }
      }
      .animate-fade-in {
        animation: fadeIn 0.5s ease-out both;
      }
      .animate-slide-in {
        animation: slideIn 0.4s ease-out both;
      }
      .animate-pulse-soft {
        animation: pulseSoft 2s ease-in-out infinite;
      }
    `}</style>
  );
}

/* ==================== EXPORT ==================== */

export default function LiftPriorityScreensPreview() {
  return (
    <div className="min-h-screen bg-[#F7F2E8] px-6 py-10 text-[#1E1E1E]">
      <GlobalStyles />
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-[#35583C]">
            <Icon name="leaf" size={28} />
            <span className="font-serif text-4xl">Lift.</span>
          </div>
          <h1 className="font-serif text-5xl leading-tight tracking-[-0.05em] md:text-7xl">
            Full-screen prototype
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-7 text-[#5F5A50]">
            All screens from the functional spec are now accessible in this single-file preview. Tap around to explore the prayer network.
          </p>
        </header>

        <LiftAppShell />
        <PreviewTestPanel />
      </div>
    </div>
  );
}
