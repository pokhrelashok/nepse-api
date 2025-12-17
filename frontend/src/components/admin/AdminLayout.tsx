import { Outlet, useRouter } from "@tanstack/react-router"
import { AdminSidebar } from "./AdminSidebar"
import { useEffect } from "react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

export default function AdminLayout() {
  const router = useRouter()

  useEffect(() => {
    // Double check auth here or trust the route beforeLoad
    const token = localStorage.getItem("admin_token")
    if (!token) {
      router.navigate({ to: "/admin/login" })
    }
  }, [router])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-zinc-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 md:block">
        <AdminSidebar className="h-full" />
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center p-4 border-b bg-background">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <AdminSidebar />
            </SheetContent>
          </Sheet>
          <span className="ml-4 font-bold">Nepse Admin</span>
        </header>

        {/* Main Content Info Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
