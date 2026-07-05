import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Check, CheckCheck, X, UserPlus, CreditCard, AlertTriangle, Clock, Info, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  adminNotificationApi,
  type AdminNotification,
  type AdminNotificationType,
} from "@/lib/adminNotificationApi";
import { timeAgo } from "@/lib/format";

const typeConfig: Record<AdminNotificationType, { icon: React.ElementType; color: string }> = {
  new_tenant: { icon: UserPlus, color: "text-green-500 bg-green-500/10" },
  payment_request: { icon: CreditCard, color: "text-blue-500 bg-blue-500/10" },
  subscription_expiring: { icon: AlertTriangle, color: "text-amber-500 bg-amber-500/10" },
  subscription_expired: { icon: Clock, color: "text-red-500 bg-red-500/10" },
  tenant_suspended: { icon: Shield, color: "text-red-500 bg-red-500/10" },
  system: { icon: Info, color: "text-muted-foreground bg-muted" },
};

export default function AdminNotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await adminNotificationApi.list();
      setNotifications(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    await adminNotificationApi.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await adminNotificationApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = async (id: string) => {
    await adminNotificationApi.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClick = (n: AdminNotification) => {
    if (!n.read) markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground border-2 border-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Admin Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                <CheckCheck className="mr-1 h-3 w-3" /> Mark all read
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications
            </div>
          ) : (
            <div>
              {notifications.map((n) => {
                const cfg = typeConfig[n.type] || typeConfig.system;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/30 ${
                      !n.read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    <div className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!n.read ? "font-semibold" : "font-medium"}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {!n.read && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                              className="p-1 rounded hover:bg-muted" title="Mark as read"
                            >
                              <Check className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                            className="p-1 rounded hover:bg-muted" title="Delete"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2 text-center">
              <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => { setOpen(false); navigate("/admin"); }}>
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
