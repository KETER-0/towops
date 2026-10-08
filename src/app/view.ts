export interface Ctx {
  /** Path segments after the screen name: #/missions/m00012 -> ['m00012'] */
  params: string[];
  query: URLSearchParams;
}

/** A screen: HTML from the current data, then event wiring on the drawn DOM. */
export interface View {
  title: string | ((ctx: Ctx) => string);
  render(ctx: Ctx): string;
  bind?(root: HTMLElement, ctx: Ctx): void;
}
