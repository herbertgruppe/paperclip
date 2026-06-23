import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, CircleDot, GitBranch, ListChecks, Settings } from "lucide-react";
import { Link, Navigate, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { pipelinesApi, type PipelineCaseRow, type PipelineListItem, type PipelineStage } from "../api/pipelines";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { cn, relativeTime } from "../lib/utils";

export function Pipelines() {
  const { pipelineId } = useParams<{ pipelineId?: string }>();
  return pipelineId ? <PipelineDetailView pipelineId={pipelineId} /> : <PipelineListView />;
}

export function PipelineItemDetail() {
  const { pipelineId, caseId } = useParams<{ pipelineId?: string; caseId?: string }>();
  const { setBreadcrumbs } = useBreadcrumbs();
  const caseQuery = useQuery({
    queryKey: ["pipelines", "case", caseId],
    queryFn: () => pipelinesApi.getCase(caseId!),
    enabled: !!caseId,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Pipelines", href: "/pipelines" },
      {
        label: caseQuery.data?.pipeline.name ?? "Pipeline",
        href: pipelineId ? `/pipelines/${pipelineId}` : "/pipelines",
      },
      { label: caseQuery.data?.case.title ?? "Item" },
    ]);
  }, [caseQuery.data?.case.title, caseQuery.data?.pipeline.name, pipelineId, setBreadcrumbs]);

  if (!caseId) return <EmptyState icon={CircleDot} message="Choose a pipeline item to inspect." />;
  if (caseQuery.isLoading) return <PageSkeleton variant="detail" />;
  if (caseQuery.isError || !caseQuery.data) {
    return <EmptyState icon={CircleDot} message="This pipeline item could not be loaded." />;
  }

  const detail = caseQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <Link className="hover:underline" to={`/pipelines/${detail.pipeline.id}`}>
              {detail.pipeline.name}
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">{detail.case.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-sm border border-border px-2 py-1">{detail.stage.name}</span>
            {detail.case.caseKey ? <span className="rounded-sm border border-border px-2 py-1">{detail.case.caseKey}</span> : null}
            {detail.case.version ? <span className="rounded-sm border border-border px-2 py-1">v{detail.case.version}</span> : null}
          </div>
        </div>
      </div>

      {detail.case.summary ? (
        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium">Summary</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{detail.case.summary}</p>
        </section>
      ) : null}

      <section className="rounded-md border border-border">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Fields</h2>
        </div>
        <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          {Object.entries(detail.case.fields ?? {}).length > 0 ? (
            Object.entries(detail.case.fields ?? {}).map(([key, value]) => (
              <div key={key}>
                <div className="text-xs text-muted-foreground">{key}</div>
                <div className="mt-1 break-words">{formatFieldValue(value)}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No custom fields.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export function PipelineItemLegacyRedirect() {
  const { pipelineId, caseId } = useParams<{ pipelineId?: string; caseId?: string }>();
  if (!pipelineId || !caseId) return <Navigate to="/pipelines" replace />;
  return <Navigate to={`/pipelines/${pipelineId}/items/${caseId}`} replace />;
}

export function ReviewQueue() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "list", selectedCompanyId],
    queryFn: () => pipelinesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Review Queue" }]);
  }, [setBreadcrumbs]);

  if (pipelinesQuery.isLoading) return <PageSkeleton variant="list" />;
  return (
    <PipelineUtilityPage
      icon={ListChecks}
      title="Review queue"
      description="Review queues are part of each pipeline. Choose a pipeline to inspect its current items."
      pipelines={pipelinesQuery.data ?? []}
    />
  );
}

export function Learnings() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "list", selectedCompanyId],
    queryFn: () => pipelinesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Learnings" }]);
  }, [setBreadcrumbs]);

  if (pipelinesQuery.isLoading) return <PageSkeleton variant="list" />;
  return (
    <PipelineUtilityPage
      icon={BookOpenText}
      title="Learnings"
      description="Pipeline learnings are attached to pipeline activity. Choose a pipeline to inspect its items and stages."
      pipelines={pipelinesQuery.data ?? []}
    />
  );
}

