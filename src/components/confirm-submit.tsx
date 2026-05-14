"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

// Submit button that asks for native confirmation before letting the
// enclosing form's server action run. Keeps delete flows progressive-
// enhancement safe without pulling in a modal.
export function ConfirmSubmit({
  message,
  children,
  ...props
}: ButtonProps & { message: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
