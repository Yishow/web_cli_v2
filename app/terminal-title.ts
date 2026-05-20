export const DEFAULT_PAGE_TITLE = "web_cli_v2";
export const DEFAULT_HEADER_TITLE = "終端";

export function formatDocumentTitle(title: string): string {
  return title ? `${title} — ${DEFAULT_PAGE_TITLE}` : DEFAULT_PAGE_TITLE;
}

export function getHeaderTitle(title: string): string {
  return title || DEFAULT_HEADER_TITLE;
}
