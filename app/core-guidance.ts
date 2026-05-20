import type { CoreType } from "./core-preference";

export interface CoreGuidance {
  title: string;
  description: string;
  recommendedCore: CoreType;
}

export function getCoreGuidance(coreType: CoreType): CoreGuidance | null {
  if (coreType !== "builtin") {
    return null;
  }

  return {
    title: "Built-in 對 CJK / emoji 仍有限制",
    description: "中文、全形字與 emoji 在顯示上可能跳位；需要穩定輸入時，建議切換到 Ghostty。",
    recommendedCore: "ghostty",
  };
}
