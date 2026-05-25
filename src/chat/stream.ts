export function renderStreamToken(token: string, isFirst: boolean): void {
  if (isFirst) {
    process.stdout.write('\n');
  }
  process.stdout.write(token);
}

export function finalizeStream(): void {
  process.stdout.write('\n');
}
