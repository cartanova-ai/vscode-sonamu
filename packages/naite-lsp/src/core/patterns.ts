export const NaiteCallPatterns = {
  set: ["Naite.t"],
  get: ["Naite.get", "Naite.del"],

  isSet(pattern: string): boolean {
    return this.set.includes(pattern);
  },

  isGet(pattern: string): boolean {
    return this.get.includes(pattern);
  },

  all(): string[] {
    return [...this.set, ...this.get];
  },

  getType(pattern: string): "set" | "get" | undefined {
    return this.isSet(pattern) ? "set" : this.isGet(pattern) ? "get" : undefined;
  },
};
