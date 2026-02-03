import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Activity, ArrowUpRight, ArrowDownRight, Equal, Clock, CheckCircle2, XCircle, Users, UserPlus, Cpu, HardDrive, MemoryStick, Server, Bell, BellRing } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['market-summary'],
    queryFn: async () => {
      const res = await api.get('/market/summary')
      return res.data?.data || {}
    }
  })

  const { data: schedulerData, isLoading: schedulerLoading } = useQuery({
    queryKey: ['scheduler-status'],
    queryFn: async () => {
      const res = await api.get('/admin/scheduler/status')
      return res.data?.data || {}
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  })

  const { data: userStats, isLoading: userStatsLoading } = useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/users/stats')
      return res.data?.data || {}
    }
  })

  const { data: systemMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const res = await api.get('/admin/system/metrics')
      return res.data?.data || {}
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Fallback data
  const stats = data?.marketMetrics || {
    totalVolume: 0,
    totalTurnover: 0,
    gainers: 0,
    losers: 0,
    unchanged: 0,
    totalStocks: 0
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function CompactStatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor,
    valueColor,
    isLoading
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    iconColor?: string;
    valueColor?: string;
    isLoading?: boolean;
  }) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </span>
            <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          </div>
          <div className="flex flex-col">
            {isLoading ? (
              <Skeleton className="h-7 w-20 my-1" />
            ) : (
              <div className={cn("text-xl font-bold tracking-tight", valueColor)}>
                {value}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/80 font-medium leading-none mt-1">
              {subtitle}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Market overview and scraper status.</p>
      </div>

      {/* Stats Section */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* User Stats */}
        <CompactStatCard
          title="Total Users"
          value={userStats?.total_users || 0}
          subtitle="Registered users"
          icon={Users}
          iconColor="text-blue-500"
          isLoading={userStatsLoading}
        />
        <CompactStatCard
          title="New Users"
          value={userStats?.users_today || 0}
          subtitle="Joined today"
          icon={UserPlus}
          iconColor="text-violet-500"
          isLoading={userStatsLoading}
        />
        <CompactStatCard
          title="Alerts Processed"
          value={userStats?.alerts_triggered_today || 0}
          subtitle="Triggered today"
          icon={BellRing}
          iconColor="text-amber-500"
          isLoading={userStatsLoading}
        />
        <CompactStatCard
          title="Active Alerts"
          value={userStats?.total_active_alerts || 0}
          subtitle="Total monitoring"
          icon={Bell}
          iconColor="text-emerald-500"
          isLoading={userStatsLoading}
        />

        {/* Market Stats */}
        <CompactStatCard
          title="Total Turnover"
          value={`Rs. ${((Number(stats.totalTurnover) || 0) / 10000000).toFixed(2)}Cr`}
          subtitle="Recent market activity"
          icon={Activity}
          isLoading={isLoading}
        />
        <CompactStatCard
          title="Gainers"
          value={stats.gainers}
          subtitle="Stocks up today"
          icon={ArrowUpRight}
          iconColor="text-green-500"
          valueColor="text-green-600"
          isLoading={isLoading}
        />
        <CompactStatCard
          title="Losers"
          value={stats.losers}
          subtitle="Stocks down today"
          icon={ArrowDownRight}
          iconColor="text-red-500"
          valueColor="text-red-600"
          isLoading={isLoading}
        />
        <CompactStatCard
          title="Unchanged"
          value={stats.unchanged}
          subtitle="No price movement"
          icon={Equal}
          isLoading={isLoading}
        />
      </div>

      {/* System Metrics */}
      <Card className="overflow-hidden border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pb-3 pt-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-4 w-4 text-primary" />
            Server Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {metricsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* CPU Usage */}
              <div className="bg-card border rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">CPU</span>
                  </div>
                  <span className="text-base font-bold">{(systemMetrics?.cpu?.usage || 0).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(systemMetrics?.cpu?.usage || 0, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">
                  {systemMetrics?.cpu?.cores || 0} cores • Load: {(systemMetrics?.cpu?.loadAverage?.[0] || 0).toFixed(2)}
                </div>
              </div>

              {/* Memory Usage */}
              <div className="bg-card border rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MemoryStick className="h-3.5 w-3.5 text-violet-500" />
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Memory</span>
                  </div>
                  <span className="text-base font-bold">{(systemMetrics?.memory?.usagePercent || 0).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${Math.min(systemMetrics?.memory?.usagePercent || 0, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">
                  {systemMetrics?.memory?.formatted?.used || '0'} / {systemMetrics?.memory?.formatted?.total || '0'}
                </div>
              </div>

              {/* Disk Usage */}
              <div className="bg-card border rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Disk</span>
                  </div>
                  <span className="text-base font-bold">{systemMetrics?.disk?.usagePercent || 0}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${Math.min(systemMetrics?.disk?.usagePercent || 0, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">
                  {systemMetrics?.disk?.used || '0'} / {systemMetrics?.disk?.total || '0'}
                </div>
              </div>

              {/* Uptime */}
              <div className="bg-card border rounded-xl p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-green-500" />
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Uptime</span>
                </div>
                <div className="text-base font-bold text-green-600">
                  {systemMetrics?.uptime?.formatted || '0s'}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium truncate">
                  Node {systemMetrics?.process?.nodeVersion || ''}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler Status */}
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Scheduler Status</CardTitle>
          {schedulerLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <Badge variant={schedulerData?.is_running ? "default" : "secondary"}>
              {schedulerData?.is_running ? "Running" : "Stopped"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="px-0 bg-card border rounded-xl overflow-hidden">
          {schedulerLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Last Success</TableHead>
                  <TableHead className="text-right">Stats (Today/Total)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulerData?.stats && Object.entries(schedulerData.stats).map(([key, value]: [string, any]) => {
                  const isCurrentlyRunning = schedulerData?.currently_executing?.includes(key)

                  return (
                    <TableRow key={key} className="group cursor-default">
                      <TableCell className="py-2">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize text-sm">
                              {key.replace(/_/g, ' ')}
                            </span>
                            {isCurrentlyRunning && (
                              <Badge variant="outline" className="h-4 px-1 text-[10px] animate-pulse border-blue-200 text-blue-600 bg-blue-50">
                                EXECUTING
                              </Badge>
                            )}
                          </div>
                          {value.message && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[300px]" title={value.message}>
                              {value.message}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`h-5 text-[10px] px-1.5 ${value.status === 'SUCCESS' ? 'bg-emerald-500 hover:bg-emerald-600' :
                              value.status === 'FAILED' ? 'bg-red-500 hover:bg-red-600' :
                                value.status === 'RUNNING' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-500'
                              }`}
                          >
                            {value.status || 'IDLE'}
                          </Badge>
                          {value.status === 'SUCCESS' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : value.status === 'FAILED' ? (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {formatDate(value.last_run)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {formatDate(value.last_success)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="text-[10px] font-medium">
                            <span className="text-emerald-600">{value.today_success_count || 0}</span>
                            <span className="mx-1 text-slate-300">/</span>
                            <span className="text-red-600">{value.today_fail_count || 0}</span>
                            <span className="ml-1 text-slate-400 font-normal">today</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            <span className="text-emerald-600/70">{value.success_count || 0}</span>
                            <span className="mx-1">/</span>
                            <span className="text-red-600/70">{value.fail_count || 0}</span>
                            <span className="ml-1">total</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {(!schedulerData?.stats || Object.keys(schedulerData.stats).length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No scheduler data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
