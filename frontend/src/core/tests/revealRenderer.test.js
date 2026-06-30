import { describe, it, expect } from "vitest";
import { getPerLineFragments } from "../render/revealRenderer";
import { buildPStyle } from "../export/exportToReveal";

function makeTextElement(paragraphs) {
  return { id: "el-1", paragraphs };
}

function makeAnimation(sequence = 0, sequenceMode = "by-paragraph") {
  return {
    sequence,
    "effect-options": { sequence: sequenceMode },
  };
}

const lines = ["line one", "line two", "line three"];

describe("getPerLineFragments", () => {
  it("returns null when animation is null", () => {
    const el = makeTextElement([{ runs: [{ text: "a" }] }]);
    expect(getPerLineFragments(el, null, lines)).toBeNull();
  });

  it("returns null for as-one-object sequence mode", () => {
    const el = makeTextElement([{ runs: [{ text: "a" }] }, { runs: [{ text: "b" }] }]);
    const anim = makeAnimation(0, "as-one-object");
    expect(getPerLineFragments(el, anim, lines)).toBeNull();
  });

  it("returns null when lines has one or fewer items", () => {
    const el = makeTextElement([{ runs: [{ text: "a" }] }, { runs: [{ text: "b" }] }]);
    const anim = makeAnimation(0, "by-paragraph");
    expect(getPerLineFragments(el, anim, ["only one line"])).toBeNull();
  });

  it("returns one entry per paragraph (not per line)", () => {
    const el = makeTextElement([
      { formatting: { align: "left" }, runs: [{ text: "First" }] },
      { formatting: { align: "right" }, runs: [{ text: "Second" }] },
    ]);
    const anim = makeAnimation(0, "by-paragraph");
    const result = getPerLineFragments(el, anim, lines);
    expect(result).toHaveLength(2);
  });

  it("returns paragraph objects (not plain text strings)", () => {
    const paragraphs = [
      { formatting: { size: "24px" }, runs: [{ text: "Hello" }] },
      { formatting: { size: "18px" }, runs: [{ text: "World" }] },
    ];
    const el = makeTextElement(paragraphs);
    const anim = makeAnimation(0, "by-paragraph");
    const result = getPerLineFragments(el, anim, lines);
    expect(result[0].paragraph).toEqual(paragraphs[0]);
    expect(result[1].paragraph).toEqual(paragraphs[1]);
  });

  it("each entry has fragmentProps", () => {
    const el = makeTextElement([
      { runs: [{ text: "A" }] },
      { runs: [{ text: "B" }] },
    ]);
    const anim = makeAnimation(0, "by-paragraph");
    const result = getPerLineFragments(el, anim, lines);
    expect(result[0]).toHaveProperty("fragmentProps");
    expect(result[1]).toHaveProperty("fragmentProps");
  });

  it("all-at-once mode assigns same fragment index to all", () => {
    const el = makeTextElement([
      { runs: [{ text: "A" }] },
      { runs: [{ text: "B" }] },
    ]);
    const anim = makeAnimation(2, "all-at-once");
    const result = getPerLineFragments(el, anim, lines);
    const idx0 = result[0].fragmentProps["data-fragment-index"];
    const idx1 = result[1].fragmentProps["data-fragment-index"];
    expect(idx0).toBe(idx1);
  });

  it("by-paragraph mode assigns incremental fragment indices", () => {
    const el = makeTextElement([
      { runs: [{ text: "A" }] },
      { runs: [{ text: "B" }] },
      { runs: [{ text: "C" }] },
    ]);
    const anim = makeAnimation(1, "by-paragraph");
    const result = getPerLineFragments(el, anim, lines);
    const idx0 = Number(result[0].fragmentProps["data-fragment-index"]);
    const idx1 = Number(result[1].fragmentProps["data-fragment-index"]);
    const idx2 = Number(result[2].fragmentProps["data-fragment-index"]);
    expect(idx1).toBe(idx0 + 1);
    expect(idx2).toBe(idx0 + 2);
  });
});

describe("buildPStyle", () => {
  it("includes font-size when size is set", () => {
    const style = buildPStyle({ size: "24px" });
    expect(style).toContain("font-size: 24px");
  });

  it("includes text-align when align is set", () => {
    const style = buildPStyle({ align: "center" });
    expect(style).toContain("text-align: center");
  });

  it("uses default margin when margin not set", () => {
    const style = buildPStyle({});
    expect(style).toContain("margin: 0 0 4px 0");
  });

  it("uses custom margin when margin is set", () => {
    const style = buildPStyle({ margin: "8px 0" });
    expect(style).toContain("margin: 8px 0");
  });

  it("includes padding-left when listPaddingLeft is provided", () => {
    const style = buildPStyle({}, "2em");
    expect(style).toContain("padding-left: 2em");
  });

  it("uses the same Before text indentation as the editor renderer", () => {
    const style = buildPStyle({ "before-text": 36 });
    expect(style).toContain("padding-left: 36px");
  });

  it("keeps legacy non-list indent levels compatible", () => {
    const style = buildPStyle({ "indent-level": 2 });
    expect(style).toContain("padding-left: 48px");
  });

  it("produces no font-size when size is not set", () => {
    const style = buildPStyle({ align: "left" });
    expect(style).not.toContain("font-size");
  });
});
