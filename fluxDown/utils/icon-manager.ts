import { browser } from "wxt/browser";

/**
 * 浏览器工具栏图标的唯一状态入口。
 * 动画模型与配色参考 Aria2 Explorer（BSD-3-Clause），绘制代码为 FluxDown
 * 按 MV3 Service Worker 生命周期重新实现，第三方声明见 public/THIRD_PARTY_NOTICES.txt。
 */
export type ToolbarIconStyle = "default" | "disabled";
export type ToolbarResultAnimation = "complete" | "error";

export interface ToolbarTaskState {
  downloadingCount: number;
  pausedCount: number;
  preparingCount: number;
  /** 所有已知大小的下载中任务的合计进度，0..1；未知时为 null。 */
  progress: number | null;
}

type AnimationType = "download" | "progress" | "pause" | ToolbarResultAnimation;

const ICON_PATHS: Record<ToolbarIconStyle, Record<number, string>> = {
  default: { 16: "/icon/16.png", 32: "/icon/32.png", 48: "/icon/48.png", 128: "/icon/128.png" },
  disabled: { 16: "/icon/16-disabled.png", 32: "/icon/32-disabled.png", 48: "/icon/48-disabled.png", 128: "/icon/128-disabled.png" },
};

const COLORS = {
  blue: ["#4FC3F7", "#2196F3", "#1976D2"],
  green: ["#64DD17", "#4CAF50", "#388E3C"],
  red: ["#FF5252", "#F44336", "#D32F2F"],
} as const;

// Aria2 Explorer 的活动任务角标使用绿色；图标主体的下载进度使用蓝色渐变。
const BADGE_COLOR = "#4CAF50";
const CANVAS_SIZE = 32;
const FRAME_INTERVAL_MS = 1000 / 24;
const RESULT_DURATION_MS = 2800;
const FADE_DURATION_MS = 300;

export function formatDownloadingBadge(count: number): string {
  const normalized = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (normalized === 0) return "";
  return normalized > 99 ? "99+" : String(normalized);
}

function normalizeCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

class ToolbarIconManager {
  private style: ToolbarIconStyle = "default";
  private tasks: ToolbarTaskState = {
    downloadingCount: 0,
    pausedCount: 0,
    preparingCount: 0,
    progress: null,
  };
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private animation: AnimationType | null = null;
  private animationStartedAt = 0;
  private resultEndsAt = 0;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private frameWritePending = false;
  private dynamicIconSupported = true;
  private smoothedProgress = 0;
  private renderQueue: Promise<void> = Promise.resolve();

  setEnabled(enabled: boolean): Promise<void> {
    this.style = enabled ? "default" : "disabled";
    if (!enabled) this.stopAnimation();
    const rendered = this.renderStaticState();
    if (enabled) this.syncSteadyAnimation();
    return rendered;
  }

  setTaskState(next: ToolbarTaskState): Promise<void> {
    this.tasks = {
      downloadingCount: normalizeCount(next.downloadingCount),
      pausedCount: normalizeCount(next.pausedCount),
      preparingCount: normalizeCount(next.preparingCount),
      progress:
        next.progress === null || !Number.isFinite(next.progress)
          ? null
          : Math.max(0, Math.min(1, next.progress)),
    };
    const rendered = this.renderBadge();
    this.syncSteadyAnimation();
    return rendered;
  }

  playResult(type: ToolbarResultAnimation): void {
    if (this.style === "disabled") return;
    this.startAnimation(type, RESULT_DURATION_MS);
  }

  restore(): Promise<void> {
    this.stopAnimation();
    const rendered = this.renderStaticState();
    if (this.style === "default") this.syncSteadyAnimation();
    return rendered;
  }

  private desiredSteadyAnimation(): AnimationType | null {
    if (this.tasks.downloadingCount > 0) {
      return this.tasks.progress === null ? "download" : "progress";
    }
    if (this.tasks.preparingCount > 0) return "download";
    if (this.tasks.pausedCount > 0) return "pause";
    return null;
  }

