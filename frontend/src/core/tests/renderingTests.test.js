import { describe, it, expect } from "vitest";
import {
  getSlideSize,
  getVisibleSlides,
  getTextElements,
  getMediaElements,
  escapeHtml,
} from "../render/slidesetRenderUtils";
import {
  buildTextElementStyle,
  buildMediaContainerStyle,
  buildMediaInnerStyle,
  buildMediaFilterStyle,
  buildMediaBorderOverlayStyle,
  buildMediaReflectionStyle,
  buildMediaReflectionContentStyle,
  buildSlideContainerStyle,
  getTextContent,
  getRevealTransition,
} from "../render/revealRenderer";


function makePresentationWith(masterOverrides = {}, slides = []) {
  return {
    slideset: {
      master: {
        "slide-dimensions": { width: 1280, height: 720 },
        "aspect-ratio": "16:9",
        ...masterOverrides,
      },
      slides,
    },
  };
}

function makeSlide(overrides = {}) {
  return {
    hidden: false,
    contents: {
      transition: "slide",
      background: "white",
      text: [],
      media: [],
    },
    ...overrides,
  };
}

function makeTextElement(overrides = {}) {
  return {
    id: "text-1",
    position: { x: 100, y: 200 },
    width: 400,
    height: 100,
    rotation: 0,
    "z-index": 1,
    background: "transparent",
    overflow: "hidden",
    paragraphs: [
      {
        id: "p-1",
        formatting: { size: "32px", weight: "bold", color: "#000000" },
        runs: [{ text: "Hello World" }],
      },
    ],
    ...overrides,
  };
}


describe("getSlideSize", () => {
  it("returns dimensions from master", () => {
    const presentation = makePresentationWith({
      "slide-dimensions": { width: 1280, height: 720 },
    });
    const { width, height } = getSlideSize(presentation);
    expect(width).toBe(1280);
    expect(height).toBe(720);
  });

  it("returns fallback when no dimensions in master", () => {
    const { width, height } = getSlideSize(null);
    expect(width).toBe(1280);
    expect(height).toBe(720);
  });
});


describe("getVisibleSlides", () => {
  it("returns only visible slides", () => {
    const presentation = makePresentationWith({}, [
      makeSlide({ hidden: false }),
      makeSlide({ hidden: true }),
      makeSlide({ hidden: false }),
    ]);
    const visible = getVisibleSlides(presentation);
    expect(visible.length).toBe(2);
  });

  it("returns empty array when no slides", () => {
    const visible = getVisibleSlides(makePresentationWith({}, []));
    expect(visible.length).toBe(0);
  });

  it("hidden slide is not exported", () => {
    const presentation = makePresentationWith({}, [
      makeSlide({ hidden: true, title: { content: "Secret" } }),
    ]);
    const visible = getVisibleSlides(presentation);
    expect(visible.length).toBe(0);
  });
});


describe("getTextElements", () => {
  it("returns text elements from contents", () => {
    const slide = makeSlide({
      contents: {
        text: [makeTextElement(), makeTextElement({ id: "text-2" })],
        media: [],
      },
    });
    expect(getTextElements(slide).length).toBe(2);
  });

  it("returns empty array for slide with no text", () => {
    const slide = makeSlide();
    expect(getTextElements(slide).length).toBe(0);
  });
});


describe("getMediaElements", () => {
  it("returns media elements from contents", () => {
    const slide = makeSlide({
      contents: {
        text: [],
        media: [
          { id: "img-1", "file-link": "image.png", "media-type": "image",
            position: { x: 0, y: 0 }, width: 200, height: 100 },
        ],
      },
    });
    expect(getMediaElements(slide).length).toBe(1);
  });

  it("returns empty array when no media", () => {
    expect(getMediaElements(makeSlide()).length).toBe(0);
  });
});


describe("buildTextElementStyle", () => {
  it("uses coordinates from text element", () => {
    const style = buildTextElementStyle(makeTextElement());
    expect(style.left).toBe("100px");
    expect(style.top).toBe("200px");
  });

  it("uses width and height from text element", () => {
    const style = buildTextElementStyle(makeTextElement());
    expect(style.width).toBe("400px");
    expect(style.height).toBe("100px");
  });

  it("uses formatting from first paragraph", () => {
    const style = buildTextElementStyle(makeTextElement());
    expect(style.fontSize).toBe("32px");
    expect(style.fontWeight).toBe("bold");
    expect(style.color).toBe("#000000");
  });

  it("resolves font size through master formatting before the fallback", () => {
    const element = makeTextElement({ paragraphs: [{ id: "p", runs: [{ text: "x" }] }] });
    expect(buildTextElementStyle(element, { size: "30px" }).fontSize).toBe("30px");
    expect(buildTextElementStyle(element).fontSize).toBe("24px");
  });

  it("position is absolute", () => {
    const style = buildTextElementStyle(makeTextElement());
    expect(style.position).toBe("absolute");
  });

  it("applies a picture style transform exactly once", () => {
    const media = {
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
      effects: { "style-id": "tilted-right" },
    };
    expect(buildMediaContainerStyle(media).transform).toBe("rotate(3deg)");
  });
});

