import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageShell } from "@/components/pts/PageShell";
import { PinGate } from "@/components/pts/PinGate";
import { BRANCH_PINS } from "@/lib/access-codes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  formatElapsed,
  formatNps,
  formatSeconds,
  BRANCH_LABEL,
  DESK_LABEL,
  OUTCOME_LABEL,
  INTERACTION_TYPE_LABEL,
} from "@/lib/format";
import type { Interaction, Slip, BranchId, BranchStats, Announcement } from "@shared/schema";
import { formatMorale, moraleTone, MORALE_COLOR_CLASS, TONE_BADGE_CLASS } from "@/lib/format";
import { PhoneCall, Send, Timer, CheckCircle2, Users, Gauge, Heart, Megaphone } from "lucide-react";

const ROUTES_TO: Record<string, string> = { a: "b", b: "c", c: "a" };
const VALID_BRANCHES = ["a", "b", "c"];

function useNow(tickMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

export default function BranchStation() {
  const params = useParams<{ id: string }>();
  const branch = params.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = useNow();

  const validBranch = VALID_BRANCHES.includes(branch);

  const interactionsQuery = useQuery<Interaction[]>({
    queryKey: ["/api/interactions", `?branch=${branch}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/interactions?branch=${branch}`);
      return res.json();
    },
    enabled: validBranch,
    refetchInterval: 4000,
  });

  const slipsQuery = useQuery<Slip[]>({
    queryKey: ["/api/slips", `?branch=${branch}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/slips?branch=${branch}`);
      return res.json();
    },
    enabled: validBranch,
    refetchInterval: 4000,
  });

  const startInteraction = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/interactions", { branch });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/interactions"] });
    },
    onError: () => toast({ title: "Couldn't start interaction", variant: "destructive" }),
  });

  const startSlip = useMutation({
    mutationFn: async (deskType: string) => {
      const res = await apiRequest("POST", "/api/slips", { branch, deskType });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/slips"] });
    },
    onError: () => toast({ title: "Couldn't send slip", variant: "destructive" }),
  });

  const completeInteraction = useMutation({
    mutationFn: async (vars: { id: number; outcome: string; npsScore: number; interactionType: string }) => {
      const res = await apiRequest("PATCH", `/api/interactions/${vars.id}/complete`, {
        outcome: vars.outcome,
        npsScore: vars.npsScore,
        interactionType: vars.interactionType,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/interactions"] });
      toast({ title: "Interaction logged" });
    },
    onError: () => toast({ title: "Couldn't log interaction", variant: "destructive" }),
  });

  const completeSlip = useMutation({
    mutationFn: async (vars: { id: number; outcome: string }) => {
      const res = await apiRequest("PATCH", `/api/slips/${vars.id}/complete`, { outcome: vars.outcome });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/slips"] });
      toast({ title: "Slip resolved" });
    },
    onError: () => toast({ title: "Couldn't resolve slip", variant: "destructive" }),
  });

  const [logging, setLogging] = useState<Interaction | null>(null);
  const [resolving, setResolving] = useState<Slip | null>(null);

  const dashboardQuery = useQuery<BranchStats[]>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard");
      return res.json();
    },
    enabled: validBranch,
    refetchInterval: 5000,
  });
  const myStats = dashboardQuery.data?.find((b) => b.branch === branch);
  const morale = myStats?.morale ?? 50;

  const announcementsQuery = useQuery<Announcement[]>({
    queryKey: ["/api/announcements", branch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/announcements?branch=${branch}`);
      return res.json();
    },
    enabled: validBranch,
    refetchInterval: 4000,
  });
  const announcements = announcementsQuery.data ?? [];
  const seenAnnouncementIds = useState(() => new Set<number>())[0];
  const hasLoadedAnnouncementsOnce = useState({ done: false })[0];
  useEffect(() => {
    if (!announcementsQuery.isSuccess) return;
    if (!hasLoadedAnnouncementsOnce.done) {
      hasLoadedAnnouncementsOnce.done = true;
      for (const a of announcements) seenAnnouncementIds.add(a.id);
      return;
    }
    for (const a of announcements) {
      if (!seenAnnouncementIds.has(a.id)) {
        seenAnnouncementIds.add(a.id);
        toast({
          title: a.source === "facilitator" ? "Facilitator announcement" : "Update",
          description: a.message,
          variant: a.tone === "negative" ? "destructive" : "default",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementsQuery.isSuccess, announcements.map((a) => a.id).join(",")]);

  if (!validBranch) {
    return (
      <PageShell title="Unknown branch">
        <p className="text-sm text-muted-foreground">This branch station doesn't exist. Go back home and pick a valid branch.</p>
      </PageShell>
    );
  }

  const interactions = interactionsQuery.data ?? [];
  const slips = slipsQuery.data ?? [];
  const activeInteractions = interactions.filter((i) => i.status === "active");
  const completedInteractions = interactions.filter((i) => i.status === "completed");
  const activeSlips = slips.filter((s) => s.status === "active");
  const completedSlips = slips.filter((s) => s.status === "completed");

  const avgNps = completedInteractions.length
    ? completedInteractions.reduce((sum, i) => sum + (i.npsScore ?? 0), 0) / completedInteractions.length
    : null;
  const avgResolution = completedInteractions.length
    ? completedInteractions.reduce((sum, i) => sum + (i.resolutionSeconds ?? 0), 0) / completedInteractions.length
    : null;

  const targetBranch = ROUTES_TO[branch];

  return (
    <PinGate
      storageKey={`pts-unlocked-branch-${branch}`}
      pin={BRANCH_PINS[branch as "a" | "b" | "c"]}
      label={`${BRANCH_LABEL[branch]} station`}
      description="Enter this table's code to open the branch station."
    >
    <PageShell
      title={`${BRANCH_LABEL[branch]} station`}
      subtitle={`Shared laptop for the scorekeeper and Customer. Slips route to ${BRANCH_LABEL[targetBranch]}'s desks.`}
      wide
    >
      {/* Local stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard icon={<Users className="h-4 w-4" />} label="Customers served" value={String(completedInteractions.length)} testid="stat-served" />
        <StatCard icon={<Gauge className="h-4 w-4" />} label="Avg NPS" value={formatNps(avgNps)} testid="stat-nps" />
        <StatCard icon={<Timer className="h-4 w-4" />} label="Avg resolution" value={formatSeconds(avgResolution)} testid="stat-resolution" />
        <StatCard icon={<Send className="h-4 w-4" />} label="Slips sent" value={String(slips.length)} testid="stat-slips" />
        <StatCard
          icon={<Heart className="h-4 w-4" />}
          label="Morale"
          value={formatMorale(morale)}
          testid="stat-morale"
          valueClassName={MORALE_COLOR_CLASS[moraleTone(morale)]}
        />
      </div>

      {announcements.length > 0 && (
        <Card className="mb-6" data-testid="card-announcements">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <Megaphone className="h-4 w-4" />
              <CardTitle className="text-base">Announcements</CardTitle>
            </div>
            <CardDescription>What's happening across the room right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {announcements.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className={
                    "flex items-start justify-between gap-3 text-xs px-3 py-2 rounded-md border " +
                    TONE_BADGE_CLASS[a.tone]
                  }
                  data-testid={`row-announcement-${a.id}`}
                >
                  <span>{a.message}</span>
                  {a.source === "facilitator" && (
                    <Badge variant="outline" className="shrink-0">
                      Facilitator
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Interaction column */}
        <Card data-testid="card-interaction-panel">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <PhoneCall className="h-4 w-4" />
              <CardTitle className="text-base">Customer interaction</CardTitle>
            </div>
            <CardDescription>Start when the Customer sits down. Stop when the conversation ends and log the outcome.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => startInteraction.mutate()}
              disabled={startInteraction.isPending}
              data-testid="button-start-interaction"
            >
              <Timer className="h-4 w-4" />
              Start interaction
            </Button>

            {activeInteractions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No interaction in progress.</p>
            )}

            <div className="space-y-2">
              {activeInteractions.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-card-border bg-accent/40 px-3 py-2.5"
                  data-testid={`row-active-interaction-${i.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-sm font-mono tabular-nums" data-testid={`text-elapsed-${i.id}`}>
                      {formatElapsed(i.startedAt, now)}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => setLogging(i)} data-testid={`button-stop-log-${i.id}`}>
                    Stop &amp; log
                  </Button>
                </div>
              ))}
            </div>

            {completedInteractions.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">Recent</div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {completedInteractions.slice(0, 8).map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-muted/60"
                      data-testid={`row-completed-interaction-${i.id}`}
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        {INTERACTION_TYPE_LABEL[i.interactionType]}
                      </span>
                      <span className="flex items-center gap-3 tabular-nums">
                        <Badge variant={i.outcome === "resolved" ? "default" : i.outcome === "escalated" ? "secondary" : "destructive"}>
                          {OUTCOME_LABEL[i.outcome ?? ""] ?? i.outcome}
                        </Badge>
                        <span>NPS {i.npsScore}</span>
                        <span>{formatSeconds(i.resolutionSeconds)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slip column */}
        <Card data-testid="card-slip-panel">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Send className="h-4 w-4" />
              <CardTitle className="text-base">Cross-branch slip</CardTitle>
            </div>
            <CardDescription>
              Send a runner to {BRANCH_LABEL[targetBranch]}'s desks. Mark it resolved when the runner returns with an answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => startSlip.mutate("policy_risk")}
                disabled={startSlip.isPending}
                data-testid="button-send-slip-policy-risk"
              >
                <Send className="h-4 w-4" />
                Policy / Risk
              </Button>
              <Button
                variant="secondary"
                onClick={() => startSlip.mutate("back_office")}
                disabled={startSlip.isPending}
                data-testid="button-send-slip-back-office"
              >
                <Send className="h-4 w-4" />
                Back-office
              </Button>
            </div>

            {activeSlips.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No slip in transit.</p>
            )}

            <div className="space-y-2">
              {activeSlips.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-card-border bg-accent/40 px-3 py-2.5"
                  data-testid={`row-active-slip-${s.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-xs">
                      {DESK_LABEL[s.deskType]} @ {BRANCH_LABEL[s.targetBranch]}
                    </span>
                    <span className="text-sm font-mono tabular-nums" data-testid={`text-slip-elapsed-${s.id}`}>
                      {formatElapsed(s.startedAt, now)}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => setResolving(s)} data-testid={`button-resolve-slip-${s.id}`}>
                    Mark resolved
                  </Button>
                </div>
              ))}
            </div>

            {completedSlips.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">Recent</div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {completedSlips.slice(0, 8).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-muted/60"
                      data-testid={`row-completed-slip-${s.id}`}
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        {DESK_LABEL[s.deskType]} @ {BRANCH_LABEL[s.targetBranch]}
                      </span>
                      <span className="flex items-center gap-3 tabular-nums">
                        <Badge variant={s.outcome === "approved" ? "default" : "destructive"}>
                          {OUTCOME_LABEL[s.outcome ?? ""] ?? s.outcome}
                        </Badge>
                        <span>{formatSeconds(s.resolutionSeconds)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LogInteractionDialog
        interaction={logging}
        onClose={() => setLogging(null)}
        onSubmit={(outcome, npsScore, interactionType) => {
          if (!logging) return;
          completeInteraction.mutate({ id: logging.id, outcome, npsScore, interactionType });
          setLogging(null);
        }}
      />

      <ResolveSlipDialog
        slip={resolving}
        onClose={() => setResolving(null)}
        onSubmit={(outcome) => {
          if (!resolving) return;
          completeSlip.mutate({ id: resolving.id, outcome });
          setResolving(null);
        }}
      />
    </PageShell>
    </PinGate>
  );
}

