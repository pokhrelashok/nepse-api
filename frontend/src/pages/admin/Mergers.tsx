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

export default function MergersPage() {
  const [page, setPage] = useState(0)
  const limit = 20
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-mergers', page],
    queryFn: async () => {
      const res = await api.get(`/admin/mergers?limit=${limit}&offset=${page * limit}`)
      return res.data?.data || []
    },
  })

  const mergers = data || []

  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true)
      const res = await api.post('/admin/mergers/sync')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mergers'] })
      setIsSyncing(false)
    },
    onError: () => {
      setIsSyncing(false)
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Merger & Acquisitions</h1>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={isSyncing}
          className="bg-nepse-primary hover:bg-nepse-primary/90"
        >
          {isSyncing ? 'Syncing...' : 'Sync Mergers'}
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>New Company</TableHead>
              <TableHead>Companies Involved</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Approval Date</TableHead>
              <TableHead>Joint Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                </TableRow>
              ))
            ) : (mergers.length > 0) ? (
              mergers.map((merger: Record<string, unknown>) => {
                const companies = Array.isArray(merger.companies)
                  ? merger.companies
                  : (typeof merger.companies === 'string' ? JSON.parse(merger.companies as string) : [])
                const companyNames = companies.map((c: Record<string, unknown>) => `${c.symbol || ''}`).join(', ')

                return (
                  <TableRow key={String(merger.id)}>
                    <TableCell className="font-mono font-medium">{String(merger.action)}</TableCell>
                    <TableCell className="font-medium">
                      <div>{String(merger.new_company_name)}</div>
                      <div className="text-xs text-gray-500">{String(merger.new_company_stock_symbol)}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {companyNames || '-'}
                    </TableCell>
                    <TableCell>{String(merger.sector_name) || '-'}</TableCell>
                    <TableCell>{merger.final_approval_date_ad ? new Date(merger.final_approval_date_ad as string).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{merger.joint_date_ad ? new Date(merger.joint_date_ad as string).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${merger.is_completed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {merger.is_completed ? 'Completed' : 'Pending'}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow><TableCell colSpan={7} className="text-center h-24">No mergers found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
          disabled={mergers.length < limit}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