  private syncSteadyAnimation(): void {
    if (this.style === "disabled" || !this.dynamicIconSupported) return;
    if (this.resultEndsAt > performance.now()) return;
    const desired = this.desiredSteadyAnimation();
    if (desired) {
      if (this.animation !== desired) this.startAnimation(desired);
    } else if (this.animation) {
      this.stopAnimation();
      void this.renderStaticState();
    }
  }

  private startAnimation(type: AnimationType, duration = 0): void {
    if (!this.ensureCanvas()) return;
    this.animation = type;
    this.animationStartedAt = performance.now();
    this.resultEndsAt = duration > 0 ? this.animationStartedAt + duration : 0;
    if (!this.frameTimer) {
      this.frameTimer = setInterval(() => this.drawFrame(), FRAME_INTERVAL_MS);
    }
    this.drawFrame();
  }

  private stopAnimation(): void {
    if (this.frameTimer) clearInterval(this.frameTimer);
    this.frameTimer = null;
    this.animation = null;
    this.resultEndsAt = 0;
  }

  private ensureCanvas(): boolean {
    if (this.canvas && this.ctx) return true;
    if (!this.dynamicIconSupported || typeof OffscreenCanvas === "undefined") {
      this.dynamicIconSupported = false;
      return false;
    }
    try {
      this.canvas = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE);
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
      if (!this.ctx) throw new Error("2D canvas context unavailable");
      return true;
    } catch (error) {
      this.dynamicIconSupported = false;
      console.warn("[FluxDown] animated toolbar icon unavailable:", error);
      return false;
    }
  }

  private drawFrame(): void {
    const ctx = this.ctx;
    const animation = this.animation;
    if (!ctx || !animation || this.frameWritePending) return;

    const now = performance.now();
    if (this.resultEndsAt > 0 && now >= this.resultEndsAt) {
      this.resultEndsAt = 0;
      const desired = this.desiredSteadyAnimation();
      if (desired) this.startAnimation(desired);
      else {
        this.stopAnimation();
        void this.renderStaticState();
      }
      return;
    }

    const elapsed = now - this.animationStartedAt;
    const cycle = (elapsed % 1000) / 1000;
    let alpha = Math.min(1, elapsed / FADE_DURATION_MS);
    if (this.resultEndsAt > 0) {
      alpha = Math.min(alpha, Math.max(0, (this.resultEndsAt - now) / FADE_DURATION_MS));
    }

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (animation === "progress") this.drawProgress(ctx);
    else if (animation === "download") this.drawDownload(ctx, cycle);
    else if (animation === "pause") this.drawPause(ctx, cycle);
    else if (animation === "complete") this.drawComplete(ctx, elapsed / RESULT_DURATION_MS);
    else this.drawError(ctx, cycle);
    ctx.restore();

    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    this.frameWritePending = true;
    const action = browser.action as any;
    Promise.resolve(action?.setIcon({ imageData: { 32: imageData } }))
      .catch((error) => {
        this.dynamicIconSupported = false;
        this.stopAnimation();
        console.warn("[FluxDown] animated toolbar icon update failed:", error);
        return this.renderStaticState();
      })
      .finally(() => {
        this.frameWritePending = false;
      });
  }

  private gradient(
    ctx: OffscreenCanvasRenderingContext2D,
    colors: readonly [string, string, string],
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): CanvasGradient {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);
    return gradient;
  }

  private shadow(ctx: OffscreenCanvasRenderingContext2D, color: string, blur: number): void {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0.5;
    ctx.shadowOffsetY = 0.5;
  }

  private drawDownload(ctx: OffscreenCanvasRenderingContext2D, cycle: number): void {
    const offset = Math.sin(cycle * Math.PI * 2) * 2 + 2;
    this.shadow(ctx, "rgba(33,150,243,.3)", 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.gradient(ctx, COLORS.blue, 8, 0, 8, 16);
    ctx.beginPath();
    ctx.moveTo(8, offset);
    ctx.lineTo(8, offset + 12);
    ctx.moveTo(4, offset + 9);
    ctx.lineTo(8, offset + 12);
    ctx.lineTo(12, offset + 9);
    ctx.stroke();
  }

  private drawProgress(ctx: OffscreenCanvasRenderingContext2D): void {
    const target = this.tasks.progress ?? 0;
    this.smoothedProgress += (target - this.smoothedProgress) * 0.12;
    if (Math.abs(target - this.smoothedProgress) < 0.002) this.smoothedProgress = target;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(33,150,243,.2)";
    ctx.stroke();
    this.shadow(ctx, "rgba(33,150,243,.3)", 2);
    ctx.beginPath();
    ctx.arc(8, 8, 7, -Math.PI / 2, -Math.PI / 2 + this.smoothedProgress * Math.PI * 2);
    ctx.strokeStyle = this.gradient(ctx, COLORS.blue, 2, 2, 14, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(8, 12);
    ctx.lineTo(5, 9);
    ctx.moveTo(8, 12);
    ctx.lineTo(11, 9);
    ctx.stroke();
  }

  private drawPause(ctx: OffscreenCanvasRenderingContext2D, cycle: number): void {
    const pulse = 0.45 + (Math.sin(cycle * Math.PI * 2) + 1) * 0.18;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(33,150,243,${pulse})`;
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, Math.PI * 2);
    ctx.stroke();
    this.shadow(ctx, "rgba(3,169,244,.2)", 1);
    ctx.strokeStyle = this.gradient(ctx, COLORS.blue, 0, 0, 16, 16);
    ctx.beginPath();
    ctx.moveTo(6.75, 5);
    ctx.lineTo(6.75, 11);
    ctx.moveTo(9.25, 5);
    ctx.lineTo(9.25, 11);
    ctx.stroke();
  }

  private drawComplete(ctx: OffscreenCanvasRenderingContext2D, progress: number): void {
    const drawn = Math.min(1, progress * 1.5);
    this.shadow(ctx, "rgba(76,175,80,.3)", 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.gradient(ctx, COLORS.green, 2, 8, 15, 4);
    ctx.beginPath();
    ctx.moveTo(2, 8);
    if (drawn <= 0.5) ctx.lineTo(2 + 10 * drawn, 8 + 12 * drawn);
    else {
      ctx.lineTo(7, 14);
      const t = (drawn - 0.5) * 2;
      ctx.lineTo(7 + 8 * t, 14 - 10 * t);
    }
    ctx.stroke();
  }

  private drawError(ctx: OffscreenCanvasRenderingContext2D, cycle: number): void {
    const scale = 1 + Math.sin(cycle * Math.PI * 2) * 0.15;
    ctx.translate(8, 8);
    ctx.scale(scale, scale);
    ctx.translate(-8, -8);
    this.shadow(ctx, "rgba(255,0,0,.4)", 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.gradient(ctx, COLORS.red, 4, 4, 13, 13);
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.quadraticCurveTo(8, 8, 13, 13);
    ctx.moveTo(13, 4);
    ctx.quadraticCurveTo(8, 8, 4, 13);
    ctx.stroke();
  }

  private renderBadge(): Promise<void> {
    const text = formatDownloadingBadge(this.tasks.downloadingCount);
    return this.enqueue(async () => {
      const action = browser.action;
      if (!action) return;
      await action.setBadgeText({ text });
      if (text) await action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    });
  }

  private renderStaticState(): Promise<void> {
    return this.enqueue(async () => {
      const action = browser.action;
      if (!action) return;
      const text = formatDownloadingBadge(this.tasks.downloadingCount);
      await Promise.all([
        action.setIcon({ path: ICON_PATHS[this.style] }),
        action.setBadgeText({ text }),
        text ? action.setBadgeBackgroundColor({ color: BADGE_COLOR }) : Promise.resolve(),
      ]);
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    this.renderQueue = this.renderQueue.then(operation).catch((error) => {
      console.warn("[FluxDown] toolbar icon update failed:", error);
    });
    return this.renderQueue;
  }
}

export const toolbarIcon = new ToolbarIconManager();
