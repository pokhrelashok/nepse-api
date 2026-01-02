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
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { useForm } from "react-hook-form"
import { Plus } from "lucide-react"

export default function IposPage() {
  const [page, setPage] = useState(0)
  const limit = 20
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ipos', page],
    queryFn: async () => {
      const res = await api.get(`/admin/ipos?limit=${limit}&offset=${page * limit}`)
      return res.data?.data?.ipos || []
    },
  })

  const form = useForm({
    defaultValues: {
      ipoId: '',
      companyName: '',
      stockSymbol: '',
      shareRegistrar: '',
      sectorName: '',
      shareType: 'IPO',
      pricePerUnit: '100',
      rating: '',
      units: '',
      minUnits: '10',
      maxUnits: '',
      totalAmount: '',
      openingDateAD: '',
      closingDateAD: '',
      status: 'Open',
    }
  })

  // Mutation for creating IPO
  const createMutation = useMutation({
    mutationFn: async (newIpo: any) => {
      // Ensure numeric types are converted
      const payload = {
        ...newIpo,
        ipoId: parseInt(newIpo.ipoId),
        pricePerUnit: parseFloat(newIpo.pricePerUnit),
        units: parseInt(newIpo.units),
        minUnits: parseInt(newIpo.minUnits),
        maxUnits: newIpo.maxUnits ? parseInt(newIpo.maxUnits) : null,
        totalAmount: newIpo.totalAmount ? parseFloat(newIpo.totalAmount) : null,
      }
      return api.post('/admin/ipos', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ipos'] })
      setIsOpen(false)
      form.reset()
    },
  })

  const onSubmit = (data: any) => {
    createMutation.mutate(data)
  }

  const ipos = data || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">IPOs</h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add IPO
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Add New IPO</SheetTitle>
              <SheetDescription>
                Enter the details of the new IPO.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ipoId">IPO ID (Unique)</Label>
                  <Input id="ipoId" type="number" {...form.register('ipoId', { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" {...form.register('companyName', { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockSymbol">Symbol</Label>
                  <Input id="stockSymbol" {...form.register('stockSymbol')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shareRegistrar">Share Registrar</Label>
                  <Input id="shareRegistrar" {...form.register('shareRegistrar')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sectorName">Sector</Label>
                  <Input id="sectorName" {...form.register('sectorName')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shareType">Share Type</Label>
                  <Input id="shareType" {...form.register('shareType')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricePerUnit">Price</Label>
                    <Input id="pricePerUnit" type="number" step="0.01" {...form.register('pricePerUnit', { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating</Label>
                    <Input id="rating" {...form.register('rating')} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="minUnits">Min Units</Label>
                    <Input id="minUnits" type="number" {...form.register('minUnits')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxUnits">Max Units</Label>
                    <Input id="maxUnits" type="number" {...form.register('maxUnits')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="units">Total Units</Label>
                    <Input id="units" type="number" {...form.register('units')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalAmount">Total Amount</Label>
                  <Input id="totalAmount" type="number" step="0.01" {...form.register('totalAmount')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="openingDateAD">Opening Date</Label>
                    <Input id="openingDateAD" type="date" {...form.register('openingDateAD', { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="closingDateAD">Closing Date</Label>
                    <Input id="closingDateAD" type="date" {...form.register('closingDateAD', { required: true })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    {...form.register('status')}
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                    <option value="Upcoming">Upcoming</option>
                  </select>
                </div>
              </div>
              <SheetFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Save IPO'}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                </TableRow>
              ))
            ) : (ipos.length > 0) ? (
              ipos.map((ipo: any) => (
                <TableRow key={ipo.ipo_id}>
                  <TableCell className="font-medium">{ipo.company_name}</TableCell>
                  <TableCell className="font-mono">{ipo.symbol}</TableCell>
                  <TableCell>{ipo.sector_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>Open: {ipo.opening_date ? new Date(ipo.opening_date).toLocaleDateString() : '-'}</div>
                    <div>Close: {ipo.closing_date ? new Date(ipo.closing_date).toLocaleDateString() : '-'}</div>
                  </TableCell>
                  <TableCell>Rs. {ipo.price_per_unit}</TableCell>
                  <TableCell>{ipo.units?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={ipo.status === 'Open' ? 'default' : ipo.status === 'Upcoming' ? 'secondary' : 'outline'}>
                      {ipo.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="text-center h-24">No IPOs found</TableCell></TableRow>
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
          disabled={ipos.length < limit}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
