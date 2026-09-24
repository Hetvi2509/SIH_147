import {
  CheckCircle,
  Info,
  SpinnerGap,
  WarningOctagon,
  Warning,
} from "@phosphor-icons/react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircle weight="fill" className="size-4 text-success" />,
        info: <Info weight="fill" className="size-4" />,
        warning: <Warning weight="fill" className="size-4 text-warning" />,
        error: <WarningOctagon weight="fill" className="size-4 text-destructive" />,
        loading: <SpinnerGap className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
