import { Link } from "wouter";
import { PageShell } from "@/components/pts/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard, Settings2, Store } from "lucide-react";

const BRANCHES = [
  { id: "a", name: "Branch A", desc: "2 Customer · 1 Frontline · 1 Policy/Risk · 1 Back-office" },
  { id: "b", name: "Branch B", desc: "1 Customer · 2 Frontline · 1 Policy/Risk · 1 Back-office" },
  { id: "c", name: "Branch C", desc: "1 Customer · 1 Frontline · 1 Policy/Risk · 1 Back-office" },
];

export default function Home() {
  return (
    <PageShell
      title="Service Under Pressure — live simulation"
      subtitle="One laptop per branch table, plus a projector dashboard and a facilitator control screen. Pick your station below."
      wide
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {BRANCHES.map((b) => (
          <Card key={b.id} data-testid={`card-branch-${b.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Store className="h-4 w-4" />
                <CardTitle className="text-base">{b.name}</CardTitle>
              </div>
              <CardDescription>{b.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/branch/${b.id}`}>
                <Button className="w-full" data-testid={`button-open-branch-${b.id}`}>
                  Open station
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card data-testid="card-dashboard">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <LayoutDashboard className="h-4 w-4" />
              <CardTitle className="text-base">Live dashboard</CardTitle>
            </div>
            <CardDescription>Project this on the big screen. Stays on standby until the facilitator reveals it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="secondary" className="w-full" data-testid="button-open-dashboard">
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="card-control">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <Settings2 className="h-4 w-4" />
              <CardTitle className="text-base">Facilitator control</CardTitle>
            </div>
            <CardDescription>Start the round timer, reveal the leaderboard, and reset data before a live run.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/control">
              <Button variant="secondary" className="w-full" data-testid="button-open-control">
                Open control screen
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
