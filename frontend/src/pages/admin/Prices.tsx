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
import { ArrowUpDown } from "lucide-react"

export default function PricesPage() {
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState("symbol")
  const [order, setOrder] = useState<"asc" | "desc">("asc")
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['prices', page, sortBy, order],
    queryFn: async () => {
      const res = await api.get(`/today-prices?limit=${limit}&offset=${page * limit}&sortBy=${sortBy}&order=${order}`)
      // API returns { data: [], pagination: { total, ... } }
      return res.data?.data || {}
    },
    placeholderData: (prev) => prev
  })

  // Extract array from response structure
  const prices = data?.data || []

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setOrder(order === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setOrder("desc") // Default to desc for numbers usually relevant, but let's stick to simple logic
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Market Prices</h1>

      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('symbol')}>
                Symbol <ArrowUpDown className="ml-2 h-4 w-4 inline" />
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('close')}>
                Close Price <ArrowUpDown className="ml-2 h-4 w-4 inline" />
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('percentage_change')}>
                Change % <ArrowUpDown className="ml-2 h-4 w-4 inline" />
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('high')}>
                High
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('low')}>
                Low
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('volume')}>
                Volume
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                </TableRow>
              ))
            ) : (prices.length > 0) ? (
              prices.map((stock: any) => (
                <TableRow key={stock.symbol}>
                  <TableCell className="font-medium font-mono">{stock.symbol}</TableCell>
                  <TableCell className="text-right">Rs. {stock.close}</TableCell>
                  <TableCell className={`text-right ${stock.percentage_change > 0 ? 'text-green-600' : (stock.percentage_change < 0 ? 'text-red-600' : '')}`}>
                    {stock.percentage_change}%
                  </TableCell>
                  <TableCell className="text-right">{stock.high}</TableCell>
                  <TableCell className="text-right">{stock.low}</TableCell>
                  <TableCell className="text-right font-mono">{stock.volume?.toLocaleString()}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="text-center h-24">No data available</TableCell></TableRow>
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
          disabled={prices.length < limit}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
