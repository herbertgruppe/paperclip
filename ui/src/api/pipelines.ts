import { api } from "./client";

export interface PipelineListItem {
  id: string;
  companyId: string;
  key: string;
  name: string;
  description: string | null;
  projectId: string | null;
  enforceTransitions: boolean;
  archivedAt: Date | string | null;
  stageCount: number;
  openCaseCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  key: string;
  name: string;
  kind: string;
  position: number;
  config?: Record<string, unknown> | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PipelineDetail extends PipelineListItem {
  stages: PipelineStage[];
  transitions: Array<{
    fromStageId: string;
    toStageId: string;
    label?: string | null;
  }>;
  documentKeys?: Array<{ key: string; documentId: string }>;
}

export interface PipelineCase {
  id: string;
  companyId?: string;
  pipelineId: string;
  stageId: string | null;
  caseKey?: string | null;
  title: string;
  summary?: string | null;
  fields?: Record<string, unknown> | null;
  workspaceRef?: Record<string, unknown> | null;
  parentCaseId?: string | null;
  version?: number;
  terminalKind?: string | null;
  terminalAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PipelineCaseRow {
  case: PipelineCase;
  stage: PipelineStage;
}

export interface PipelineCaseDetail extends PipelineCaseRow {
  pipeline: PipelineDetail;
  allowedNextStages: PipelineStage[];
  links?: unknown[];
  blockers?: unknown[];
  blocks?: unknown[];
  childrenSummary?: {
    childCount: number;
    terminalChildCount: number;
    loadedChildren: number;
  };
}

export const pipelinesApi = {
  list: (companyId: string) => api.get<PipelineListItem[]>(`/companies/${companyId}/pipelines`),
  get: (pipelineId: string) => api.get<PipelineDetail>(`/pipelines/${pipelineId}`),
  listCases: (pipelineId: string) => api.get<PipelineCaseRow[]>(`/pipelines/${pipelineId}/cases`),
  getCase: (caseId: string) => api.get<PipelineCaseDetail>(`/cases/${caseId}`),
};