describe("media effects and reflection styles", () => {
  const media = {
    position: { x: 30, y: 40 },
    width: 200,
    height: 100,
    crop: [10, 20, 30, 5],
    "source-width": 300,
    "source-height": 200,
    effects: {
      brightness: 0.2,
      contrast: -0.1,
      reflectionId: "tight",
    },
  };

  it("combines correction filters", () => {
    expect(buildMediaFilterStyle(media)).toBe("brightness(1.200) contrast(0.900)");
  });

  it("uses crop offsets for the reflected image content", () => {
    const inner = buildMediaInnerStyle(media);
    expect(inner.left).toBe("-15px");
    expect(inner.top).toBe("-20px");
    expect(inner.maxWidth).toBe("none");
    expect(inner.maxHeight).toBe("none");
    expect(inner.margin).toBe(0);
    expect(buildMediaReflectionContentStyle(media).transform).toBe("scaleY(-1)");
  });

  it("covers the frame for legacy negative crop values after presentation scaling", () => {
    const inner = buildMediaInnerStyle({
      width: 526,
      height: 374,
      "source-width": 410,
      "source-height": 346,
      crop: [-8, -28, 0, 0],
    });

    expect(parseFloat(inner.width)).toBeGreaterThanOrEqual(526);
    expect(parseFloat(inner.height)).toBeGreaterThanOrEqual(374);
    expect(inner.left).toBe("0px");
    expect(inner.top).toBe("0px");
  });

  it("positions reflection outside the original media wrapper", () => {
    const reflection = buildMediaReflectionStyle(media);
    expect(reflection?.left).toBe(30);
    expect(reflection?.top).toBeGreaterThanOrEqual(140);
    expect(reflection?.overflow).toBe("hidden");
  });

  it("aligns a reflection with the picture's outer border edges", () => {
    const framedMedia = {
      position: { x: 15, y: 28 },
      width: 320,
      height: 240,
      effects: {
        "style-id": "thick-black",
        reflectionId: "full",
      },
    };
    const globalReflection = buildMediaReflectionStyle(framedMedia);
    const relativeReflection = buildMediaReflectionStyle(framedMedia, { relative: true });
    const reflectedFrame = buildMediaReflectionContentStyle(framedMedia);

    expect(globalReflection?.left).toBe(15);
    expect(globalReflection?.top).toBe(268);
    expect(globalReflection?.width).toBe(320);
    expect(globalReflection?.height).toBe(240);
    expect(relativeReflection?.left).toBe(0);
    expect(relativeReflection?.top).toBe(240);
    expect(reflectedFrame.border).toBeUndefined();
    expect(reflectedFrame.boxSizing).toBe("border-box");
  });

  it("renders picture borders as overlays without changing image layout", () => {
    const framedMedia = {
      width: 320,
      height: 180,
      effects: { "style-id": "thick-black" },
    };
    const container = buildMediaContainerStyle(framedMedia);
    const image = buildMediaInnerStyle(framedMedia);
    const border = buildMediaBorderOverlayStyle(framedMedia);

    expect(container.width).toBe("320px");
    expect(container.height).toBe("180px");
    expect(container.border).toBeUndefined();
    expect(image.width).toBe("100%");
    expect(image.height).toBe("100%");
    expect(border?.border).toBe("10px solid #111827");
    expect(border?.boxSizing).toBe("border-box");
  });
});


describe("buildMediaContainerStyle", () => {
  it("uses coordinates from media element", () => {
    const media = { position: { x: 50, y: 60 }, width: 300, height: 200,
      rotation: 0, "z-index": 1 };
    const style = buildMediaContainerStyle(media, 0);
    expect(style.left).toBe("50px");
    expect(style.top).toBe("60px");
  });

  it("position is absolute", () => {
    const media = { position: { x: 0, y: 0 }, width: 100, height: 100 };
    const style = buildMediaContainerStyle(media, 0);
    expect(style.position).toBe("absolute");
  });
});


describe("buildSlideContainerStyle", () => {
  it("sets correct width and height", () => {
    const style = buildSlideContainerStyle(1280, 720);
    expect(style.width).toBe("1280px");
    expect(style.height).toBe("720px");
  });

  it("position is relative", () => {
    const style = buildSlideContainerStyle(1280, 720);
    expect(style.position).toBe("relative");
  });
});


describe("getTextContent", () => {
  it("extracts text from paragraphs and runs", () => {
    const element = makeTextElement();
    expect(getTextContent(element)).toBe("Hello World");
  });

  it("returns empty string for element with no paragraphs", () => {
    expect(getTextContent({ paragraphs: [] })).toBe("");
  });

  it("concatenates multiple runs", () => {
    const element = makeTextElement({
      paragraphs: [{
        id: "p-1",
        runs: [{ text: "Hello " }, { text: "World" }],
      }],
    });
    expect(getTextContent(element)).toBe("Hello World");
  });
});


describe("getRevealTransition", () => {
  it("returns transition from slide", () => {
    const slide = makeSlide({ contents: { transition: "fade" } });
    expect(getRevealTransition(slide)).toBe("fade");
  });

  it("returns default when no transition set", () => {
    const slide = makeSlide({ contents: {} });
    expect(getRevealTransition(slide)).toBe("none");
  });

  it("returns default for invalid transition value", () => {
    const slide = makeSlide({ contents: { transition: "invalid-value" } });
    expect(getRevealTransition(slide)).toBe("none");
  });
});


describe("escapeHtml", () => {
  it("escapes < and >", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes &", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});
