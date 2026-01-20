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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Market overview and scraper status.</p>
      </div>

      {/* User Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {userStatsLoading ? <Skeleton className="h-7 w-[60px]" /> : (
              <div className="text-2xl font-bold">{userStats?.total_users || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users</CardTitle>
            <UserPlus className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            {userStatsLoading ? <Skeleton className="h-7 w-[60px]" /> : (
              <div className="text-2xl font-bold">{userStats?.users_this_week || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Joined this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Processed</CardTitle>
            <BellRing className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {userStatsLoading ? <Skeleton className="h-7 w-[60px]" /> : (
              <div className="text-2xl font-bold">{userStats?.alerts_triggered_today || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Triggered today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {userStatsLoading ? <Skeleton className="h-7 w-[60px]" /> : (
              <div className="text-2xl font-bold">{userStats?.total_active_alerts || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Total monitoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Market Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Turnover</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-[100px]" /> : (
              <div className="text-2xl font-bold">
                Rs. {((Number(stats.totalTurnover) || 0) / 10000000).toFixed(2)}Cr
              </div>
            )}
            <p className="text-xs text-muted-foreground">Recent market activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gainers</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-[60px]" /> : (
              <div className="text-2xl font-bold text-green-600">{stats.gainers}</div>
            )}
            <p className="text-xs text-muted-foreground">Stocks up today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Losers</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-[60px]" /> : (
              <div className="text-2xl font-bold text-red-600">{stats.losers}</div>
            )}
            <p className="text-xs text-muted-foreground">Stocks down today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unchanged</CardTitle>
            <Equal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-[60px]" /> : (
              <div className="text-2xl font-bold">{stats.unchanged}</div>
            )}
            <p className="text-xs text-muted-foreground">No price movement</p>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* CPU Usage */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">CPU</span>
                  </div>
                  <span className="text-lg font-bold">{(systemMetrics?.cpu?.usage || 0).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(systemMetrics?.cpu?.usage || 0, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {systemMetrics?.cpu?.cores || 0} cores • Load: {(systemMetrics?.cpu?.loadAverage?.[0] || 0).toFixed(2)}
                </div>
              </div>

              {/* Memory Usage */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-4 w-4 text-violet-500" />
                    <span className="font-medium text-sm">Memory</span>
                  </div>
                  <span className="text-lg font-bold">{(systemMetrics?.memory?.usagePercent || 0).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${Math.min(systemMetrics?.memory?.usagePercent || 0, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {systemMetrics?.memory?.formatted?.used || '0'} / {systemMetrics?.memory?.formatted?.total || '0'}
                </div>
              </div>

              {/* Disk Usage */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm">Disk</span>
                  </div>
                  <span className="text-lg font-bold">{systemMetrics?.disk?.usagePercent || 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${Math.min(systemMetrics?.disk?.usagePercent || 0, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {systemMetrics?.disk?.used || '0'} / {systemMetrics?.disk?.total || '0'}
                </div>
              </div>

              {/* Uptime */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-sm">Uptime</span>
                  </div>
                </div>
                <div className="text-lg font-bold text-green-600">
                  {systemMetrics?.uptime?.formatted || '0s'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Process: {systemMetrics?.process?.uptimeFormatted || '0s'} • Node {systemMetrics?.process?.nodeVersion || ''}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Scheduler Status</CardTitle>
          {schedulerLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <Badge variant={schedulerData?.is_running ? "default" : "secondary"}>
              {schedulerData?.is_running ? "Running" : "Stopped"}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
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
