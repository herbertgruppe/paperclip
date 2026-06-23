import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, Settings } from "lucide-react";
import { Link, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { pipelinesApi } from "../api/pipelines";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

export function PipelineSettings() {
  const { pipelineId } = useParams<{ pipelineId?: string }>();
  const { setBreadcrumbs } = useBreadcrumbs();
  const pipelineQuery = useQuery({
    queryKey: ["pipelines", "detail", pipelineId],
    queryFn: () => pipelinesApi.get(pipelineId!),
    enabled: !!pipelineId,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Pipelines", href: "/pipelines" },
      { label: pipelineQuery.data?.name ?? "Settings" },
    ]);
  }, [pipelineQuery.data?.name, setBreadcrumbs]);

  if (!pipelineId) {
    return <EmptyState icon={GitBranch} message="Choose a pipeline to see its settings." />;
  }

  if (pipelineQuery.isLoading) return <PageSkeleton variant="detail" />;
  if (pipelineQuery.isError || !pipelineQuery.data) {
    return <EmptyState icon={Settings} message="Pipeline settings could not be loaded." />;
  }

  const pipeline = pipelineQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <Link className="hover:underline" to={`/pipelines/${pipeline.id}`}>
              {pipeline.name}
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">Pipeline settings</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/pipelines/${pipeline.id}`}>Back to pipeline</Link>
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <div className="grid gap-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyField label="Key" value={pipeline.key} />
          <ReadOnlyField label="Stages" value={String(pipeline.stages.length)} />
          <ReadOnlyField label="Open items" value={String(pipeline.openCaseCount ?? 0)} />
          <ReadOnlyField label="Transitions" value={pipeline.enforceTransitions ? "Enforced" : "Flexible"} />
        </div>
      </div>

      <div className="rounded-md border border-border">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Stages</h2>
        </div>
        <div className="divide-y divide-border">
          {pipeline.stages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{stage.name}</div>
                <div className="text-xs text-muted-foreground">{stage.key}</div>
              </div>
              <span className="rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">{stage.kind}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
