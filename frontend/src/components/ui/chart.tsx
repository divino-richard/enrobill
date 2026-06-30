"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import type {
  TooltipContentProps,
  TooltipPayloadEntry,
} from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId().replace(/:/g, "")
  const chartId = `chart-${id ?? uniqueId}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "h-full w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/40",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

function ChartStyle({
  id,
  config,
}: {
  id: string
  config: ChartConfig
}) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color)

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: colorConfig
          .map(
            ([key, item]) =>
              `[data-chart="${id}"] { --color-${key}: ${item.color}; }`,
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
  hideLabel = false,
}: Partial<TooltipContentProps<ValueType, NameType>> & {
  hideLabel?: boolean
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="grid min-w-[8rem] gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs shadow-xl">
      {!hideLabel && label ? (
        <div className="font-medium text-foreground">{label}</div>
      ) : null}
      {payload.map((item: TooltipPayloadEntry<ValueType, NameType>, index: number) => {
        const key = String(item.dataKey ?? item.name ?? index)
        const itemConfig = config[key]
        const displayValue = formatter
          ? formatter(item.value, item.name, item, index, item.payload)
          : item.value

        return (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-flex size-2.5 rounded-full"
                style={{
                  backgroundColor:
                    item.color ?? item.payload?.fill ?? item.payload?.color,
                }}
              />
              <span>{itemConfig?.label ?? item.name}</span>
            </div>
            <span className="font-medium text-foreground tabular-nums">
              {displayValue as React.ReactNode}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
