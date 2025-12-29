class NaiteClass {
  t(key: string, value: unknown) {
    console.log(key, value);
  }

  get(key: string) {
    console.log(key);
  }
}

export const Naite = new NaiteClass();
