/** クラス名の結合。falsy を落として空白で繋ぐだけ（clsx は入れない） */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