function PipelineListView() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "list", selectedCompanyId],
    queryFn: () => pipelinesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Pipelines" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) return <EmptyState icon={GitBranch} message="Choose a company to see pipelines." />;
  if (pipelinesQuery.isLoading) return <PageSkeleton variant="list" />;
  if (pipelinesQuery.isError) return <EmptyState icon={GitBranch} message="Pipelines could not be loaded." />;

  const pipelines = pipelinesQuery.data ?? [];
  if (pipelines.length === 0) return <EmptyState icon={GitBranch} message="No pipelines found for this company." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Pipelines</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pipeline boards and their current work items.</p>
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {pipelines.map((pipeline) => (
          <Link
            key={pipeline.id}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
            to={`/pipelines/${pipeline.id}`}
          >
            <PipelineTitle pipeline={pipeline} />
            <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
              <span>{pipeline.stageCount} stages</span>
              <span>{pipeline.openCaseCount} open</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PipelineDetailView({ pipelineId }: { pipelineId: string }) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const pipelineQuery = useQuery({
    queryKey: ["pipelines", "detail", pipelineId],
    queryFn: () => pipelinesApi.get(pipelineId),
  });
  const casesQuery = useQuery({
    queryKey: ["pipelines", "cases", pipelineId],
    queryFn: () => pipelinesApi.listCases(pipelineId),
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Pipelines", href: "/pipelines" },
      { label: pipelineQuery.data?.name ?? "Pipeline" },
    ]);
  }, [pipelineQuery.data?.name, setBreadcrumbs]);

  if (pipelineQuery.isLoading || casesQuery.isLoading) return <PageSkeleton variant="detail" />;
  if (pipelineQuery.isError || !pipelineQuery.data) {
    return <EmptyState icon={GitBranch} message="This pipeline could not be loaded." />;
  }

  const pipeline = pipelineQuery.data;
  const cases = casesQuery.data ?? [];
  const casesByStage = groupCasesByStage(cases, pipeline.stages);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span>{pipeline.key}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">{pipeline.name}</h1>
          {pipeline.description ? (
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{pipeline.description}</p>
          ) : null}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/pipelines/${pipeline.id}/settings`}>
            <Settings className="mr-1.5 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Stages" value={pipeline.stages.length} />
        <Metric label="Open items" value={cases.filter((row) => !row.case.terminalKind).length} />
        <Metric label="Completed items" value={cases.filter((row) => !!row.case.terminalKind).length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {pipeline.stages.map((stage) => (
          <section key={stage.id} className="min-w-0 rounded-md border border-border">
            <div className="border-b border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium">{stage.name}</h2>
                  <p className="truncate text-xs text-muted-foreground">{stage.key}</p>
                </div>
                <span className="rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">{stage.kind}</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {(casesByStage.get(stage.id) ?? []).map((row) => (
                <PipelineCaseCard key={row.case.id} row={row} pipelineId={pipeline.id} />
              ))}
              {(casesByStage.get(stage.id) ?? []).length === 0 ? (
                <div className="px-3 py-5 text-sm text-muted-foreground">No items in this stage.</div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PipelineCaseCard({ row, pipelineId }: { row: PipelineCaseRow; pipelineId: string }) {
  return (
    <Link
      className={cn(
        "block px-3 py-3 transition-colors hover:bg-accent/50",
        row.case.terminalKind ? "text-muted-foreground" : "text-foreground",
      )}
      to={`/pipelines/${pipelineId}/items/${row.case.id}`}
    >
      <div className="line-clamp-2 text-sm font-medium">{row.case.title}</div>
      {row.case.summary ? (
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.case.summary}</div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {row.case.caseKey ? <span>{row.case.caseKey}</span> : null}
        {row.case.updatedAt ? <span>{relativeTime(row.case.updatedAt)}</span> : null}
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PipelineTitle({ pipeline }: { pipeline: PipelineListItem }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{pipeline.name}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{pipeline.description || pipeline.key}</div>
    </div>
  );
}

function PipelineUtilityPage({
  icon: Icon,
  title,
  description,
  pipelines,
}: {
  icon: typeof GitBranch;
  title: string;
  description: string;
  pipelines: PipelineListItem[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>Pipelines</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {pipelines.length > 0 ? (
        <div className="divide-y divide-border rounded-md border border-border">
          {pipelines.map((pipeline) => (
            <Link key={pipeline.id} className="block px-4 py-3 hover:bg-accent/50" to={`/pipelines/${pipeline.id}`}>
              <PipelineTitle pipeline={pipeline} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={GitBranch} message="No pipelines found for this company." />
      )}
    </div>
  );
}

function groupCasesByStage(rows: PipelineCaseRow[], stages: PipelineStage[]) {
  const byStage = new Map(stages.map((stage) => [stage.id, [] as PipelineCaseRow[]]));
  for (const row of rows) {
    if (!row.stage?.id) continue;
    const stageRows = byStage.get(row.stage.id) ?? [];
    stageRows.push(row);
    byStage.set(row.stage.id, stageRows);
  }
  return byStage;
}

function formatFieldValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
