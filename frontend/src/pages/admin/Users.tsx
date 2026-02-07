import { useQuery } from "@tanstack/react-query"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function UsersPage() {
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('all')
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, filter],
    queryFn: async () => {
      const res = await api.get(`/admin/users?limit=${limit}&offset=${page * limit}&filter=${filter}`)
      return {
        users: res.data?.data?.users || [],
        total: res.data?.data?.pagination?.total || 0
      }
    },
    placeholderData: (prev) => prev
  })

  // Safe access
  const users = data?.users || []

  // Fetch stats separately
  const { data: stats } = useQuery({
    queryKey: ['admin-users-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/users/stats')
      return res.data?.data || {}
    }
  })

  // Function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

      <div className="flex justify-between items-center bg-card p-4 rounded-md border">
        <div className="flex items-center gap-4">
          <Select value={filter} onValueChange={(val) => {
            setFilter(val)
            setPage(0) // Reset to first page on filter change
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="active_today">Active Today</SelectItem>
              <SelectItem value="active_this_week">Active This Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="font-bold text-lg">{stats?.active_users_today || 0}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Active Today</span>
          </div>
          <div className="h-8 w-[1px] bg-border/50"></div>
          <div className="flex flex-col items-end">
            <span className="font-bold text-lg">{stats?.active_users_this_week || 0}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Active 7 Days</span>
          </div>
          <div className="h-8 w-[1px] bg-border/50"></div>
          <div className="flex flex-col items-end">
            <span className="font-bold text-lg">{data?.total || 0}</span>
             <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Users</span>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-center">Portfolios</TableHead>
              <TableHead className="text-center">Total Investment</TableHead>
              <TableHead className="text-center">Transactions</TableHead>
              <TableHead className="text-center">Alerts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-[100px]" /></div></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[40px] mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[40px] mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[40px] mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : (users.length > 0) ? (
              users.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url} alt={user.display_name} />
                        <AvatarFallback>{user.display_name?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.display_name || 'Anonymous'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>{formatDate(user.last_active_at)}</TableCell>
                  <TableCell className="text-center">{user.portfolio_count}</TableCell>
                  <TableCell className="text-center">
                    {user.total_investment ? (
                      <span className="font-medium text-green-600">
                        Rs. {user.total_investment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{user.transaction_count}</TableCell>
                  <TableCell className="text-center">{user.alert_count}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="text-center h-24">No users found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

  {/* Pagination Control */ }
  <div className="flex items-center justify-end space-x-2 py-4">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage((p) => Math.max(0, p - 1))}
      disabled={page === 0}
    >
      Previous
    </Button>
    <div className="text-sm">Page {page + 1}</div>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage((p) => p + 1)}
      disabled={users.length < limit}
    >
      Next
    </Button>
  </div>
    </div >
  )
}
