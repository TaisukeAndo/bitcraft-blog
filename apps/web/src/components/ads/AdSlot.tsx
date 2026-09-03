import type { FC } from "hono/jsx";

// 広告は記事詳細ページ内（本文冒頭・本文中・目次の下）のみに配置する
// （一覧ページ・サイドバーには置かない。ユーザー指示により2026-09-04変更）。
export type AdSlotPlacement = "in-article-top" | "in-article-bottom" | "toc-below";

export interface AdSlotProps {
  placement: AdSlotPlacement;
  adsenseClientId?: string;
  adSlotId?: string; // AdSense管理画面で発行するスロットID。未設定でも空プレースホルダーは出す
  lazy?: boolean; // below-the-fold枠はtrue（public/js/ads.jsがIntersectionObserverで遅延読込）
}

const MIN_HEIGHT: Record<AdSlotPlacement, string> = {
  "in-article-top": "250px",
  "in-article-bottom": "250px",
  "toc-below": "250px",
};

// Phase4本格導入までのプレースホルダー実装（実装プラン8章・12章「広告」）。
// AdSenseクライアントID未設定の間は、余白（ad-slot-wrapのmargin）ごと
// 何もレンダリングしない（空の灰色枠はもちろん、空間そのものも残さない。
// ユーザー指示により2026-09-04変更）。ADSENSE_CLIENT_IDが設定され次第、
// ラッパーごと描画されるようになる。呼び出し側（pages/post-detail.tsx）は
// ad-slot-wrapを自前で書かず、このコンポーネント1つを置くだけでよい。
export const AdSlot: FC<AdSlotProps> = ({ placement, adsenseClientId, adSlotId, lazy = false }) => {
  if (!adsenseClientId) {
    // ここにGoogle AdSenseの広告枠が入る予定（placement: in-article-top / in-article-bottom / toc-below）。
    return null;
  }

  return (
    <div class="ad-slot-wrap">
      <div
        class="ad-slot"
        style={`min-height:${MIN_HEIGHT[placement]}`}
        data-ad-client={adsenseClientId}
        data-ad-slot={adSlotId ?? ""}
        data-ad-lazy={lazy ? "true" : "false"}
      />
    </div>
  );
};
