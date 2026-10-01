import { describe, expect, it } from "vitest";
import { resolveBetrayalVisualTransitionContentScale } from "../visualTransitionSurface";

describe("resolveBetrayalVisualTransitionContentScale", () => {
  it("按缩放后源 token 的可见尺寸缩小 portal 动画内容", () => {
    expect(
      resolveBetrayalVisualTransitionContentScale({
        targetWidth: 18,
        targetHeight: 20,
        contentWidth: 42,
        contentHeight: 54,
      }),
    ).toBeCloseTo(20 / 54, 6);
  });

  it("不会把已经较小的动画内容放大", () => {
    expect(
      resolveBetrayalVisualTransitionContentScale({
        targetWidth: 60,
        targetHeight: 70,
        contentWidth: 42,
        contentHeight: 54,
      }),
    ).toBe(1);
  });

  it("尺寸无效时保持原始比例", () => {
    expect(
      resolveBetrayalVisualTransitionContentScale({
        targetWidth: 0,
        targetHeight: 20,
        contentWidth: 42,
        contentHeight: 54,
      }),
    ).toBe(1);
  });
});
