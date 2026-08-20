export type FormSourceWorkspace = {
  formUrl: string;
  pastedText: string;
  formSource: unknown | null;
  formContextSummary: string;
};

export function clearCurrentFormSource<T extends FormSourceWorkspace>(workspace: T): T {
  return {
    ...workspace,
    formUrl: "",
    pastedText: "",
    formSource: null,
    formContextSummary: "",
  };
}
