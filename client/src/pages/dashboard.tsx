import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Logo } from "@/components/pts/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNps, formatSeconds, formatMorale, moraleTone } from "@/lib/format";
import type { BranchStats, Settings } from "@shared/schema";
import { Trophy, Gauge, Timer, Users, Send, Lock, Heart } from "lucide-react";

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

export default function Dashboard() {
  const dashboardQuery = useQuery<BranchStats[]>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => (await apiRequest("GET", "/api/dashboard")).json(),
    refetchInterval: 3000,
  });

  const settingsQuery = useQuery<Settings>({
    queryKey: ["/api/settings"],
    queryFn: async () => (await apiRequest("GET", "/api/settings")).json(),
    refetchInterval: 3000,
  });

  const revealed = settingsQuery.data?.leaderboardRevealed ?? false;
  const stats = dashboardQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[hsl(218_32%_11%)] text-[hsl(48_24%_96%)] flex flex-col">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center gap-3">
          <Logo className="h-9 w-9 text-[hsl(20_67%_55%)]" />
          <div>
            <div className="text-lg font-semibold tracking-tight">Passionate to Serve</div>
            <div className="text-sm text-[hsl(211_29%_69%)]">Service Under Pressure — live leaderboard</div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-10">
        {!revealed ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-4" data-testid="section-standby">
            <Lock className="h-10 w-10 text-[hsl(211_29%_69%)]" />
            <h1 className="text-2xl font-semibold">Leaderboard on standby</h1>
            <p className="text-[hsl(211_29%_69%)] max-w-md">
              Scores are being tracked live at every branch station. The facilitator will reveal the leaderboard partway through the round.
            </p>
          </div>
        ) : (
          <div data-testid="section-leaderboard">
            <div className="flex items-center gap-2 mb-8">
              <Trophy className="h-5 w-5 text-[hsl(20_67%_55%)]" />
              <h1 className="text-2xl font-semibold tracking-tight">Live leaderboard</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mb-10">
              {stats.map((s, idx) => (
                <Card
                  key={s.branch}
                  className="bg-[hsl(218_20%_16%)] border-[hsl(218_20%_22%)] text-[hsl(48_24%_96%)] relative overflow-hidden"
                  data-testid={`card-leaderboard-${s.branch}`}
                >
                  {idx === 0 && (
                    <div className="absolute top-0 right-0 h-16 w-16 bg-[hsl(20_67%_50%)]/20 rounded-bl-full" />
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm text-[hsl(211_29%_69%)]">
                        <span className="text-lg leading-none">{RANK_MEDAL[idx] ?? `#${idx + 1}`}</span>
                        {s.name}
                      </div>
                    </div>
                    <div className="text-4xl font-bold tabular-nums mb-1" data-testid={`text-score-${s.branch}`}>
                      {s.score.toFixed(1)}
                    </div>
                    <div className="text-xs text-[hsl(211_29%_69%)] mb-4">Service Score</div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <MiniStat icon={<Gauge className="h-3.5 w-3.5" />} label="Avg NPS" value={formatNps(s.avgNps)} />
                      <MiniStat icon={<Timer className="h-3.5 w-3.5" />} label="Avg time" value={formatSeconds(s.avgResolutionSeconds)} />
                      <MiniStat icon={<Users className="h-3.5 w-3.5" />} label="Served" value={String(s.interactionsCompleted)} />
                      <MiniStat icon={<Send className="h-3.5 w-3.5" />} label="Slips resolved" value={`${s.slipsResolved}/${s.slipsSent}`} />
                      <MiniStat
                        icon={<Heart className="h-3.5 w-3.5" />}
                        label="Morale"
                        value={formatMorale(s.morale)}
                        tone={moraleTone(s.morale)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-[hsl(218_20%_16%)] border-[hsl(218_20%_22%)] text-[hsl(48_24%_96%)]">
              <CardContent className="p-5">
                <div className="text-sm font-medium mb-3 text-[hsl(211_29%_69%)]">How the Service Score is calculated</div>
                <div className="grid sm:grid-cols-5 gap-4 text-xs">
                  <ScoreLegend label="NPS" desc="avg NPS × 5" max="50 pts" />
                  <ScoreLegend label="Throughput" desc="customers served × 2 (capped at 10)" max="20 pts" />
                  <ScoreLegend label="Speed" desc="faster average resolution" max="20 pts" />
                  <ScoreLegend label="Collaboration" desc="slips resolved × 2 (capped at 5)" max="10 pts" />
                  <ScoreLegend label="Morale" desc="slip treatment + interaction outcomes" max="20 pts" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

const MORALE_TONE_COLOR: Record<string, string> = {
  positive: "hsl(140_45%_55%)",
  negative: "hsl(350_60%_60%)",
  neutral: "hsl(20_67%_55%)",
};

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: tone ? MORALE_TONE_COLOR[tone] : "hsl(20_67%_55%)" }}>{icon}</span>
      <div>
        <div
          className="font-semibold tabular-nums leading-tight"
          style={tone ? { color: MORALE_TONE_COLOR[tone] } : undefined}
        >
          {value}
        </div>
        <div className="text-[10px] text-[hsl(211_29%_69%)] leading-tight">{label}</div>
      </div>
    </div>
  );
}

function ScoreLegend({ label, desc, max }: { label: string; desc: string; max: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="font-medium text-[hsl(48_24%_96%)]">{label}</span>
        <Badge variant="outline" className="border-white/20 text-[hsl(211_29%_69%)]">
          {max}
        </Badge>
      </div>
      <div className="text-[hsl(211_29%_69%)]">{desc}</div>
    </div>
  );
}
