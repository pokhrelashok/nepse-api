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

export default function DividendsPage() {
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['announced-dividends', page],
    queryFn: async () => {
      const res = await api.get(`/announced-dividends?limit=${limit}&offset=${page * limit}`)
      return res.data?.data || []
    },
  })

  const dividends = data || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Announced Dividends</h1>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Fiscal Year</TableHead>
              <TableHead>Bonus Share</TableHead>
              <TableHead>Cash Dividend</TableHead>
              <TableHead>Total Dividend</TableHead>
              <TableHead>Book Close Date</TableHead>
              <TableHead>Right Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                </TableRow>
              ))
            ) : (dividends.length > 0) ? (
              dividends.map((div: any) => (
                <TableRow key={div.id}>
                  <TableCell className="font-mono font-medium">{div.symbol}</TableCell>
                  <TableCell>{div.company_name}</TableCell>
                  <TableCell>{div.fiscal_year}</TableCell>
                  <TableCell>{div.bonus_share ? `${div.bonus_share}%` : '-'}</TableCell>
                  <TableCell>{div.cash_dividend ? `${div.cash_dividend}%` : '-'}</TableCell>
                  <TableCell className="font-semibold">{div.total_dividend ? `${div.total_dividend}%` : '-'}</TableCell>
                  <TableCell>{div.book_close_date ? new Date(div.book_close_date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>{div.right_share || '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={8} className="text-center h-24">No announced dividends found</TableCell></TableRow>
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
          disabled={dividends.length < limit}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
