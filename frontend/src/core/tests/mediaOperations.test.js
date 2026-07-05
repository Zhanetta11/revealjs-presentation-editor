import { describe, test, expect } from "vitest";
import {
  addMedia,
  clampCrop,
  clampCropEdges,
  clampCropPan,
  computeCropOrigin,
  computeCropResult,
  deleteMedia,
  updateMedia,
} from "../operations/mediaOperations";

import {
  resizeElement,
  updateElement,
} from "../operations/elementOperations";

describe("mediaOperations", () => {
  const createPresentation = () => ({
    slideset: {
      slides: [
        {
          id: "slide-1",
          contents: {
            text: [],
            media: [],
          },
        },
      ],
    },
  });

  test("addMedia adds media element to slide", () => {
    const presentation = createPresentation();

    const updated = addMedia(presentation, 0, {
      id: "media-1",
      "file-link": "image.png",
      "media-type": "image",
    });

    expect(
      updated.slideset.slides[0].contents.media
    ).toHaveLength(1);

    expect(
      updated.slideset.slides[0].contents.media[0].id
    ).toBe("media-1");
  });

  test("deleteMedia removes media element", () => {
    const presentation = addMedia(
      createPresentation(),
      0,
      {
        id: "media-1",
        "file-link": "image.png",
      }
    );

    const updated = deleteMedia(
      presentation,
      0,
      "media-1"
    );

    expect(
      updated.slideset.slides[0].contents.media
    ).toHaveLength(0);
  });

  test("updateMedia updates media properties", () => {
    const presentation = addMedia(
      createPresentation(),
      0,
      {
        id: "media-1",
        "file-link": "image.png",
      }
    );

    const updated = updateMedia(
      presentation,
      0,
      "media-1",
      {
        rotation: 90,
      }
    );

    expect(
      updated.slideset.slides[0].contents.media[0].rotation
    ).toBe(90);
  });

  test("updateMedia preserves explicit crop updates when the crop changes the visible frame", () => {
    const presentation = addMedia(
      createPresentation(),
      0,
      {
        id: "media-1",
        "file-link": "image.png",
        width: 300,
        height: 200,
        "source-width": 300,
        "source-height": 200,
        crop: [],
      }
    );
    const media = presentation.slideset.slides[0].contents.media[0];
    const cropUpdates = computeCropResult(
      [0, 25, 0, 0],
      computeCropOrigin(media)
    );

    const updated = updateMedia(
      presentation,
      0,
      "media-1",
      cropUpdates
    );
    const cropped = updated.slideset.slides[0].contents.media[0];

    expect(cropped.crop[0]).toBeCloseTo(0);
    expect(cropped.crop[1]).toBeCloseTo(25);
    expect(cropped.crop[2]).toBeCloseTo(0);
    expect(cropped.crop[3]).toBeCloseTo(0);
    expect(cropped.width).toBeCloseTo(225);
    expect(cropped.height).toBeCloseTo(200);
    expect(cropped["source-width"]).toBeCloseTo(300);
    expect(cropped["source-height"]).toBeCloseTo(200);
  });

  test("updateMedia still normalizes source dimensions for ordinary uncropped resize", () => {
    const presentation = addMedia(
      createPresentation(),
      0,
      {
        id: "media-1",
        "file-link": "image.png",
        width: 300,
        height: 200,
        "source-width": 300,
        "source-height": 200,
        crop: [],
      }
    );

    const updated = updateMedia(
      presentation,
      0,
      "media-1",
      { width: 240, height: 160 }
    );
    const resized = updated.slideset.slides[0].contents.media[0];

    expect(resized.width).toBe(240);
    expect(resized.height).toBe(160);
    expect(resized["source-width"]).toBe(240);
    expect(resized["source-height"]).toBe(160);
    expect(resized.crop).toEqual([]);
  });

  test("updateElement moves media element position", () => {
    const presentation = addMedia(
      createPresentation(),
      0,
      {
        id: "media-1",
        "file-link": "image.png",
        position: { x: 0, y: 0 },
      }
    );

    const updated = updateElement(
      presentation,
      0,
      "media-1",
      { position: { x: 100, y: 200 } }
    );

    expect(
      updated.slideset.slides[0].contents.media[0].position
    ).toEqual({
      x: 100,
      y: 200,
    });
  });

  test("resizeElement resizes media element", () => {
    const presentation = addMedia(
      createPresentation(),
      0,
      {
        id: "media-1",
        width: 300,
        height: 200,
      }
    );

    const updated = resizeElement(
      presentation,
      0,
      "media-1",
      {
        width: 500,
        height: 400,
      }
    );

    expect(
      updated.slideset.slides[0].contents.media[0].width
    ).toBe(500);

    expect(
      updated.slideset.slides[0].contents.media[0].height
    ).toBe(400);
  });

  test("clampCrop keeps every edge inside the source and preserves a visible area", () => {
    expect(clampCrop([-20, 150, 120, -5])).toEqual([0, 99.9, 99.9, 0]);
  });

  test("clampCropEdges stops the dragged edge without moving its opposite edge", () => {
    expect(clampCropEdges([95, 20, 30, 10], ["n"])).toEqual([69.9, 20, 30, 10]);
    expect(clampCropEdges([10, 95, 20, 30], ["e"])).toEqual([10, 69.9, 20, 30]);
  });

  test("clampCropPan preserves the crop window size at source boundaries", () => {
    expect(clampCropPan([-10, 40, 60, 20])).toEqual([0, 40, 50, 20]);
    expect(clampCropPan([20, -15, 30, 55])).toEqual([20, 0, 30, 40]);
  });

  test("computeCropResult clamps extreme crop values to the source", () => {
    const origin = computeCropOrigin({
      position: { x: 10, y: 20 },
      width: 400,
      height: 200,
      "source-width": 400,
      "source-height": 200,
    });
    const result = computeCropResult([-50, -25, 140, 125], origin);

    expect(result.crop.every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(result.position.x).toBeGreaterThanOrEqual(10);
    expect(result.position.y).toBeGreaterThanOrEqual(20);
    expect(result.position.x + result.width).toBeLessThanOrEqual(410);
    expect(result.position.y + result.height).toBeLessThanOrEqual(220);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  test("crop source dimensions do not compound an existing scale", () => {
    const media = {
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      "source-width": 200,
      "source-height": 100,
      scale: 2,
    };
    const origin = computeCropOrigin(media);
    const result = computeCropResult([10, 10, 10, 10], origin);

    expect(origin.srcW).toBe(400);
    expect(result["source-width"]).toBe(200);
    expect(result["source-height"]).toBe(100);
  });

  test("resizing a scaled crop persists unscaled source dimensions", () => {
    const origin = computeCropOrigin({
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      "source-width": 200,
      "source-height": 100,
      scale: 2,
    });
    const resizedOrigin = {
      ...origin,
      srcW: 500,
      srcH: 250,
      sourceWidth: 250,
      sourceHeight: 125,
    };
    const result = computeCropResult([10, 10, 10, 10], resizedOrigin);
    const reopened = computeCropOrigin({ ...result, scale: 2 });

    expect(result["source-width"]).toBe(250);
    expect(result["source-height"]).toBe(125);
    expect(reopened.srcW).toBe(500);
    expect(reopened.srcH).toBe(250);
  });
});
