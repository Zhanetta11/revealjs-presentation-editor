import { describe, expect, test } from "vitest";
import {
  PresentationSourceKind,
  PresentationSourceStatus,
  createCommittingSource,
  createDraftSource,
  createProjectSource,
  normalizePresentationSource,
} from "../persistence/sourceMetadata";

describe("presentation source metadata", () => {
  test("creates an explicit draft descriptor", () => {
    expect(createDraftSource("draft-id")).toEqual({
      kind: PresentationSourceKind.DRAFT,
      presentationId: "draft-id",
      projectFolder: null,
      status: PresentationSourceStatus.DRAFT,
    });
  });

  test("normalizes a valid persisted project descriptor", () => {
    expect(normalizePresentationSource({
      kind: "project",
      presentationId: "project-id",
      projectFolder: "C:\\Presentations\\Quarterly",
      status: "project",
    })).toEqual(createProjectSource(
      "project-id",
      "C:\\Presentations\\Quarterly",
    ));
  });

  test("treats incomplete or legacy-only metadata as a draft", () => {
    expect(normalizePresentationSource({
      presentationId: "legacy-id",
      linked: true,
    }, "legacy-id")).toEqual(createDraftSource("legacy-id"));
  });

  test("represents an in-progress source transition without marking it committed", () => {
    expect(normalizePresentationSource(
      createCommittingSource("transition-id", "C:\\Presentations\\New"),
    )).toEqual({
      kind: PresentationSourceKind.PROJECT,
      presentationId: "transition-id",
      projectFolder: "C:\\Presentations\\New",
      status: PresentationSourceStatus.COMMITTING,
    });
  });
});
