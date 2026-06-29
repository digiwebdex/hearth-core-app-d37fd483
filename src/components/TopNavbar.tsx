import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import NotificationBell from "@/components/NotificationBell";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const TopNavbar = () => {
  const { user } = useAuth();
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U";

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <NotificationBell />
        <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
};

export default TopNavbar;
