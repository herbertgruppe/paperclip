import { describe, expect, it } from "vitest";
import { queryKeys } from "../lib/queryKeys";
import { groupCasesByBuiltFor, normalizePipelineConversationComments } from "./Pipelines";

describe("groupCasesByBuiltFor", () => {
  it("groups items by the parent case shown as Built for", () => {
    const groups = groupCasesByBuiltFor([
      {
        id: "child-1",
        pipelineId: "content-pipeline",
        stageId: "stage-1",
        title: "API how-to",
        parentCase: {
          case: {
            id: "parent-1",
            caseKey: "feature-checkboxes",
            title: "Checkbox confirmation interactions",
            pipelineId: "features-pipeline",
          },
          pipeline: { id: "features-pipeline", key: "features", name: "Example Features" },
        },
      },
      {
        id: "child-2",
        pipelineId: "content-pipeline",
        stageId: "stage-1",
        title: "Screencast",
        parentCase: {
          case: {
            id: "parent-1",
            caseKey: "feature-checkboxes",
            title: "Checkbox confirmation interactions",
            pipelineId: "features-pipeline",
          },
          pipeline: { id: "features-pipeline", key: "features", name: "Example Features" },
        },
      },
      {
        id: "standalone",
        pipelineId: "content-pipeline",
        stageId: "stage-1",
        title: "Launch blog post",
        parentCase: null,
      },
    ]);

    expect(groups).toEqual([
      {
        key: "parent-1",
        label: "Example Features: Checkbox confirmation interactions",
        href: "/pipelines/features-pipeline/items/parent-1",
        cases: [expect.objectContaining({ id: "child-1" }), expect.objectContaining({ id: "child-2" })],
      },
      {
        key: "__ungrouped",
        label: "No built-for item",
        href: null,
        cases: [expect.objectContaining({ id: "standalone" })],
      },
    ]);
  });
});

describe("pipeline conversation comments", () => {
  it("uses a finite comments key that does not collide with issue detail's infinite comments key", () => {
    expect(queryKeys.issues.commentsList("issue-1")).toEqual(["issues", "comments", "issue-1", "list"]);
    expect(queryKeys.issues.commentsList("issue-1")).not.toEqual(queryKeys.issues.comments("issue-1"));
    expect(queryKeys.issues.commentsList("issue-1").slice(0, 3)).toEqual(queryKeys.issues.comments("issue-1"));
  });

  it("ignores infinite-query comment cache data instead of mapping it as an array", () => {
    expect(
      normalizePipelineConversationComments({
        pages: [[{ id: "comment-1", body: "hello" }]],
        pageParams: [null],
      }),
    ).toEqual([]);
  });
});
