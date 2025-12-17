import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"

export default function Landing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <h1 className="text-4xl font-bold mb-8">Nepse Portfolio Admin</h1>
      <p className="mb-8 text-muted-foreground text-center max-w-md">
        Manage your portfolio scraper and view collected data.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link to="/admin/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
      <div className="mt-8 text-sm text-muted-foreground">
        <a href="/" className="underline hover:text-primary">Back to Landing Page</a>
      </div>
    </div>
  )
}
