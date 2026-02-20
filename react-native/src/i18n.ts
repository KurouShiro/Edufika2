export type AppLanguage = "id" | "en";

export function tr(language: AppLanguage, indonesian: string, english: string): string {
  return language === "id" ? indonesian : english;
}
