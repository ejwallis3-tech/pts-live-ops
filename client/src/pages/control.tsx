import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageShell } from "@/components/pts/PageShell";
import { PinGate } from "@/components/pts/PinGate";
import { BRANCH_PINS, FACILITATOR_PIN } from "@/lib/access-codes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatElapsed,
  formatSeconds,
  BRANCH_LABEL,
  DESK_LABEL,
  OUTCOME_LABEL,
  INTERACTION_TYPE_LABEL,
  TONE_BADGE_CLASS,
} from "@/lib/format";
import type { Settings, Interaction, Slip, CardState, Announcement, ExternalEventState } from "@shared/schema";
import { Play, Square, Trash2, Eye, EyeOff, Radio, IdCard, Megaphone, Send, Zap } from "lucide-react";

function useNow(tickMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

type FeedItem =
  | (Interaction & { kind: "interaction" })
  | (Slip & { kind: "slip" });

export default function Control() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = useNow();

  const settingsQuery = useQuery<Settings>({
    queryKey: ["/api/settings"],
    queryFn: async () => (await apiRequest("GET", "/api/settings")).json(),
    refetchInterval: 3000,
  });

  const interactionsQuery = useQuery<Interaction[]>({
    queryKey: ["/api/interactions"],
    queryFn: async () => (await apiRequest("GET", "/api/interactions")).json(),
    refetchInterval: 4000,
  });

  const slipsQuery = useQuery<Slip[]>({
    queryKey: ["/api/slips"],
    queryFn: async () => (await apiRequest("GET", "/api/slips")).json(),
    refetchInterval: 4000,
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<Settings>) => (await apiRequest("PATCH", "/api/settings", patch)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/settings"] }),
    onError: () => toast({ title: "Couldn't update settings", variant: "destructive" }),
  });

  const resetAll = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/reset", {})).json(),
    onSuccess: () => {
      qc.invalidateQueries();
      toast({ title: "All data reset" });
    },
    onError: () => toast({ title: "Couldn't reset data", variant: "destructive" }),
  });

  const cardsQuery = useQuery<CardState[]>({
    queryKey: ["/api/cards"],
    queryFn: async () => (await apiRequest("GET", "/api/cards")).json(),
    refetchInterval: 3000,
  });

  const deliverCard = useMutation({
    mutationFn: async (cardId: string) => (await apiRequest("POST", `/api/cards/${cardId}/deliver`, {})).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cards"] }),
    onError: () => toast({ title: "Couldn't mark card delivered", variant: "destructive" }),
  });

  const announcementsQuery = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    queryFn: async () => (await apiRequest("GET", "/api/announcements")).json(),
    refetchInterval: 4000,
  });

  const externalEventsQuery = useQuery<ExternalEventState[]>({
    queryKey: ["/api/external-events"],
    queryFn: async () => (await apiRequest("GET", "/api/external-events")).json(),
    refetchInterval: 3000,
  });

  const triggerEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest("POST", `/api/external-events/${eventId}/trigger`, {});
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Couldn't trigger event");
      return res.json();
    },
    onSuccess: (_data, eventId) => {
      qc.invalidateQueries({ queryKey: ["/api/external-events"] });
      qc.invalidateQueries({ queryKey: ["/api/announcements"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      const ev = (externalEventsQuery.data ?? []).find((e) => e.id === eventId);
      toast({ title: ev ? `Triggered: ${ev.title}` : "Event triggered" });
    },
    onError: (err) => toast({ title: err instanceof Error ? err.message : "Couldn't trigger event", variant: "destructive" }),
  });

  const [announceBranch, setAnnounceBranch] = useState("all");
  const [announceText, setAnnounceText] = useState("");

  const sendAnnouncement = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/announcements", { branch: announceBranch, message: announceText })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/announcements"] });
      setAnnounceText("");
      toast({ title: "Announcement sent" });
    },
    onError: () => toast({ title: "Couldn't send announcement", variant: "destructive" }),
  });

  const settings = settingsQuery.data;
  const roundRunning = !!settings?.roundStartedAt && !settings?.roundEndedAt;

  const cards = cardsQuery.data ?? [];
  const startCards = cards.filter((c) => c.kind === "start");
  const disruptionCards = cards.filter((c) => c.kind === "disruption").sort((a, b) => a.triggerMinute - b.triggerMinute);
  const announcements = announcementsQuery.data ?? [];
  const externalEvents = (externalEventsQuery.data ?? []).slice().sort((a, b) => a.triggerMinute - b.triggerMinute);

  const feed: FeedItem[] = [
    ...(interactionsQuery.data ?? []).map((i) => ({ ...i, kind: "interaction" as const })),
    ...(slipsQuery.data ?? []).map((s) => ({ ...s, kind: "slip" as const })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <PinGate
      storageKey="pts-unlocked-control"
      pin={FACILITATOR_PIN}
      label="Facilitator control"
      description="Enter the facilitator code to open the control screen."
    >
    <PageShell title="Facilitator control" subtitle="Start the round, reveal the leaderboard when you're ready, and reset between dry runs." wide>
      <Card className="mb-6" data-testid="card-table-pins">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Table codes</CardTitle>
          <CardDescription>Give each table only its own code — write it on their table card, don't say it aloud.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            {(Object.keys(BRANCH_PINS) as (keyof typeof BRANCH_PINS)[]).map((b) => (
              <div key={b} className="rounded-md border p-3" data-testid={`text-pin-branch-${b}`}>
                <div className="text-xs text-muted-foreground mb-1">{BRANCH_LABEL[b]}</div>
                <div className="text-lg font-semibold tabular-nums tracking-widest">{BRANCH_PINS[b]}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card data-testid="card-round-timer">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Round timer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums mb-3" data-testid="text-round-elapsed">
              {settings?.roundStartedAt ? formatElapsed(settings.roundStartedAt, settings.roundEndedAt ?? now) : "0:00"}
            </div>
            <div className="flex gap-2">
              {!roundRunning ? (
                <Button
                  className="flex-1"
                  onClick={() => updateSettings.mutate({ roundStartedAt: Date.now(), roundEndedAt: null })}
                  data-testid="button-start-round"
                >
                  <Play className="h-4 w-4" />
                  Start round
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => updateSettings.mutate({ roundEndedAt: Date.now() })}
                  data-testid="button-stop-round"
                >
                  <Square className="h-4 w-4" />
                  Stop round
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-leaderboard-toggle">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Leaderboard reveal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md border border-card-border px-3.5 py-3">
              <div className="flex items-center gap-2">
                {settings?.leaderboardRevealed ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                <Label htmlFor="reveal-switch" className="text-sm">
                  {settings?.leaderboardRevealed ? "Visible on dashboard" : "Hidden (standby)"}
                </Label>
              </div>
              <Switch
                id="reveal-switch"
                checked={!!settings?.leaderboardRevealed}
                onCheckedChange={(checked) => updateSettings.mutate({ leaderboardRevealed: checked })}
                data-testid="switch-reveal-leaderboard"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Reveal partway through the round once every branch has logged a few interactions.</p>
          </CardContent>
        </Card>

        <Card data-testid="card-reset">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reset data</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" data-testid="button-reset-all">
                  <Trash2 className="h-4 w-4" />
                  Reset all data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all simulation data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This clears every interaction and slip across all three branches, and hides the leaderboard again. Use this before a dry run or before the live session starts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resetAll.mutate()} data-testid="button-confirm-reset">
                    Reset everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground mt-2">Cannot be undone. Only use between dry runs or before going live.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card data-testid="card-card-schedule">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <IdCard className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Card schedule</CardTitle>
            </div>
            <CardDescription>Cards stay physical — hand-deliver each one privately when it's due, then mark it here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Round start (customer briefs)</div>
            <div className="space-y-1.5 mb-3">
              {startCards.map((c) => (
                <CardRow key={c.id} card={c} onDeliver={() => deliverCard.mutate(c.id)} pending={deliverCard.isPending} />
              ))}
            </div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Disruption cards (staggered)</div>
            <div className="space-y-1.5">
              {disruptionCards.map((c) => (
                <CardRow key={c.id} card={c} onDeliver={() => deliverCard.mutate(c.id)} pending={deliverCard.isPending} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-send-announcement">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Send announcement</CardTitle>
            </div>
            <CardDescription>Auto-generated from scorable events, or push your own to a branch (or all of them).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={announceBranch} onValueChange={setAnnounceBranch}>
                <SelectTrigger className="w-36" data-testid="select-announce-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  <SelectItem value="a">Branch A</SelectItem>
                  <SelectItem value="b">Branch B</SelectItem>
                  <SelectItem value="c">Branch C</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="flex-1"
                disabled={!announceText.trim() || sendAnnouncement.isPending}
                onClick={() => sendAnnouncement.mutate()}
                data-testid="button-send-announcement"
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
            <Textarea
              placeholder="e.g. Head office just flagged a policy change affecting every branch..."
              value={announceText}
              onChange={(e) => setAnnounceText(e.target.value)}
              maxLength={280}
              rows={2}
              data-testid="textarea-announce-message"
            />
            {announcements.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Recent</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {announcements.slice(0, 8).map((a) => (
                    <div
                      key={a.id}
                      className={
                        "flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-md border " +
                        TONE_BADGE_CLASS[a.tone]
                      }
                      data-testid={`row-control-announcement-${a.id}`}
                    >
                      <span className="truncate">
                        {a.branch === "all" ? "All" : BRANCH_LABEL[a.branch]}: {a.message}
                      </span>
                      {a.source === "facilitator" && (
                        <Badge variant="outline" className="shrink-0">
                          You
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-external-events" className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Automatic events</CardTitle>
          </div>
          <CardDescription>
            Pre-scripted shocks — no branch decision involved. Each auto-fires at its trigger minute, or trigger one
            early yourself whenever you want it to land: either way it posts an announcement at that branch and
            adjusts its score directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {externalEvents.map((ev) => (
              <ExternalEventRow
                key={ev.id}
                event={ev}
                onTrigger={() => triggerEvent.mutate(ev.id)}
                pending={triggerEvent.isPending && triggerEvent.variables === ev.id}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-event-feed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Event feed</CardTitle>
          </div>
          <CardDescription>Chronological log across all branches — useful for the debrief.</CardDescription>
        </CardHeader>
        <CardContent>
          {feed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No events yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
              {feed.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-muted/50 gap-3"
                  data-testid={`row-feed-${item.kind}-${item.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0">
                      {BRANCH_LABEL[item.branch]}
                    </Badge>
                    <span className="truncate">
                      {item.kind === "interaction"
                        ? `Interaction · ${INTERACTION_TYPE_LABEL[item.interactionType] ?? item.interactionType}`
                        : `Slip → ${BRANCH_LABEL[item.targetBranch]} ${DESK_LABEL[item.deskType]}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "active" ? (
                      <Badge variant="secondary">In progress</Badge>
                    ) : (
                      <>
                        <Badge
                          variant={
                            item.outcome === "resolved" || item.outcome === "approved"
                              ? "default"
                              : item.outcome === "escalated"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {OUTCOME_LABEL[item.outcome ?? ""] ?? item.outcome}
                        </Badge>
                        <span className="tabular-nums text-muted-foreground">{formatSeconds(item.resolutionSeconds)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
    </PinGate>
  );
}

function ExternalEventRow({
  event,
  onTrigger,
  pending,
}: {
  event: ExternalEventState;
  onTrigger: () => void;
  pending: boolean;
}) {
  const status = event.firedAt ? "fired" : event.due ? "due" : "pending";
  const impactLabel = `${event.impactAmount > 0 ? "+" : ""}${event.impactAmount} ${event.impactType === "nps" ? "NPS pts" : "morale"}`;
  return (
    <div
      className={
        "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs " +
        (status === "due" ? "border-primary bg-primary/10 animate-pulse" : status === "fired" ? "border-card-border bg-muted/40" : "border-card-border")
      }
      data-testid={`row-external-event-${event.id}`}
    >
      <div className="min-w-0">
        <div className="font-medium truncate">
          {BRANCH_LABEL[event.branch as keyof typeof BRANCH_LABEL] ?? event.branch} — {event.title}
        </div>
        <div className="text-muted-foreground truncate">~minute {event.triggerMinute} · {event.message}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={event.impactAmount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
          {impactLabel}
        </Badge>
        <Badge variant={status === "due" ? "default" : status === "fired" ? "secondary" : "outline"}>
          {status === "due" ? "Firing now" : status === "fired" ? "Fired" : "Pending"}
        </Badge>
        {status !== "fired" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={onTrigger} data-testid={`button-trigger-${event.id}`}>
            Trigger now
          </Button>
        )}
      </div>
    </div>
  );
}

function CardRow({
  card,
  onDeliver,
  pending,
}: {
  card: CardState;
  onDeliver: () => void;
  pending: boolean;
}) {
  const timingLabel = card.triggerMinute === 0 ? "Round start" : `~minute ${card.triggerMinute}`;
  const status = card.deliveredAt ? "delivered" : card.due ? "due" : "pending";
  return (
    <div
      className={
        "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs " +
        (status === "due"
          ? "border-primary bg-primary/10 animate-pulse"
          : status === "delivered"
          ? "border-card-border bg-muted/40"
          : "border-card-border")
      }
      data-testid={`row-card-${card.id}`}
    >
      <div className="min-w-0">
        <div className="font-medium truncate">
          {BRANCH_LABEL[card.branch as keyof typeof BRANCH_LABEL] ?? card.branch} · {card.role} — {card.title}
        </div>
        <div className="text-muted-foreground">{timingLabel}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={status === "due" ? "default" : status === "delivered" ? "secondary" : "outline"}>
          {status === "due" ? "Due now" : status === "delivered" ? "Delivered" : "Pending"}
        </Badge>
        {status !== "delivered" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={onDeliver} data-testid={`button-deliver-${card.id}`}>
            Mark delivered
          </Button>
        )}
      </div>
    </div>
  );
}
