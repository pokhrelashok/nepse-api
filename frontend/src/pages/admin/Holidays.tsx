import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Trash2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function HolidaysPage() {
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['admin-holidays'],
    queryFn: async () => {
      const res = await api.get('/admin/holidays')
      return res.data?.data || []
    }
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true)
      const res = await api.post('/admin/holidays/sync')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-holidays'] })
      setIsSyncing(false)
    },
    onError: () => {
      setIsSyncing(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (date: string) => {
      await api.delete(`/admin/holidays/${date}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-holidays'] })
    }
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Holidays</h1>
          <p className="text-muted-foreground">Manage trading closure dates and sync from ShareHub.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={isSyncing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from ShareHub'}
          </Button>
          <Button disabled title="Manual addition coming soon">
            <Plus className="mr-2 h-4 w-4" />
            Add Holiday
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holiday Calendar</CardTitle>
          <CardDescription>
            The market will remain closed on these dates. All scheduled scraping jobs will skip execution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : holidays.length > 0 ? (
                  holidays.map((holiday: any) => (
                    <TableRow key={holiday.holiday_date}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{formatDate(holiday.holiday_date)}</span>
                          <span className="text-xs text-muted-foreground">{holiday.holiday_date}</span>
                        </div>
                      </TableCell>
                      <TableCell>{holiday.description}</TableCell>
                      <TableCell>
                        <Badge variant={holiday.is_active ? "default" : "secondary"}>
                          {holiday.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete the holiday for ${holiday.holiday_date}?`)) {
                              deleteMutation.mutate(holiday.holiday_date)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                      No holidays found. Click Sync to fetch from ShareHub.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
