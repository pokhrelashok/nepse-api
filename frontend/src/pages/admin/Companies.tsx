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
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function CompaniesPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, search],
    queryFn: async () => {
      // If we have search, we use search endpoint which doesn't support pagination heavily in backend yet perfectly, 
      // but we will try standard endpoint if no search, or search endpoint if search exists.
      // Actually the backend endpoint /api/companies supports limit/offset, but no search query param.
      // /api/search?q=XYZ returns all results.

      if (search.length >= 2) {
        const res = await api.get(`/search?q=${search}`)
        return { data: res.data?.data || [], total: res.data?.data?.length || 0, isSearch: true }
      }

      const res = await api.get(`/companies?limit=${limit}&offset=${page * limit}`)
      // The API returns { data: [...], total: count } ideally, but looking at server.js:
      // getAllCompanies returns just array. We might need to approximate total or just using simple pagination.
      // Let's assume just array for now.
      return { data: res.data?.data || [], total: 1000, isSearch: false } // Mock total for infinite scroll feel or simple next/prev
    },
    placeholderData: (prev) => prev
  })

  // Safe access
  const companies = data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-[300px]"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                </TableRow>
              ))
            ) : (companies.length > 0) ? (
              companies.map((company: any) => (
                <TableRow key={company.symbol}>
                  <TableCell className="font-medium font-mono">{company.symbol}</TableCell>
                  <TableCell>{company.name}</TableCell>
                  <TableCell>{company.sector}</TableCell>
                  <TableCell>
                    <Badge variant={company.status === 'Active' ? 'default' : 'secondary'}>
                      {company.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="text-center h-24">No results found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Simple Pagination Control */}
      {!data?.isSearch && (
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
            disabled={companies.length < limit}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
