import type { FC } from "hono/jsx";

export const TagPill: FC<{ slug: string; name: string }> = ({ slug, name }) => (
  <a class="tag-pill" href={`/tags/${slug}`}>
    {name}
  </a>
);

export const Badge: FC<{ kind: "free" | "paid" }> = ({ kind }) =>
  kind === "free" ? (
    <span class="badge badge--free">無料</span>
  ) : (
    <span class="badge badge--paid">有料予定</span>
  );
