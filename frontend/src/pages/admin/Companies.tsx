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
    queryKey: ['admin-companies', page, search],
    queryFn: async () => {
      if (search.length >= 2) {
        // Use search endpoint for searching
        const res = await api.get(`/search?q=${search}`)
        return { companies: res.data?.data || [], total: res.data?.data?.length || 0, isSearch: true }
      }

      // Use admin endpoint for listing
      const res = await api.get(`/admin/companies?limit=${limit}&offset=${page * limit}`)
      return {
        companies: res.data?.data?.companies || [],
        total: res.data?.data?.pagination?.total || 0,
        isSearch: false
      }
    },
    placeholderData: (prev) => prev
  })

  // Safe access
  const companies = data?.companies || []

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
          disabled={companies.length < limit}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