function StatCard({
  icon,
  label,
  value,
  testid,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testid: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
          {icon}
          {label}
        </div>
        <div className={"text-xl font-semibold tabular-nums " + (valueClassName ?? "")} data-testid={testid}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function LogInteractionDialog({
  interaction,
  onClose,
  onSubmit,
}: {
  interaction: Interaction | null;
  onClose: () => void;
  onSubmit: (outcome: string, npsScore: number, interactionType: string) => void;
}) {
  const [outcome, setOutcome] = useState("resolved");
  const [nps, setNps] = useState<number | null>(null);
  const [type, setType] = useState("dilemma");

  useEffect(() => {
    if (interaction) {
      setOutcome("resolved");
      setNps(null);
      setType("dilemma");
    }
  }, [interaction]);

  return (
    <Dialog open={!!interaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-log-interaction">
        <DialogHeader>
          <DialogTitle>Log this interaction</DialogTitle>
          <DialogDescription>The Customer taps in their own NPS score.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block">What kind of request was it?</Label>
            <RadioGroup value={type} onValueChange={setType} className="flex flex-wrap gap-3">
              {["dilemma", "quick_ask", "other"].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <RadioGroupItem value={t} id={`type-${t}`} data-testid={`radio-type-${t}`} />
                  <Label htmlFor={`type-${t}`} className="text-sm font-normal">
                    {INTERACTION_TYPE_LABEL[t]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Outcome</Label>
            <RadioGroup value={outcome} onValueChange={setOutcome} className="flex flex-wrap gap-3">
              {["resolved", "escalated", "promise_broken"].map((o) => (
                <div key={o} className="flex items-center gap-1.5">
                  <RadioGroupItem value={o} id={`outcome-${o}`} data-testid={`radio-outcome-${o}`} />
                  <Label htmlFor={`outcome-${o}`} className="text-sm font-normal">
                    {OUTCOME_LABEL[o]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Customer's NPS (tap one, 0–10)</Label>
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNps(n)}
                  data-testid={`button-nps-${n}`}
                  className={
                    "min-h-9 rounded-md border text-sm font-medium tabular-nums hover-elevate active-elevate-2 " +
                    (nps === n
                      ? "bg-primary text-primary-foreground border-primary-border"
                      : "bg-card text-card-foreground border-card-border")
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            disabled={nps == null}
            onClick={() => nps != null && onSubmit(outcome, nps, type)}
            data-testid="button-submit-interaction"
          >
            Log interaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveSlipDialog({
  slip,
  onClose,
  onSubmit,
}: {
  slip: Slip | null;
  onClose: () => void;
  onSubmit: (outcome: string) => void;
}) {
  const [outcome, setOutcome] = useState("approved");

  useEffect(() => {
    if (slip) setOutcome("approved");
  }, [slip]);

  return (
    <Dialog open={!!slip} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-resolve-slip">
        <DialogHeader>
          <DialogTitle>Mark slip resolved</DialogTitle>
          <DialogDescription>What did the receiving desk decide?</DialogDescription>
        </DialogHeader>

        <RadioGroup value={outcome} onValueChange={setOutcome} className="flex gap-4">
          {["approved", "declined"].map((o) => (
            <div key={o} className="flex items-center gap-1.5">
              <RadioGroupItem value={o} id={`slip-outcome-${o}`} data-testid={`radio-slip-outcome-${o}`} />
              <Label htmlFor={`slip-outcome-${o}`} className="text-sm font-normal">
                {OUTCOME_LABEL[o]}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button className="w-full" onClick={() => onSubmit(outcome)} data-testid="button-submit-slip">
            Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
