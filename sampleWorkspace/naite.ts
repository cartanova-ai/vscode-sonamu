class NaiteClass {
  t(key: string, value: any) {
    console.log(key, value);
  }

  get(key: string) {
    console.log(key);
  }
}

export const Naite = new NaiteClass();
