import type { FC } from "hono/jsx";

export type AdSlotPlacement = "in-article-top" | "in-article-bottom" | "sidebar" | "list-native";

export interface AdSlotProps {
  placement: AdSlotPlacement;
  adsenseClientId?: string;
  adSlotId?: string; // AdSense管理画面で発行するスロットID。未設定でも空プレースホルダーは出す
  lazy?: boolean; // below-the-fold枠はtrue（public/js/ads.jsがIntersectionObserverで遅延読込）
}

const MIN_HEIGHT: Record<AdSlotPlacement, string> = {
  "in-article-top": "250px",
  "in-article-bottom": "250px",
  sidebar: "600px",
  "list-native": "120px",
};

// Phase4本格導入までのプレースホルダー実装（実装プラン8章・12章「広告」）。
// 固定min-heightを常に確保することでCLS（レイアウトのガタつき）を防ぐ。
// AdSenseクライアントID未設定の間は空のプレースホルダーdivのみを描画し、
// 広告スクリプトは一切読み込まない（未設定時は何も出さない、という要件を満たす）。
export const AdSlot: FC<AdSlotProps> = ({ placement, adsenseClientId, adSlotId, lazy = false }) => {
  if (!adsenseClientId) {
    return (
      <div
        class="ad-slot ad-slot--empty"
        style={`min-height:${MIN_HEIGHT[placement]}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      class="ad-slot"
      style={`min-height:${MIN_HEIGHT[placement]}`}
      data-ad-client={adsenseClientId}
      data-ad-slot={adSlotId ?? ""}
      data-ad-lazy={lazy ? "true" : "false"}
    />
  );
};
