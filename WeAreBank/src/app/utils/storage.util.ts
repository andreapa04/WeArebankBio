export function safeLocalStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (_: string) => null,
    setItem: (_: string, __: string) => {},
    removeItem: (_: string) => {}
  };
}
