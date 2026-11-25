export type LabStudy = "rebuild";

export type LabFlags = Readonly<{ forceWebGL: boolean; stress: number; continuous: boolean; study: LabStudy | undefined }>;

export const MAX_STRESS = 5_000;

export function readLabFlags(search: string): LabFlags {
  const params = new URLSearchParams(search);
  const stress = Math.trunc(Number(params.get("stress") ?? 0));
  return {
    forceWebGL: params.get("forceWebGL") === "1",
    stress: Number.isFinite(stress) ? Math.min(MAX_STRESS, Math.max(0, stress)) : 0,
    continuous: params.get("continuous") === "1",
    study: params.get("study") === "rebuild" ? "rebuild" : undefined,
  };
}
