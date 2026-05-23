export interface GqlContext {
  req: {
    headers: Record<string, string | string[] | undefined>;
    cookies: Record<string, string>;
    user?: unknown;
  };
  res: {
    cookie: (
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ) => void;
    clearCookie: (name: string) => void;
  };
}
