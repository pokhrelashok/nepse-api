import React, { useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MessageSquare,
  Upload,
  X,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  ArrowLeft,
  Send,
} from "lucide-react"
import { Link } from "@tanstack/react-router"

interface UploadedFile {
  file: File
  preview: string
  base64: string
}

export default function FeedbackSubmit() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    )
    addFiles(droppedFiles)
  }, [files])

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  const addFiles = async (newFiles: File[]) => {
    const remaining = 5 - files.length
    const filesToAdd = newFiles.slice(0, remaining)

    const processedFiles = await Promise.all(
      filesToAdd.map(async (file) => ({
        file,
        preview: URL.createObjectURL(file),
        base64: await fileToBase64(file)
      }))
    )

    setFiles(prev => [...prev, ...processedFiles])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload: {
        title: string
        body: string
        attachments: string[]
        userName?: string
        userEmail?: string
      } = {
        title,
        body,
        attachments: files.map(f => f.base64),
      }

      if (userName) payload.userName = userName
      if (userEmail) payload.userEmail = userEmail

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to submit feedback')
      }

      setIsSuccess(true)
      // Clear form
      setTitle('')
      setBody('')
      setUserName('')
      setUserEmail('')
      files.forEach(f => URL.revokeObjectURL(f.preview))
      setFiles([])
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />

        <Card className="w-full max-w-md relative backdrop-blur-xl bg-white/10 border-white/20 text-white animate-in fade-in zoom-in duration-500">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-white/70 mb-6">
              Your feedback has been submitted successfully. We appreciate you taking the time to help us improve.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => setIsSuccess(false)}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20"
              >
                Submit Another Feedback
              </Button>
              <Link to="/">
                <Button variant="ghost" className="w-full text-white/70 hover:text-white hover:bg-white/10">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="w-full max-w-2xl relative">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center text-white/60 hover:text-white transition-colors mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/25 mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Submit Feedback</h1>
          <p className="text-white/60">Help us improve by sharing your thoughts, suggestions, or reporting issues.</p>
        </div>

        {/* Form Card */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Your Feedback</CardTitle>
            <CardDescription className="text-white/60">
              Fill in the details below. All fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-white">
                  Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  required
                  maxLength={255}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="body" className="text-white">
                  Description <span className="text-red-400">*</span>
                </Label>
                <textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Please provide detailed information about your feedback, suggestion, or issue..."
                  required
                  rows={5}
                  className="w-full rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/40 p-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 resize-none"
                />
              </div>

              {/* Contact Info (Optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userName" className="text-white">
                    Name <span className="text-white/40">(optional)</span>
                  </Label>
                  <Input
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your name"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail" className="text-white">
                    Email <span className="text-white/40">(optional)</span>
                  </Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20"
                  />
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-white">
                  Attachments <span className="text-white/40">(optional, max 5 images)</span>
                </Label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${dragActive
                      ? 'border-purple-400 bg-purple-500/10'
                      : 'border-white/20 hover:border-white/40'
                    } ${files.length >= 5 ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={files.length >= 5}
                  />
                  <Upload className="w-10 h-10 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60 text-sm">
                    Drag & drop images here, or <span className="text-purple-400">browse</span>
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    PNG, JPG, GIF, or WebP (max 5MB each)
                  </p>
                </div>

                {/* Preview */}
                {files.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-4">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="relative group aspect-square rounded-lg overflow-hidden bg-white/10 border border-white/20"
                      >
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 p-1">
                          <p className="text-white text-xs truncate">{file.file.name}</p>
                        </div>
                      </div>
                    ))}
                    {files.length < 5 && (
                      <label className="relative aspect-square rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 flex items-center justify-center cursor-pointer transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                        <ImageIcon className="w-6 h-6 text-white/40" />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !title || !body}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-semibold py-6 text-lg shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/40 text-sm mt-6">
          Your feedback helps us make the app better for everyone. Thank you!
        </p>
      </div>
    </div>
  )
}
