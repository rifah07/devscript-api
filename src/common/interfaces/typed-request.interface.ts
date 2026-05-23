export interface TypedRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, string>;
}
