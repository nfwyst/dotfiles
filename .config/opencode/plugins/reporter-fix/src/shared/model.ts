export function formatQualifiedModel(
  provider: string | undefined,
  model: string | undefined
): string | undefined {
  if (!provider || !model) {
    return model;
  }

  return `${provider}/${model}`;
}
