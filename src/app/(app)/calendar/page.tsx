import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, addMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type CalEvent = {
  date: Date;
  type: "lease-expiry" | "rent-due" | "maintenance" | "renewal-reminder";
  label: string;
  href: string;
};

async function getCalendarEvents(organizationId: string) {
  const now = new Date();
  const sixMonthsOut = addMonths(now, 6);

  const [activeLeases, openMaintenance] = await Promise.all([
    prisma.lease.findMany({
      where: { organizationId, status: "active" },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, where: { isPrimary: true } },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: { organizationId, status: { in: ["open", "in_progress", "pending_parts"] } },
      include: { unit: { include: { property: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const events: CalEvent[] = [];

  for (const lease of activeLeases) {
    const tenant = lease.tenants[0]?.tenant;
    const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant";
    const unitLabel = `${lease.unit.property.name} · U${lease.unit.unitNumber}`;

    // Rent due dates — current + next 2 months
    for (let m = 0; m < 3; m++) {
      const base = addMonths(now, m);
      const dueDate = new Date(base.getFullYear(), base.getMonth(), lease.paymentDueDay);
      if (dueDate >= now && dueDate <= sixMonthsOut) {
        events.push({ date: dueDate, type: "rent-due", label: `Rent due: ${tenantName} @ ${unitLabel}`, href: `/rent` });
      }
    }

    // Lease expiry
    if (lease.endDate) {
      const expiry = new Date(lease.endDate);
      if (expiry >= now && expiry <= sixMonthsOut) {
        const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
        events.push({ date: expiry, type: "lease-expiry", label: `Lease expires: ${tenantName} @ ${unitLabel}`, href: `/leases/${lease.id}` });
        if (daysLeft <= 90) {
          events.push({ date: addDays(expiry, -30), type: "renewal-reminder", label: `Renewal reminder: ${tenantName} @ ${unitLabel} (${daysLeft}d)`, href: `/renewals/${lease.id}` });
        }
      }
    }
  }

  // Maintenance events
  for (const req of openMaintenance) {
    events.push({
      date: req.createdAt,
      type: "maintenance",
      label: `${req.title}${req.unit ? ` @ ${req.unit.property.name} · U${req.unit.unitNumber}` : ""}`,
      href: `/maintenance/${req.id}`,
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const EVENT_STYLES: Record<string, string> = {
  "lease-expiry": "bg-amber-500/15 text-amber-700 border-amber-200",
  "rent-due": "bg-blue-500/15 text-blue-700 border-blue-200",
  "maintenance": "bg-red-500/15 text-red-600 border-red-200",
  "renewal-reminder": "bg-purple-500/15 text-purple-700 border-purple-200",
};

const EVENT_DOT: Record<string, string> = {
  "lease-expiry": "bg-amber-500",
  "rent-due": "bg-blue-500",
  "maintenance": "bg-red-500",
  "renewal-reminder": "bg-purple-500",
};

const EVENT_LABELS: Record<string, string> = {
  "lease-expiry": "Lease Expiry",
  "rent-due": "Rent Due",
  "maintenance": "Maintenance",
  "renewal-reminder": "Renewal",
};

export default async function CalendarPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const events = await getCalendarEvents(session.user.organizationId);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Build month grid
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun

  // Upcoming events (next 30 days)
  const thirtyDaysOut = addDays(today, 30);
  const upcoming = events.filter((e) => e.date >= today && e.date <= thirtyDaysOut);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {format(now, "MMMM yyyy")}
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${EVENT_DOT[type]}`} />
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Month grid */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {format(now, "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="bg-background p-1 min-h-[52px]" />
              ))}
              {days.map((day) => {
                const dayEvents = events.filter((e) => isSameDay(e.date, day));
                const isToday = isSameDay(day, today);
                const types = [...new Set(dayEvents.map((e) => e.type))];
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "bg-background p-1 min-h-[52px]",
                      !isSameMonth(day, now) && "opacity-30"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5",
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {types.map((type) => (
                        <span key={type} className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT[type]}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming agenda */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Next 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events in the next 30 days.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((event, i) => (
                  <Link key={i} href={event.href}>
                    <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="shrink-0 text-center min-w-[36px]">
                        <p className="text-[10px] text-muted-foreground uppercase">{format(event.date, "MMM")}</p>
                        <p className="text-sm font-bold leading-none">{format(event.date, "d")}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Badge className={`text-[10px] border mb-0.5 ${EVENT_STYLES[event.type]}`}>
                          {EVENT_LABELS[event.type]}
                        </Badge>
                        <p className="text-xs text-foreground/80 line-clamp-2">{event.label}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
