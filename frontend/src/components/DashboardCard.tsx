import * as React from "react"
import { cn } from "@/lib/utils"

interface DashboardCardProps {
  title: string
  icon?: string
  children: React.ReactNode
  extraHeader?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  noPadding?: boolean
}

export const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  ({ title, icon, children, extraHeader, footer, className, noPadding }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col",
          className
        )}
      >
        <div className="bg-nepse-primary p-4 md:px-6 flex items-center justify-between text-white shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-3">
            {icon && <i className={cn(icon, "text-nepse-accent")}></i>}
            {title}
          </h3>
          {extraHeader && <div className="flex items-center gap-2">{extraHeader}</div>}
        </div>
        <div className={cn(noPadding ? "" : "p-6 md:p-8")}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-8 py-3 bg-gray-50/50 text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    )
  }
)

DashboardCard.displayName = "DashboardCard"
