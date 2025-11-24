import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function decodeHtmlEntities(value: string): string {
  if (!value) return value;

  return (
    value
      // Numeric decimal entities, e.g. &#039; or &#8217;
      .replace(/&#(\d+);/g, (_match, code) => {
        const n = Number.parseInt(code, 10);
        return Number.isNaN(n) ? _match : String.fromCharCode(n);
      })
      // Numeric hex entities, e.g. &#x2019;
      .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
        const n = Number.parseInt(hex, 16);
        return Number.isNaN(n) ? _match : String.fromCharCode(n);
      })
      // Common named entities we expect from UG content
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      // Quotation marks and apostrophes
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      // Dashes
      .replace(/&ndash;/g, "–")
      .replace(/&mdash;/g, "—")
      // Other common symbols
      .replace(/&hellip;/g, "…")
      .replace(/&trade;/g, "™")
      .replace(/&copy;/g, "©")
      .replace(/&reg;/g, "®")
      .replace(/&deg;/g, "°")
      .replace(/&times;/g, "×")
      .replace(/&divide;/g, "÷")
      .replace(/&plusmn;/g, "±")
  );
}
