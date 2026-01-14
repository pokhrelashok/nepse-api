import { useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'

interface UploadedFile {
  file: File
  preview: string
  base64: string
}

export default function FeedbackPage() {
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
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'))
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

    for (const file of filesToAdd) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        continue
      }
      const base64 = await fileToBase64(file)
      setFiles(prev => [...prev, { file, preview: URL.createObjectURL(file), base64 }])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
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
      const payload: any = { title, body, attachments: files.map(f => f.base64) }
      if (userName) payload.userName = userName
      if (userEmail) payload.userEmail = userEmail

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to submit feedback')
      }

      setIsSuccess(true)
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

  const resetForm = () => {
    setIsSuccess(false)
    setError(null)
  }

  const styles = {
    page: { padding: '120px 2rem 3rem', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' } as React.CSSProperties,
    header: { textAlign: 'center' as const, marginBottom: '2rem' },
    title: { fontSize: '2.25rem', fontWeight: 800, background: 'linear-gradient(135deg, #1a472a 0%, #52b788 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' },
    subtitle: { color: '#6b7280', fontSize: '1.1rem', margin: 0 },
    card: { background: '#fff', borderRadius: 15, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden' },
    cardHeader: { padding: '1rem 1.5rem', background: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%)', color: '#fff' },
    form: { padding: '1.5rem' },
    formGroup: { marginBottom: '1.25rem' },
    label: { display: 'block', fontWeight: 600, color: '#1a1a2e', marginBottom: '0.5rem', fontSize: '0.95rem' },
    required: { color: '#d62828' },
    optional: { color: '#6b7280', fontWeight: 400, fontSize: '0.85rem' },
    input: { width: '100%', padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: '1rem', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    textarea: { width: '100%', padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: '1rem', minHeight: 120, resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    uploadArea: { border: '2px dashed #e5e7eb', borderRadius: 10, padding: '1.5rem', textAlign: 'center' as const, cursor: 'pointer', position: 'relative' as const, transition: 'all 0.3s ease' },
    uploadAreaActive: { borderColor: '#52b788', background: 'rgba(82, 183, 136, 0.05)' },
    previewGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '0.75rem' },
    previewItem: { aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '2px solid #e5e7eb', position: 'relative' as const },
    removeBtn: { position: 'absolute' as const, top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: '#d62828', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    submitBtn: { width: '100%', padding: '1rem 2rem', background: 'linear-gradient(135deg, #1a472a 0%, #52b788 100%)', color: '#fff', border: 'none', borderRadius: 50, fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
    error: { background: 'rgba(214, 40, 40, 0.1)', border: '1px solid rgba(214, 40, 40, 0.3)', color: '#d62828', padding: '1rem', borderRadius: 10, marginBottom: '1.25rem', fontSize: '0.95rem' },
    success: { textAlign: 'center' as const, padding: '3rem 2rem' },
    successIcon: { width: 80, height: 80, borderRadius: '50%', background: 'rgba(45, 159, 111, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.5rem', color: '#2d9f6f' },
    footer: { textAlign: 'center' as const, marginTop: '1.5rem', color: '#6b7280', fontSize: '0.9rem' },
  }

  if (isSuccess) {
    return (
      <section style={styles.page}>
        <div style={styles.card}>
          <div style={styles.success}>
            <div style={styles.successIcon}><i className="fa-solid fa-check"></i></div>
            <h2 style={{ color: '#1a472a', marginBottom: '0.75rem', fontSize: '1.75rem' }}>Thank You!</h2>
            <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '1rem' }}>Your feedback has been submitted successfully. We appreciate you taking the time to help us improve.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={resetForm} style={{ ...styles.submitBtn, width: 'auto', padding: '0.875rem 2rem' }}>Submit Another</button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Helmet>
        <title>Send Feedback - NEPSE Portfolio Tracker</title>
        <meta name="description" content="Share your feedback and suggestions with the NEPSE Portfolio Tracker team. Help us improve your stock market tracking experience." />
        <link rel="canonical" href="https://nepseportfoliotracker.app/feedback" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <section style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Submit Feedback</h1>
          <p style={styles.subtitle}>Help us improve by sharing your thoughts, suggestions, or reporting issues.</p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Your Feedback</h2>
            <p style={{ fontSize: '0.9rem', opacity: 0.9, margin: '0.25rem 0 0' }}>Fields marked with * are required.</p>
          </div>

          <form style={styles.form} onSubmit={handleSubmit}>
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>Title <span style={styles.required}>*</span></label>
              <input style={styles.input} type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief summary of your feedback" required maxLength={255} />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description <span style={styles.required}>*</span></label>
              <textarea style={styles.textarea} value={body} onChange={e => setBody(e.target.value)} placeholder="Please provide detailed information about your feedback, suggestion, or issue..." required rows={5} />
            </div>

            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name <span style={styles.optional}>(optional)</span></label>
                <input style={styles.input} type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Your name" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email <span style={styles.optional}>(optional)</span></label>
                <input style={styles.input} type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="your@email.com" />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Attachments <span style={styles.optional}>(optional, max 5 images)</span></label>
              {files.length === 0 && (
                <div
                  style={{ ...styles.uploadArea, ...(dragActive ? styles.uploadAreaActive : {}) }}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                >
                  <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                  <div style={{ fontSize: '2rem', color: '#52b788', marginBottom: '0.75rem' }}><i className="fa-solid fa-cloud-arrow-up"></i></div>
                  <div style={{ color: '#6b7280', fontSize: '0.95rem' }}>Drag & drop images here, or <span style={{ color: '#52b788', fontWeight: 600 }}>browse</span></div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>PNG, JPG, GIF, or WebP (max 5MB each)</div>
                </div>
              )}
              {files.length > 0 && (
                <div style={styles.previewGrid}>
                  {files.map((f, i) => (
                    <div key={i} style={styles.previewItem}>
                      <img src={f.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" style={styles.removeBtn} onClick={() => removeFile(i)}><i className="fa-solid fa-xmark"></i></button>
                    </div>
                  ))}
                  {files.length < 5 && (
                    <label style={{ ...styles.previewItem, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f5f7fa' }}>
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                      <i className="fa-solid fa-plus" style={{ color: '#6b7280', fontSize: '1.25rem' }}></i>
                    </label>
                  )}
                </div>
              )}
            </div>

            <button type="submit" style={{ ...styles.submitBtn, opacity: isSubmitting ? 0.6 : 1 }} disabled={isSubmitting}>
              {isSubmitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Submitting...</> : <><i className="fa-solid fa-paper-plane"></i> Submit Feedback</>}
            </button>
          </form>
        </div>

        <p style={styles.footer}>Your feedback helps us make the app better for everyone.</p>
      </section>
      )
}
