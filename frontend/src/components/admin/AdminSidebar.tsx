import { Link, useLocation } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Building2,
  Banknote,
  LogOut,
  Megaphone,
  Key,
  MessageSquareText,
  Users,
  CalendarDays,
  FileText,
  Moon,
  Sun,
  Monitor
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useNavigate } from "@tanstack/react-router"
import { useTheme } from "../ThemeProvider"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function AdminSidebar({ className }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()

  const handleLogout = () => {
    localStorage.removeItem("admin_token")
    navigate({ to: "/admin/login" })
  }

  const items = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/admin/dashboard",
    },
    {
      title: "Users",
      icon: Users,
      href: "/admin/users",
    },
    {
      title: "Companies",
      icon: Building2,
      href: "/admin/companies",
    },
    {
      title: "Blogs",
      icon: FileText,
      href: "/admin/blogs",
    },
    {
      title: "Prices",
      icon: Banknote,
      href: "/admin/prices",
    },
    {
      title: "IPOs",
      icon: Megaphone,
      href: "/admin/ipos",
    },
    {
      title: "Dividends",
      icon: Banknote,
      href: "/admin/dividends",
    },
    {
      title: "API Keys",
      icon: Key,
      href: "/admin/api-keys",
    },
    {
      title: "Feedback",
      icon: MessageSquareText,
      href: "/admin/feedback",
    },
    {
      title: "Holidays",
      icon: CalendarDays,
      href: "/admin/holidays",
    },
  ]


  return (
    <div className={cn("pb-12 min-h-screen border-r bg-background", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Nepse Admin
          </h2>
          <div className="space-y-1">
            {items.map((item) => (
              <Button
                key={item.href}
                variant={location.pathname === item.href ? "secondary" : "ghost"}
                className="w-full justify-start"
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        <div className="px-3 py-2 mt-auto border-t">
          <div className="flex items-center justify-around p-1 bg-muted/50 rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", theme === "light" && "bg-background shadow-sm")}
              onClick={() => setTheme("light")}
              title="Light Mode"
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", theme === "dark" && "bg-background shadow-sm")}
              onClick={() => setTheme("dark")}
              title="Dark Mode"
            >
              <Moon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", theme === "system" && "bg-background shadow-sm")}
              onClick={() => setTheme("system")}
              title="System Theme"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 mt-2">
            <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
