import { Rocket } from 'lucide-react'
import type { ReactNode } from 'react'

type AuthShellProps = {
  children: ReactNode
}

const AuthShell = ({ children }: AuthShellProps) => {
  return (
    <div className="min-h-dvh w-full bg-white lg:grid lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-indigo-100/80 via-white to-sky-100 p-10 lg:flex xl:p-16">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-sky-200/40 blur-3xl" />

        <div className="relative my-auto flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-sky-400 text-white shadow-md shadow-primary/20">
              <Rocket className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Full Stack Template</span>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="max-w-md text-3xl leading-tight font-semibold tracking-tight text-foreground xl:text-4xl">
              Build, launch, and scale — without the setup.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              A modern, type-safe full stack template with contract-first architecture, so you can ship ideas end-to-end
              from day one.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-muted-foreground">© 2025 Full Stack Template</p>
      </aside>

      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:min-h-0">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

export default AuthShell
