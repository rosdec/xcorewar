import type { ComponentChildren } from "preact";

export interface ButtonProps {
  id?: string;
  onClick?: () => void;
  children?: ComponentChildren;
  disabled?: boolean;
}

export function Button(props: ButtonProps) {
  const { children, ...buttonProps } = props;
  return (
    <button
      {...buttonProps}
      class="px-2 py-1 border-gray-500 border-2 rounded-sm bg-white hover:bg-gray-200 transition-colors"
    >
      {children}
    </button>
  );
}
