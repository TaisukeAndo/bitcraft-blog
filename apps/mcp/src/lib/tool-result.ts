import type { ApiResult } from "./api-client";

// MCPツールの戻り値はcontent配列(text/image/...)を持つ形が規約。
// このAPIはJSONを返すエンドポイントのみをラップするため、常にtext(JSON文字列化)
// で統一する。apps/apiが非2xxを返した場合はisError:trueにして、
// エージェント側がエラーとして扱えるようにする。
export function jsonResult(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: data === undefined ? "" : JSON.stringify(data, null, 2) }],
    isError,
  };
}

export function apiResultToToolResult(result: ApiResult) {
  return jsonResult(result.data, !result.ok);
}
