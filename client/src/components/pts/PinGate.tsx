import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// In-memory unlock store (module-level, not persisted storage). This is a
// single-page app — route changes never reload the page — so an unlocked
// station stays unlocked for the rest of the live session. Only an actual
// browser refresh clears it, which asks for the code again.
const unlocks = new Map<string, string>();

function readUnlock(key: string): string | null {
  return unlocks.get(key) ?? null;
}

function writeUnlock(key: string, value: string) {
  unlocks.set(key, value);
}

/**
 * Gates its children behind a short PIN. Once the correct PIN is entered,
 * the unlock is remembered in memory under `storageKey` — so this tab stays
 * unlocked for the rest of the live session (navigating between pages
 * doesn't reload), but a browser refresh or a different tab/device asks
 * again.
 */
export function PinGate({
  storageKey,
  pin,
  label,
  description,
  children,
}: {
  storageKey: string;
  pin: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(() => readUnlock(storageKey) === "1");
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleComplete = (entered: string) => {
    if (entered === pin) {
      writeUnlock(storageKey, "1");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-sm" data-testid="card-pin-gate">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <CardTitle className="text-base">{label}</CardTitle>
          <CardDescription>{description ?? "Enter the 4-digit code for this station."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <InputOTP
            maxLength={4}
            value={value}
            onChange={(v) => {
              setValue(v);
              setError(false);
              if (v.length === 4) handleComplete(v);
            }}
            data-testid="input-pin"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3].map((i) => (
                <InputOTPSlot key={i} index={i} className={cn(error && "border-destructive text-destructive")} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && (
            <p className="text-xs text-destructive" data-testid="text-pin-error">
              That code isn't right — try again.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
