import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Activity, ArrowUpRight, ArrowDownRight, Equal, Clock, CheckCircle2, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

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
            <div className="space-y-3">
              {schedulerData?.stats && Object.entries(schedulerData.stats).map(([key, value]: [string, any]) => {
                const isCurrentlyRunning = schedulerData?.currently_executing?.includes(key)
                const hasRun = value.last_run !== null
                const lastSuccess = value.last_success !== null

                return (
                  <div key={key} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        {isCurrentlyRunning && (
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            Running
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {lastSuccess ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : hasRun ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Last Run:</span>{' '}
                        {formatDate(value.last_run)}
                      </div>
                      <div>
                        <span className="font-medium">Last Success:</span>{' '}
                        {formatDate(value.last_success)}
                      </div>
                      <div>
                        <span className="font-medium">Success:</span> {value.success_count}
                      </div>
                      <div>
                        <span className="font-medium">Failed:</span> {value.fail_count}
                      </div>
                    </div>
                  </div>
                )
              })}
              {(!schedulerData?.stats || Object.keys(schedulerData.stats).length === 0) && (
                <div className="text-center text-muted-foreground py-8">
                  No scheduler data available
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
