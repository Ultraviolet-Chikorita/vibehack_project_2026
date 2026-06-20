import { Card, CardContent } from "@/components/ui/card"
import { scoringWeights, type ScoreResult } from "@/lib/scoring"
import { cn } from "@/lib/utils"

function ringColor(score: number) {
  if (score >= 80) return "var(--emerald)"
  if (score >= 50) return "var(--warning)"
  return "var(--danger)"
}

export function ScoreCard({ score }: { score: ScoreResult }) {
  const color = ringColor(score.score)
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (score.score / 100) * circumference

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center">
        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--secondary)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {score.score}
            </span>
            <span className="font-mono text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Evidence dimensions</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Weighted across 10 dimensions. Bars show captured strength per dimension.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {scoringWeights.map((dim) => {
              const v = Math.round((score.dimensions[dim.id] ?? 0) * 100)
              const tone =
                v >= 80 ? "bg-emerald" : v >= 50 ? "bg-warning" : v > 0 ? "bg-warning" : "bg-danger"
              return (
                <li key={dim.id} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate text-muted-foreground">{dim.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-secondary">
                    <span
                      className={cn("block h-full rounded-[2px]", tone)}
                      style={{ width: `${v}%` }}
                    />
                  </span>
                  <span className="w-7 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                    {v}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
