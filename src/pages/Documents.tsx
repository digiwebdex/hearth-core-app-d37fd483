import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { documentHubApi, type HubDocument } from "@/lib/api";
import { ExternalLink, FileText, FolderOpen, Plane, Search, UserCheck } from "lucide-react";

type SourceFilter = "all" | "client" | "booking";

const Documents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<HubDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await documentHubApi.list();
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("documentsHub.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((doc) => {
      if (sourceFilter !== "all" && doc.source !== sourceFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.sourceLabel.toLowerCase().includes(q) ||
        doc.type.toLowerCase().includes(q)
      );
    });
  }, [items, search, sourceFilter]);

  const counts = useMemo(
    () => ({
      all: items.length,
      client: items.filter((d) => d.source === "client").length,
      booking: items.filter((d) => d.source === "booking").length,
    }),
    [items],
  );

  const openSource = (doc: HubDocument) => {
    if (doc.source === "client") navigate(`/clients/${doc.sourceId}`);
    else navigate(`/bookings/${doc.sourceId}?tab=documents`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-8 w-8" />
            {t("documentsHub.title")}
          </h1>
          <p className="text-muted-foreground">{t("documentsHub.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "client", "booking"] as SourceFilter[]).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={sourceFilter === key ? "default" : "outline"}
              onClick={() => setSourceFilter(key)}
            >
              {t(`documentsHub.filters.${key}`)} ({counts[key]})
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder={t("documentsHub.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <LoadingState rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("documentsHub.emptyTitle")}
            description={t("documentsHub.emptyDesc")}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("documentsHub.file")}</TableHead>
                    <TableHead>{t("documentsHub.source")}</TableHead>
                    <TableHead>{t("documentsHub.type")}</TableHead>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead className="w-[140px]">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((doc) => (
                    <TableRow key={`${doc.source}-${doc.id}`}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-left hover:underline"
                          onClick={() => openSource(doc)}
                        >
                          {doc.source === "client" ? (
                            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span>{doc.sourceLabel}</span>
                          <Badge variant="outline" className="text-[10px] ml-1">
                            {t(`documentsHub.sourceTypes.${doc.source}`)}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>{doc.type || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(doc.uploadedAt), "PP p")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              {t("documentsHub.open")}
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">
          {t("documentsHub.uploadHint")}{" "}
          <Link to="/clients" className="underline">{t("sidebar.clients")}</Link>
          {" · "}
          <Link to="/bookings" className="underline">{t("sidebar.bookings")}</Link>
        </p>
      </div>
    </DashboardLayout>
  );
};

export default Documents;
