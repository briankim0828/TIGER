// Convert fontSize from string format (like 'xl') to number
export const parseFontSize = (size: string | number): number => {
  if (typeof size === "number") return size;

  switch (size) {
    case "xs":
      return 12;
    case "sm":
      return 14;
    case "md":
      return 16;
    case "lg":
      return 18;
    case "xl":
      return 20;
    case "2xl":
      return 24;
    case "3xl":
      return 30;
    case "4xl":
      return 36;
    default:
      return 16;
  }
};
