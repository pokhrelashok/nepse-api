import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, ArrowUpRight, ArrowDownRight, Equal, Play } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['market-summary'],
    queryFn: async () => {
      const res = await api.get('/market/summary')
      return res.data?.data || {}
    }
  })

  const startScheduler = async () => {
    try {
      await api.post('/scheduler/start')
      alert("Scheduler started successfully")
    } catch (e) {
      alert("Failed to start scheduler")
    }
  }

  // Fallback data
  const stats = data?.marketMetrics || {
    totalVolume: 0,
    totalTurnover: 0,
    gainers: 0,
    losers: 0,
    unchanged: 0,
    totalStocks: 0
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Market overview and scraper status.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startScheduler} className="bg-green-600 hover:bg-green-700">
            <Play className="mr-2 h-4 w-4" /> Trigger Scraper
          </Button>
        </div>
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
              <div className="text-2xl font-bold">Rs. {(stats.totalTurnover / 10000000).toFixed(2)}Cr</div>
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

      {/* We could add a chart here in the future */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium">Backend API</span>
                <span className="text-green-600 font-bold">Online</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium">Database (MySQL)</span>
                <span className="text-green-600 font-bold">Connected</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="font-medium">Scraper Engine</span>
                <span className="text-muted-foreground">Idle</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
