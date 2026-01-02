import React, { useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react"

interface Feedback {
  id: number
  title: string
  body: string
  status: 'pending' | 'in_review' | 'resolved' | 'closed'
  attachments: Array<{
    filename: string
    originalName: string
    path: string
    mimetype: string
    size: number
  }>
  user_email: string | null
  user_name: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

interface FeedbackStats {
  total: number
  pending: number
  in_review: number
  resolved: number
  closed: number
}

const statusConfig = {
  pending: {
    label: 'Pending',
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  in_review: {
    label: 'In Review',
    variant: 'default' as const,
    icon: Eye,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  resolved: {
    label: 'Resolved',
    variant: 'outline' as const,
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  closed: {
    label: 'Closed',
    variant: 'outline' as const,
    icon: XCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
}

export default function FeedbackPage() {
  const [page, setPage] = useState(0)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const limit = 15
  const queryClient = useQueryClient()

  // Fetch feedback stats
  const { data: stats } = useQuery<FeedbackStats>({
    queryKey: ['admin-feedback-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/feedback/stats')
      return res.data?.data || { total: 0, pending: 0, in_review: 0, resolved: 0, closed: 0 }
    },
  })

  // Fetch feedbacks
  const { data, isLoading } = useQuery<Feedback[]>({
    queryKey: ['admin-feedbacks', page, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      })
      if (filterStatus !== 'all') {
        params.append('status', filterStatus)
      }
      const res = await api.get(`/admin/feedback?${params}`)
      return res.data?.data || []
    },
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return api.patch(`/admin/feedback/${id}/status`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feedbacks'] })
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-stats'] })
      if (selectedFeedback) {
        setSelectedFeedback(null)
      }
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/admin/feedback/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feedbacks'] })
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-stats'] })
    },
  })

  const feedbacks = data || []

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
          <p className="text-muted-foreground">Manage user feedback and track resolution status.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('pending')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('in_review')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Review</CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.in_review || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('resolved')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('closed')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats?.closed || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Badge */}
      {filterStatus !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtering by:</span>
          <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterStatus('all')}>
            {statusConfig[filterStatus as keyof typeof statusConfig]?.label || filterStatus}
            <XCircle className="ml-1 h-3 w-3" />
          </Badge>
        </div>
      )}

      {/* Feedbacks Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Attachments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[30px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                </TableRow>
              ))
            ) : feedbacks.length > 0 ? (
              feedbacks.map((feedback) => {
                const config = statusConfig[feedback.status]
                const StatusIcon = config.icon
                return (
                  <TableRow key={feedback.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedFeedback(feedback)}>
                    <TableCell className="font-mono text-sm">#{feedback.id}</TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">{feedback.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {feedback.user_name || feedback.user_email || 'Anonymous'}
                    </TableCell>
                    <TableCell>
                      {feedback.attachments.length > 0 ? (
                        <Badge variant="outline" className="gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {feedback.attachments.length}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={config.variant}
                        className={`gap-1 ${config.bgColor} ${config.color} border-0`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(feedback.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this feedback?')) {
                            deleteMutation.mutate(feedback.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-8 w-8" />
                    <span>No feedback found</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
          disabled={feedbacks.length < limit}
        >
          Next
        </Button>
      </div>

      {/* Feedback Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedFeedback && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">#{selectedFeedback.id}</span>
                  {selectedFeedback.title}
                </DialogTitle>
                <DialogDescription>
                  Submitted {formatDate(selectedFeedback.created_at)}
                  {selectedFeedback.user_name && ` by ${selectedFeedback.user_name}`}
                  {selectedFeedback.user_email && ` (${selectedFeedback.user_email})`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Status Update */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge
                      variant={statusConfig[selectedFeedback.status].variant}
                      className={`gap-1 ${statusConfig[selectedFeedback.status].bgColor} ${statusConfig[selectedFeedback.status].color} border-0`}
                    >
                      {React.createElement(statusConfig[selectedFeedback.status].icon, { className: "h-3 w-3" })}
                      {statusConfig[selectedFeedback.status].label}
                    </Badge>
                  </div>
                  <Select
                    value={selectedFeedback.status}
                    onValueChange={(value) => {
                      updateStatusMutation.mutate({ id: selectedFeedback.id, status: value })
                      setSelectedFeedback({ ...selectedFeedback, status: value as Feedback['status'] })
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Feedback Body */}
                <div className="space-y-2">
                  <h4 className="font-medium">Description</h4>
                  <div className="p-4 bg-background border rounded-lg whitespace-pre-wrap text-sm">
                    {selectedFeedback.body}
                  </div>
                </div>

                {/* Attachments */}
                {selectedFeedback.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Attachments ({selectedFeedback.attachments.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedFeedback.attachments.map((attachment, index) => (
                        <a
                          key={index}
                          href={attachment.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                        >
                          <img
                            src={attachment.path}
                            alt={attachment.originalName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-xs truncate">{attachment.originalName}</p>
                            <p className="text-white/70 text-xs">{formatFileSize(attachment.size)}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {selectedFeedback.resolved_at && (
                  <div className="text-sm text-muted-foreground">
                    Resolved on {formatDate(selectedFeedback.resolved_at)}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Delete this feedback?')) {
                      deleteMutation.mutate(selectedFeedback.id)
                      setSelectedFeedback(null)
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
