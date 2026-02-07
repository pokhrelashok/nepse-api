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

export default function UsersPage() {
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: async () => {
      const res = await api.get(`/admin/users?limit=${limit}&offset=${page * limit}`)
      return {
        users: res.data?.data?.users || [],
        total: res.data?.data?.pagination?.total || 0
      }
    },
    placeholderData: (prev) => prev
  })

  // Safe access
  const users = data?.users || []

  // Function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Total Users: {data?.total || 0}
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

      {/* Pagination Control */}
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
    </div>
  )
}
