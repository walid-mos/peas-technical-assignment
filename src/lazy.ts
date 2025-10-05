export const lazy = <TResult>(fn: () => TResult): (() => TResult) => {
  let executed = false;
  let value: TResult | undefined;
  return () => {
    if (executed) {
      return value! 
    }
    value = fn();
    executed = true;
    return value;
  };
};
