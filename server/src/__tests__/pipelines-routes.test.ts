import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  createDb,
  documents,
  documentRevisions,
  issues,
  pipelineAutomationExecutions,
  pipelineCaseBlockers,
  pipelineCaseEvents,
  pipelineCaseIssueLinks,
  pipelineCases,
  pipelineDocuments,
  pipelineStages,
  pipelineTransitions,
  pipelines,
  routines,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { errorHandler } from "../middleware/error-handler.js";
import { pipelineRoutes } from "../routes/pipelines.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe.sequential : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres pipeline route tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("pipeline routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-pipelines-routes-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(pipelineAutomationExecutions);
    await db.delete(pipelineCaseBlockers);
    await db.delete(pipelineCaseIssueLinks);
    await db.delete(pipelineCaseEvents);
    await db.delete(pipelineCases);
    await db.delete(pipelineTransitions);
    await db.delete(pipelineStages);
    await db.delete(pipelineDocuments);
    await db.delete(documentRevisions);
    await db.delete(documents);
    await db.delete(issues);
    await db.delete(pipelines);
    await db.delete(routines);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  function app(actor: Express.Request["actor"]) {
    const instance = express();
    instance.use(express.json());
    instance.use((req, _res, next) => {
      req.actor = actor;
      next();
    });
    instance.use("/api", pipelineRoutes(db));
    instance.use(errorHandler);
    return instance;
  }

  async function seedCompany(name = "Pipeline Co") {
    const [company] = await db.insert(companies).values({
      name,
      issuePrefix: `P${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    }).returning();
    return company!;
  }

  const boardActor: Express.Request["actor"] = {
    type: "board",
    userId: "board-user",
    source: "local_implicit",
    isInstanceAdmin: true,
  };

  it("exposes the pipeline and case route surface", async () => {
    const company = await seedCompany();
    const http = request(app(boardActor));

    const createdPipeline = await http
      .post(`/api/companies/${company.id}/pipelines`)
      .send({
        key: "content",
        name: "Content",
        stages: [
          { key: "intake", name: "Intake", kind: "open", position: 100 },
          {
            key: "review",
            name: "Review",
            kind: "review",
            position: 200,
            config: { approveToStageKey: "done", rejectToStageKey: "cancelled", requireRejectReason: true },
          },
          { key: "done", name: "Done", kind: "done", position: 900 },
          { key: "cancelled", name: "Cancelled", kind: "cancelled", position: 1000 },
        ],
      })
      .expect(201);
    const pipelineId = createdPipeline.body.id;
    const stageId = createdPipeline.body.stages[0].id;

    await http.get(`/api/companies/${company.id}/pipelines`).expect(200);
    await http.get(`/api/pipelines/${pipelineId}`).expect(200);
    await http.patch(`/api/pipelines/${pipelineId}`).send({ name: "Content Ops", enforceTransitions: true }).expect(200);
    const qaStage = await http
      .post(`/api/pipelines/${pipelineId}/stages`)
      .send({ key: "qa", name: "QA", kind: "working", position: 300 })
      .expect(201);
    await http.patch(`/api/pipelines/${pipelineId}/stages/${qaStage.body.id}`).send({ name: "QA pass" }).expect(200);
    await http
      .put(`/api/pipelines/${pipelineId}/transitions`)
      .send({ enforceTransitions: false, transitions: [{ fromStageKey: "intake", toStageKey: "review" }] })
      .expect(200);
    await http.put(`/api/pipelines/${pipelineId}/documents/guidance`).send({ body: "Use the rubric." }).expect(200);
    await http.get(`/api/pipelines/${pipelineId}/documents/guidance`).expect(200);

    const ingested = await http
      .post(`/api/pipelines/${pipelineId}/cases`)
      .send({ caseKey: "case-1", title: "Case 1", fields: { channel: "blog" } })
      .expect(201);
    const caseId = ingested.body.case.id;
    await http
      .post(`/api/pipelines/${pipelineId}/cases/batch`)
      .send({ items: [{ caseKey: "case-2", title: "Case 2" }, { caseKey: "case-3", title: "Case 3" }] })
      .expect(200);
    await http.get(`/api/pipelines/${pipelineId}/cases`).expect(200);
    await http.get(`/api/cases/${caseId}`).expect(200);
    await http.patch(`/api/cases/${caseId}`).send({ title: "Case 1 updated", expectedVersion: 1 }).expect(200);
    const claimed = await http.post(`/api/cases/${caseId}/claim`).send({ leaseSeconds: 60 }).expect(200);
    await http.post(`/api/cases/${caseId}/release`).send({ leaseToken: claimed.body.leaseToken }).expect(200);
    const suggestion = await http
      .post(`/api/cases/${caseId}/suggest-transition`)
      .send({ toStageKey: "review", rationale: "Ready for review" })
      .expect(200);
    await http
      .post(`/api/cases/${caseId}/resolve-suggestion`)
      .send({ suggestionId: suggestion.body.suggestion.id, resolution: "accept", expectedVersion: 2 })
      .expect(200);
    await http.get(`/api/cases/${caseId}/events`).expect(200);
    await http.get(`/api/companies/${company.id}/review-cases`).expect(200);
    await http.post(`/api/cases/${caseId}/review`).send({ decision: "approve", expectedVersion: 3 }).expect(200);

    const reviewCase = await http
      .post(`/api/pipelines/${pipelineId}/cases`)
      .send({ caseKey: "case-review", title: "Bulk review" })
      .expect(201);
    await http
      .post(`/api/cases/${reviewCase.body.case.id}/transition`)
      .send({ toStageKey: "review", expectedVersion: 1 })
      .expect(200);
    await http
      .post(`/api/companies/${company.id}/review-cases/bulk`)
      .send({ items: [{ caseId: reviewCase.body.case.id, decision: "reject", reason: "Not useful", expectedVersion: 2 }] })
      .expect(200);

    const blocker = await http.post(`/api/pipelines/${pipelineId}/cases`).send({ caseKey: "blocker", title: "Blocker" }).expect(201);
    const blocked = await http.post(`/api/pipelines/${pipelineId}/cases`).send({ caseKey: "blocked", title: "Blocked" }).expect(201);
    await http
      .put(`/api/cases/${blocked.body.case.id}/blockers`)
      .send({ blockedByCaseIds: [blocker.body.case.id] })
      .expect(200);
    await http.get(`/api/cases/${blocked.body.case.id}/rollup`).expect(200);
    await http.get(`/api/cases/${blocked.body.case.id}/context-pack`).expect(200);
    await http.post(`/api/cases/${blocked.body.case.id}/open-conversation`).expect(201);

    const [agent] = await db.insert(agents).values({
      companyId: company.id,
      name: "Routine Agent",
      role: "engineer",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    }).returning();
    const [routine] = await db.insert(routines).values({ companyId: company.id, title: "Routine", assigneeAgentId: agent!.id }).returning();
    await db.insert(pipelineAutomationExecutions).values({
      companyId: company.id,
      caseId: blocked.body.case.id,
      automationId: "retry-me",
      triggeringEventId: randomUUID(),
      routineId: routine!.id,
      status: "failed",
      error: "boom",
    });
    await http.post(`/api/cases/${blocked.body.case.id}/automations/retry-me/retry`).expect(200);

    await http.delete(`/api/pipelines/${pipelineId}/stages/${stageId}?moveCasesToStageId=${qaStage.body.id}`).expect(200);
  });

  it("returns 404 for cross-company pipeline access", async () => {
    const company = await seedCompany();
    const [pipeline] = await db.insert(pipelines).values({ companyId: company.id, key: "x", name: "X" }).returning();
    const otherAgent: Express.Request["actor"] = {
      type: "agent",
      agentId: randomUUID(),
      companyId: randomUUID(),
      runId: randomUUID(),
      source: "agent_key",
    };

    const res = await request(app(otherAgent)).get(`/api/pipelines/${pipeline!.id}`);
    expect(res.status).toBe(404);
  });

  it("rejects agent mutations without a run id", async () => {
    const company = await seedCompany();
    const agentActor: Express.Request["actor"] = {
      type: "agent",
      agentId: randomUUID(),
      companyId: company.id,
      source: "agent_key",
    };

    const res = await request(app(agentActor))
      .post(`/api/companies/${company.id}/pipelines`)
      .send({ key: "agent", name: "Agent pipeline" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("run_id_required");
  });

  it("rejects agent exits from human review stages", async () => {
    const company = await seedCompany();
    const http = request(app(boardActor));
    const pipelineRes = await http
      .post(`/api/companies/${company.id}/pipelines`)
      .send({
        key: "review-authz",
        name: "Review authz",
        stages: [
          { key: "intake", name: "Intake", kind: "open", position: 100 },
          { key: "review", name: "Review", kind: "review", position: 200, config: { approveToStageKey: "done", rejectToStageKey: "cancelled" } },
          { key: "done", name: "Done", kind: "done", position: 900 },
          { key: "cancelled", name: "Cancelled", kind: "cancelled", position: 1000 },
        ],
      })
      .expect(201);
    const caseRes = await http.post(`/api/pipelines/${pipelineRes.body.id}/cases`).send({ caseKey: "review", title: "Review me" }).expect(201);
    await http.post(`/api/cases/${caseRes.body.case.id}/transition`).send({ toStageKey: "review", expectedVersion: 1 }).expect(200);

    const agentActor: Express.Request["actor"] = {
      type: "agent",
      agentId: randomUUID(),
      companyId: company.id,
      runId: randomUUID(),
      source: "agent_key",
    };
    const res = await request(app(agentActor))
      .post(`/api/cases/${caseRes.body.case.id}/transition`)
      .send({ toStageKey: "done", expectedVersion: 2 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("review_required");
  });

  it("returns conflict bodies with code, current version, and stage", async () => {
    const company = await seedCompany();
    const http = request(app(boardActor));
    const pipelineRes = await http.post(`/api/companies/${company.id}/pipelines`).send({ key: "conflict", name: "Conflict" }).expect(201);
    const caseRes = await http.post(`/api/pipelines/${pipelineRes.body.id}/cases`).send({ caseKey: "conflict", title: "Conflict" }).expect(201);
    await http.patch(`/api/cases/${caseRes.body.case.id}`).send({ title: "Updated", expectedVersion: 1 }).expect(200);

    const res = await http.patch(`/api/cases/${caseRes.body.case.id}`).send({ title: "Stale", expectedVersion: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("version_conflict");
    expect(res.body.details.version).toBe(2);
    expect(res.body.details.stage.key).toBe("intake");
  });
});
